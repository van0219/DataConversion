from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, List, Optional
from app.models.job import ConversionJob, ValidationError as ValidationErrorModel
from app.models.rule import ValidationRuleTemplate, ValidationRuleAssignment
from app.services.schema_validator import SchemaValidator, ValidationError
from app.services.rule_executor import RuleExecutor
from app.services.streaming_engine import StreamingEngine
from app.services.mapping_engine import MappingEngine
from app.modules.schema.service import SchemaService
from app.modules.upload.service import UploadService
from app.core.logging import logger
import csv
import io

class ValidationService:
    @staticmethod
    @staticmethod
    async def start_validation(
        db: Session,
        account_id: int,
        job_id: int,
        business_class: str,
        mapping: Dict,
        enable_rules: bool = True,
        selected_rule_set_id: Optional[int] = None
    ):
        """
        Start validation process with streaming architecture.
        Pipeline: Stream → Normalize → Schema Validation → Rule Validation → Persist
        
        Args:
            selected_rule_set_id: Optional rule set to apply (in addition to Default rule set)
        """
        try:
            # Get job
            job = db.query(ConversionJob).filter(
                ConversionJob.id == job_id,
                ConversionJob.account_id == account_id
            ).first()
            
            if not job:
                logger.error(f"Job {job_id} not found for account {account_id}")
                return
            
            # Set status to validating
            job.status = "validating"
            job.valid_records = 0
            job.invalid_records = 0
            db.commit()
            logger.info(f"Job {job_id} status set to validating")
            
            logger.info(f"Starting validation for job {job_id}")
            
            # Get schema
            schema = SchemaService.get_latest_schema(db, account_id, business_class)
            if not schema:
                job.status = "failed"
                db.commit()
                logger.error(f"No schema found for {business_class}")
                return
            
            parsed_schema = SchemaService.get_parsed_schema(schema)
            
            # Get validation rules
            rules = []
            if enable_rules:
                rules = ValidationService._get_active_rules(
                    db, 
                    account_id, 
                    business_class,
                    selected_rule_set_id
                )
            
            # Initialize rule executor
            rule_executor = RuleExecutor(db, account_id)
            
            # Get file path
            file_path = UploadService.get_file_path(job_id)
            
            # Process file in streaming fashion
            total_valid = 0
            total_invalid = 0
            chunk_num = 0
            
            for chunk in StreamingEngine.stream_csv(file_path, chunk_size=1000):
                chunk_num += 1
                chunk_errors = []  # Collect all errors for this chunk
                
                for record in chunk:
                    row_number = record.get('_row_number', 0)
                    
                    # Apply field mapping
                    mapped_record = MappingEngine.apply_mapping(record, mapping)
                    
                    # Schema validation
                    normalized_record, schema_errors = SchemaValidator.validate_record(
                        mapped_record,
                        parsed_schema,
                        row_number
                    )
                    
                    # Rule validation
                    rule_errors = []
                    if enable_rules and not schema_errors:  # Only run rules if schema is valid
                        for rule in rules:
                            error = await rule_executor.execute_rule(rule, normalized_record, row_number)
                            if error:
                                rule_errors.append(error)
                    
                    # Collect all errors for this record
                    all_errors = schema_errors + rule_errors
                    
                    if all_errors:
                        total_invalid += 1
                        chunk_errors.extend([
                            {
                                'conversion_job_id': job_id,
                                'row_number': row_number,
                                'field_name': error.field_name,
                                'invalid_value': str(error.field_value)[:500] if error.field_value is not None else None,
                                'error_type': error.error_type,
                                'error_message': error.message
                            }
                            for error in all_errors
                        ])
                    else:
                        total_valid += 1
                
                # Persist errors for this chunk
                if chunk_errors:
                    ValidationService._persist_errors(db, chunk_errors)
                
                # Update progress after each chunk
                job.valid_records = total_valid
                job.invalid_records = total_invalid
                db.commit()
                
                logger.info(f"Processed chunk {chunk_num}: {total_valid} valid, {total_invalid} invalid")
            
            # Update final job status
            job.status = "validated"
            job.valid_records = total_valid
            job.invalid_records = total_invalid
            db.commit()
            
            logger.info(f"Validation complete for job {job_id}: {total_valid} valid, {total_invalid} invalid")
            
        except Exception as e:
            logger.error(f"Validation failed for job {job_id}: {str(e)}")
            try:
                job = db.query(ConversionJob).filter(
                    ConversionJob.id == job_id,
                    ConversionJob.account_id == account_id
                ).first()
                if job:
                    job.status = "failed"
                    db.commit()
            except:
                pass
    
    @staticmethod
    def _get_active_rules(
        db: Session,
        account_id: int,
        business_class: str,
        selected_rule_set_id: Optional[int] = None
    ) -> List[Dict]:
        """
        Get active validation rules for business class using rule sets.
        
        Rule Set Logic:
        - If a custom rule set is selected, use ONLY that rule set
        - If no rule set is selected, use the Default rule set
        - Never apply both (custom sets are often copies of Default)
        """
        from app.models.validation_rule_set import ValidationRuleSet
        
        rules = []
        rule_set_to_use = None
        rule_set_name = "Default"
        
        # Step 1: Determine which rule set to use
        if selected_rule_set_id:
            # User selected a custom rule set - use ONLY that one
            rule_set_to_use = db.query(ValidationRuleSet).filter(
                ValidationRuleSet.id == selected_rule_set_id,
                ValidationRuleSet.business_class == business_class,
                ValidationRuleSet.is_active == True
            ).first()
            
            if rule_set_to_use:
                rule_set_name = rule_set_to_use.name
                logger.info(f"Using selected rule set '{rule_set_name}' for {business_class}")
            else:
                logger.warning(f"Selected rule set {selected_rule_set_id} not found, falling back to Default")
        
        # Step 2: If no custom rule set selected (or not found), use Default
        if not rule_set_to_use:
            rule_set_to_use = db.query(ValidationRuleSet).filter(
                ValidationRuleSet.business_class == business_class,
                ValidationRuleSet.is_common == True,
                ValidationRuleSet.is_active == True
            ).first()
            
            if rule_set_to_use:
                logger.info(f"Using Default rule set for {business_class}")
            else:
                logger.warning(f"No Default rule set found for {business_class}")
                return []
        
        # Step 3: Get all active rules from the selected rule set
        rule_records = db.query(ValidationRuleTemplate).filter(
            ValidationRuleTemplate.rule_set_id == rule_set_to_use.id,
            ValidationRuleTemplate.is_active == True
        ).all()
        
        logger.info(f"Loaded {len(rule_records)} rules from '{rule_set_name}' rule set")
        
        # Step 4: Convert to dict format
        for rule in rule_records:
            rules.append({
                "rule_type": rule.rule_type,
                "field_name": rule.field_name,
                "from_field": rule.from_field,
                "reference_business_class": rule.reference_business_class,
                "reference_field_name": rule.reference_field_name,
                "condition_expression": rule.condition_expression,
                "error_message": rule.error_message,
                "pattern": rule.pattern,
                "enum_values": rule.enum_values
            })
        
        logger.info(f"Total rules loaded for {business_class}: {len(rules)} from '{rule_set_name}'")
        return rules
    
    @staticmethod
    def _persist_errors(db: Session, job_id: int, errors: List[ValidationError]):
        """Persist validation errors to database using bulk insert for performance"""
        if not errors:
            return
        
        # Prepare error records for bulk insert
        error_records = [
            {
                'conversion_job_id': job_id,
                'row_number': error.row_number,
                'field_name': error.field_name,
                'invalid_value': error.invalid_value,
                'error_type': error.error_type,
                'error_message': error.error_message
            }
            for error in errors
        ]
        
        # Bulk insert - much faster than individual inserts
        db.bulk_insert_mappings(ValidationErrorModel, error_records)
        db.commit()
    
    @staticmethod
    def get_progress(db: Session, account_id: int, job_id: int) -> Optional[Dict]:
        """Get validation progress"""
        job = db.query(ConversionJob).filter(
            ConversionJob.id == job_id,
            ConversionJob.account_id == account_id
        ).first()
        
        if not job:
            return None
        
        processed = job.valid_records + job.invalid_records
        total_records = job.total_records or 0
        
        # Calculate progress percentage
        progress_percentage = (processed / total_records * 100) if total_records > 0 else 0
        
        # Calculate chunk information
        total_chunks = (total_records // 1000) + 1 if total_records > 0 else 0
        current_chunk = (processed // 1000) + 1 if processed > 0 else 0
        
        # Get error count
        errors_found = db.query(func.count(ValidationErrorModel.id)).filter(
            ValidationErrorModel.conversion_job_id == job_id
        ).scalar() or 0
        
        return {
            "job_id": job_id,
            "status": job.status,
            "progress": progress_percentage,
            "current_chunk": current_chunk,
            "total_chunks": total_chunks,
            "records_processed": processed,
            "total_records": total_records,
            "errors_found": errors_found,
            "filename": job.filename
        }
    
    @staticmethod
    def get_summary(db: Session, account_id: int, job_id: int) -> Optional[Dict]:
        """Get validation summary with top errors"""
        job = db.query(ConversionJob).filter(
            ConversionJob.id == job_id,
            ConversionJob.account_id == account_id
        ).first()
        
        if not job:
            return None
        
        # Get error count
        error_count = db.query(func.count(ValidationErrorModel.id)).filter(
            ValidationErrorModel.conversion_job_id == job_id
        ).scalar()
        
        # Get top 10 error types
        top_errors = db.query(
            ValidationErrorModel.error_type,
            ValidationErrorModel.field_name,
            func.count(ValidationErrorModel.id).label('count')
        ).filter(
            ValidationErrorModel.conversion_job_id == job_id
        ).group_by(
            ValidationErrorModel.error_type,
            ValidationErrorModel.field_name
        ).order_by(
            func.count(ValidationErrorModel.id).desc()
        ).limit(10).all()
        
        top_errors_list = [
            {
                "error_type": e.error_type,
                "field_name": e.field_name,
                "count": e.count
            }
            for e in top_errors
        ]
        
        return {
            "job_id": job_id,
            "status": job.status,
            "total_records": job.total_records or 0,
            "valid_records": job.valid_records,
            "invalid_records": job.invalid_records,
            "error_count": error_count,
            "top_errors": top_errors_list
        }
    
    @staticmethod
    def get_errors(
        db: Session,
        account_id: int,
        job_id: int,
        error_type: Optional[str] = None,
        field_name: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict]:
        """Get validation errors with filtering"""
        query = db.query(ValidationErrorModel).filter(
            ValidationErrorModel.conversion_job_id == job_id
        )
        
        if error_type:
            query = query.filter(ValidationErrorModel.error_type == error_type)
        
        if field_name:
            query = query.filter(ValidationErrorModel.field_name == field_name)
        
        errors = query.order_by(ValidationErrorModel.row_number).limit(limit).offset(offset).all()
        
        return [
            {
                "row_number": e.row_number,
                "field_name": e.field_name,
                "invalid_value": e.invalid_value,
                "error_type": e.error_type,
                "error_message": e.error_message
            }
            for e in errors
        ]
    
    @staticmethod
    def export_errors_csv(db: Session, account_id: int, job_id: int) -> Optional[str]:
        """
        Export original CSV file with added 'Error Message' column.
        Returns the original file with all columns plus error messages for invalid rows.
        """
        # Get errors
        errors = db.query(ValidationErrorModel).filter(
            ValidationErrorModel.conversion_job_id == job_id
        ).order_by(ValidationErrorModel.row_number).all()
        
        if not errors:
            return None
        
        # Group errors by row number
        grouped_errors = {}
        for error in errors:
            row_num = error.row_number
            if row_num not in grouped_errors:
                grouped_errors[row_num] = []
            grouped_errors[row_num].append(error)
        
        # Get original file path
        file_path = UploadService.get_file_path(job_id)
        if not file_path.exists():
            logger.error(f"Original file not found for job {job_id}")
            return None
        
        # Read original CSV and add error messages
        output = io.StringIO()
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                # Get original headers and add 'Error Message' column
                original_headers = reader.fieldnames
                if not original_headers:
                    return None
                
                new_headers = list(original_headers) + ['Error Message']
                
                writer = csv.DictWriter(output, fieldnames=new_headers)
                writer.writeheader()
                
                # Process each row
                row_number = 1  # CSV row numbers start at 1 (after header)
                for row in reader:
                    row_number += 1
                    
                    # Check if this row has errors
                    if row_number in grouped_errors:
                        row_errors = grouped_errors[row_number]
                        
                        # Combine all error messages for this row
                        error_messages = []
                        for e in row_errors:
                            # Format: [Field] Error message
                            error_messages.append(f"[{e.field_name}] {e.error_message}")
                        
                        # Join with semicolon separator
                        row['Error Message'] = '; '.join(error_messages)
                    else:
                        # No errors for this row
                        row['Error Message'] = ''
                    
                    writer.writerow(row)
                
                logger.info(f"Exported {row_number} rows with error messages for job {job_id}")
                
        except Exception as e:
            logger.error(f"Error exporting CSV with errors: {e}")
            return None
        
        return output.getvalue()
