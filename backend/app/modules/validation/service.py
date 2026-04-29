from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, List, Optional
from app.models.job import ConversionJob, ValidationError as ValidationErrorModel
from app.models.rule import ValidationRuleTemplate, ValidationRuleAssignment
from app.services.rule_executor import RuleExecutor
from app.services.streaming_engine import StreamingEngine
from app.services.mapping_engine import MappingEngine

from app.modules.upload.service import UploadService
from app.core.logging import logger
import csv
import io
import json

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
        selected_rule_set_id: Optional[int] = None,
        date_source_format: Optional[str] = None
    ):
        """
        Start validation process with streaming architecture.
        Pipeline: Stream → Normalize → Date Transform → Rule Validation → Persist
        
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
            
            # Set status to validating and clear previous errors
            job.status = "validating"
            job.valid_records = 0
            job.invalid_records = 0
            db.query(ValidationErrorModel).filter(
                ValidationErrorModel.conversion_job_id == job_id
            ).delete()
            db.commit()
            logger.info(f"Job {job_id} status set to validating")
            
            logger.info(f"Starting validation for job {job_id}")
            
            # Get validation rules from the selected Rule Set
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
            
            total_valid = 0
            total_invalid = 0
            chunk_num = 0
            
            # --- Pre-validation: BALANCE_CHECK (file-level, cross-record) ---
            balance_errors = await ValidationService._run_balance_checks(
                db, account_id, job_id, file_path, mapping, rules
            )
            if balance_errors:
                ValidationService._persist_errors(db, job_id, balance_errors)
                # Count unique rows flagged by balance errors
                total_invalid += len(set(e["row_number"] for e in balance_errors))
                job.invalid_records = total_invalid
                db.commit()
                logger.info(f"Balance check found {len(balance_errors)} group errors")

            for chunk in StreamingEngine.stream_csv(file_path, chunk_size=1000):
                chunk_num += 1
                chunk_errors = []
                
                for record in chunk:
                    row_number = int(record.get("_row_number", 0))
                    has_trailing_comma = bool(record.get("_has_trailing_comma", False))
                    
                    # Apply field mapping: CSV columns → FSM field names
                    mapped_record = MappingEngine.apply_mapping(record, mapping)
                    
                    # Apply date format transform if configured (in-memory only, original file untouched)
                    if date_source_format:
                        mapped_record = ValidationService._apply_date_transform(mapped_record, date_source_format)
                    
                    # Validate only against the selected Rule Set
                    rule_errors = []
                    for rule in rules:
                        error = await rule_executor.execute_rule(rule, mapped_record, row_number)
                        if error:
                            rule_errors.append(error)
                    
                    if rule_errors:
                        total_invalid += 1
                        for err in rule_errors:
                            msg = err.error_message
                            # If this row had a trailing comma, the last CSV field's value was
                            # truncated by the parser splitting on the comma. Add a hint.
                            if has_trailing_comma:
                                msg += " (Note: this row has a trailing comma in the CSV — the last field value may be truncated)"
                            chunk_errors.append({
                                "conversion_job_id": job_id,
                                "row_number": err.row_number,
                                "field_name": err.field_name,
                                "invalid_value": err.invalid_value,
                                "error_type": err.error_type,
                                "error_message": msg
                            })
                    else:
                        total_valid += 1
                
                # Persist errors for this chunk incrementally
                if chunk_errors:
                    ValidationService._persist_errors(db, job_id, chunk_errors)
                
                # Update progress after each chunk
                job.valid_records = total_valid
                job.invalid_records = total_invalid
                db.commit()
                
                logger.info(f"Chunk {chunk_num}: {total_valid} valid, {total_invalid} invalid so far")
            
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
    async def _run_balance_checks(
        db: Session,
        account_id: int,
        job_id: int,
        file_path,
        mapping: Dict,
        rules: List[Dict]
    ) -> List[Dict]:
        """
        Pre-validation pass for BALANCE_CHECK rules.
        Groups all records by the group_by_field, sums amounts,
        and flags groups where the net is not zero.

        condition_expression JSON config:
        {
            "group_by_field": "RunGroup",
            "amount_field": "TransactionAmount",
            "mode": "single_field"   # pos=debit, neg=credit in same field
        }
        For two separate debit/credit fields use mode="two_field" with debit_field/credit_field.
        """
        balance_rules = [r for r in rules if r["rule_type"] == "BALANCE_CHECK"]
        if not balance_rules:
            return []

        errors = []

        for rule in balance_rules:
            cond = rule.get("condition_expression")
            if not cond:
                continue
            try:
                cfg = json.loads(cond)
            except Exception:
                logger.error(f"BALANCE_CHECK: invalid JSON in condition_expression: {cond}")
                continue

            # Support multiple group-by fields (comma-separated or array)
            group_by_raw = cfg.get("group_by_field", "RunGroup")
            if isinstance(group_by_raw, list):
                group_by_fields = group_by_raw
            elif isinstance(group_by_raw, str):
                group_by_fields = [f.strip() for f in group_by_raw.split(",") if f.strip()]
            else:
                group_by_fields = ["RunGroup"]
            
            amount_field = cfg.get("amount_field", "TransactionAmount")
            mode = cfg.get("mode", "single_field")
            debit_field = cfg.get("debit_field", amount_field)
            credit_field = cfg.get("credit_field", amount_field)

            group_totals: Dict[str, float] = {}
            group_rows: Dict[str, int] = {}

            for chunk in StreamingEngine.stream_csv(file_path, chunk_size=1000):
                for record in chunk:
                    row_number = int(record.get("_row_number", 0))
                    mapped = MappingEngine.apply_mapping(record, mapping)

                    # Build composite group key from multiple fields
                    group_parts = []
                    for field in group_by_fields:
                        val = str(mapped.get(field, "")).strip()
                        if not val:
                            break  # Skip if any field is empty
                        group_parts.append(val)
                    
                    if len(group_parts) != len(group_by_fields):
                        continue  # Skip records with incomplete group keys
                    
                    group_val = " | ".join(group_parts)

                    try:
                        if mode == "two_field":
                            net = float(mapped.get(debit_field) or 0) - float(mapped.get(credit_field) or 0)
                        else:
                            net = float(mapped.get(amount_field) or 0)
                    except (ValueError, TypeError):
                        net = 0.0

                    group_totals[group_val] = group_totals.get(group_val, 0.0) + net
                    group_rows[group_val] = row_number

            for group_val, net_total in group_totals.items():
                if abs(round(net_total, 2)) != 0.0:
                    # Display field names in error message
                    field_display = " + ".join(group_by_fields) if len(group_by_fields) > 1 else group_by_fields[0]
                    errors.append({
                        "conversion_job_id": job_id,
                        "row_number": group_rows.get(group_val, 0),
                        "field_name": ", ".join(group_by_fields),  # Store all fields
                        "invalid_value": group_val,
                        "error_type": "balance",
                        "error_message": (
                            rule["error_message"] or
                            f"{field_display} '{group_val}' does not net to zero "
                            f"(net = {round(net_total, 2)})"
                        )
                    })

        return errors

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
        - If no rule set is selected:
          - Check if user has set a custom default (is_user_default=True)
          - If yes, use that
          - If no, use the original Default (is_common=True)
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
                logger.warning(f"Selected rule set {selected_rule_set_id} not found, falling back to default")
        
        # Step 2: If no custom rule set selected (or not found), check for user default
        if not rule_set_to_use:
            # First, check if user has set a custom default
            rule_set_to_use = db.query(ValidationRuleSet).filter(
                ValidationRuleSet.business_class == business_class,
                ValidationRuleSet.is_user_default == True,
                ValidationRuleSet.is_active == True
            ).first()
            
            if rule_set_to_use:
                rule_set_name = rule_set_to_use.name
                logger.info(f"Using user default rule set '{rule_set_name}' for {business_class}")
        
        # Step 3: If no user default, use original Default (is_common=True)
        if not rule_set_to_use:
            rule_set_to_use = db.query(ValidationRuleSet).filter(
                ValidationRuleSet.business_class == business_class,
                ValidationRuleSet.is_common == True,
                ValidationRuleSet.is_active == True
            ).first()
            
            if rule_set_to_use:
                logger.info(f"Using original Default rule set for {business_class}")
            else:
                logger.warning(f"No Default rule set found for {business_class}")
                return []
        
        # Step 4: Get all active rules from the selected rule set
        rule_records = db.query(ValidationRuleTemplate).filter(
            ValidationRuleTemplate.rule_set_id == rule_set_to_use.id,
            ValidationRuleTemplate.is_active == True
        ).all()
        
        logger.info(f"Loaded {len(rule_records)} rules from '{rule_set_name}' rule set")
        
        # Step 5: Convert to dict format
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
    def _persist_errors(db: Session, job_id: int, errors: List[dict]):
        """Persist validation errors to database using bulk insert for performance"""
        if not errors:
            return
        
        for error in errors:
            error['conversion_job_id'] = job_id
        
        db.bulk_insert_mappings(ValidationErrorModel, errors)
        db.commit()
    
    @staticmethod
    def _apply_date_transform(record: Dict, source_format: str) -> Dict:
        """
        Transform date field values from source format to FSM format (YYYYMMDD).
        Operates in-memory only — original CSV files are never modified.
        
        Supported source formats:
        - MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, MM-DD-YYYY, DD-MM-YYYY, M/D/YYYY
        """
        from datetime import datetime as dt
        
        # Map format strings to Python strptime patterns
        format_map = {
            "MM/DD/YYYY": "%m/%d/%Y",
            "DD/MM/YYYY": "%d/%m/%Y",
            "YYYY-MM-DD": "%Y-%m-%d",
            "MM-DD-YYYY": "%m-%d-%Y",
            "DD-MM-YYYY": "%d-%m-%Y",
            "M/D/YYYY": "%m/%d/%Y",  # Python's %m/%d handles single digits too
        }
        
        py_format = format_map.get(source_format)
        if not py_format:
            return record
        
        transformed = {}
        for key, value in record.items():
            if value and isinstance(value, str) and not key.startswith('_'):
                stripped = value.strip()
                # Only attempt transform on values that look like dates (contain / or -)
                if ('/' in stripped or '-' in stripped) and len(stripped) >= 6 and len(stripped) <= 10:
                    try:
                        parsed = dt.strptime(stripped, py_format)
                        transformed[key] = parsed.strftime("%Y%m%d")
                        continue
                    except (ValueError, TypeError):
                        pass
            transformed[key] = value
        
        return transformed
    
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
            "valid_records": job.valid_records,
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
        Export full CSV file with Error Message column appended.
        All rows included: valid rows have blank error message, invalid rows show errors.
        Multiple errors per row are concatenated with semicolons.
        """
        from app.modules.upload.service import UploadService
        
        # Get the original CSV file
        file_path = UploadService.get_file_path(job_id)
        if not file_path.exists():
            logger.error(f"Original CSV file not found for job {job_id}")
            return None
        
        # Get all validation errors for this job
        errors = db.query(ValidationErrorModel).filter(
            ValidationErrorModel.conversion_job_id == job_id
        ).order_by(ValidationErrorModel.row_number, ValidationErrorModel.field_name).all()
        
        # Build error map: row_number -> concatenated error messages
        error_map: Dict[int, str] = {}
        for e in errors:
            error_msg = f"{e.field_name}: {e.error_message}"
            if e.row_number in error_map:
                error_map[e.row_number] += f"; {error_msg}"
            else:
                error_map[e.row_number] = error_msg
        
        logger.info(f"Exporting full CSV with {len(error_map)} error rows for job {job_id}")
        
        # Read original CSV and append Error Message column
        output = io.StringIO()
        try:
            from app.services.streaming_engine import StreamingEngine
            raw = StreamingEngine._read_file(file_path)
            lines = raw.splitlines(keepends=True)
            while lines and not lines[0].strip():
                lines.pop(0)
            while lines and not lines[-1].strip():
                lines.pop()
            
            # Parse CSV
            reader = csv.DictReader(io.StringIO(''.join(lines)))
            
            # Get original fieldnames and add Error Message column
            fieldnames = list(reader.fieldnames or [])
            fieldnames.append('Error Message')
            
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()
            
            # Write all rows with error messages
            row_number = 1
            for row in reader:
                # Add error message if exists, otherwise blank
                row['Error Message'] = error_map.get(row_number, '')
                writer.writerow(row)
                row_number += 1
            
            logger.info(f"Exported {row_number - 1} total rows with error annotations")
        except Exception as e:
            logger.error(f"Error exporting full CSV with errors: {e}")
            return None
        
        return output.getvalue()
