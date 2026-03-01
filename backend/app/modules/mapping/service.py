from sqlalchemy.orm import Session
from typing import Dict, List
from app.models.mapping import MappingTemplate
from app.models.job import ConversionJob
from app.services.mapping_engine import MappingEngine
from app.modules.schema.service import SchemaService
from app.modules.upload.service import UploadService
from app.services.streaming_engine import StreamingEngine
from app.core.logging import logger
import json

class MappingService:
    @staticmethod
    async def auto_map(
        db: Session,
        account_id: int,
        job_id: int,
        business_class: str
    ) -> Dict:
        """
        Auto-map CSV columns to FSM fields for a job.
        Returns mapping with confidence scores and validation.
        """
        # Get job
        job = db.query(ConversionJob).filter(
            ConversionJob.id == job_id,
            ConversionJob.account_id == account_id
        ).first()
        
        if not job:
            raise ValueError("Job not found")
        
        # Get CSV headers
        file_path = UploadService.get_file_path(job_id)
        csv_headers = StreamingEngine.get_csv_headers(file_path)
        
        # Get latest schema
        schema = SchemaService.get_latest_schema(db, account_id, business_class)
        
        if not schema:
            raise ValueError(f"No schema found for {business_class}. Please fetch schema first.")
        
        parsed_schema = SchemaService.get_parsed_schema(schema)
        fsm_fields = [field["name"] for field in parsed_schema["fields"]]
        required_fields = [field["name"] for field in parsed_schema["fields"] if field["required"]]
        
        # Perform auto-mapping
        mapping = MappingEngine.auto_map_fields(csv_headers, fsm_fields)
        
        # Validate mapping
        validation = MappingEngine.validate_mapping(mapping, required_fields)
        
        logger.info(f"Auto-mapping complete for job {job_id}: {validation['mapped_fields_count']} fields mapped")
        
        return {
            "job_id": job_id,
            "business_class": business_class,
            "mapping": mapping,
            "validation": validation,
            "schema_version": schema.version_number
        }
    
    @staticmethod
    def save_template(
        db: Session,
        account_id: int,
        business_class: str,
        template_name: str,
        mapping: Dict,
        schema_version: int
    ) -> MappingTemplate:
        """Save mapping configuration as reusable template"""
        # Check if template already exists
        existing = db.query(MappingTemplate).filter(
            MappingTemplate.account_id == account_id,
            MappingTemplate.business_class == business_class,
            MappingTemplate.template_name == template_name
        ).first()
        
        if existing:
            # Update existing
            existing.mapping_json = json.dumps(mapping)
            existing.schema_version = schema_version
            existing.is_valid = True
            db.commit()
            db.refresh(existing)
            logger.info(f"Updated mapping template: {template_name}")
            return existing
        else:
            # Create new
            template = MappingTemplate(
                account_id=account_id,
                business_class=business_class,
                template_name=template_name,
                mapping_json=json.dumps(mapping),
                schema_version=schema_version,
                is_valid=True
            )
            db.add(template)
            db.commit()
            db.refresh(template)
            logger.info(f"Created mapping template: {template_name}")
            return template
    
    @staticmethod
    def list_templates(
        db: Session,
        account_id: int,
        business_class: str
    ) -> List[MappingTemplate]:
        """List all mapping templates for business class"""
        return db.query(MappingTemplate).filter(
            MappingTemplate.account_id == account_id,
            MappingTemplate.business_class == business_class
        ).order_by(MappingTemplate.template_name).all()
    
    @staticmethod
    def get_template(
        db: Session,
        account_id: int,
        template_id: int
    ) -> MappingTemplate:
        """Get mapping template by ID"""
        return db.query(MappingTemplate).filter(
            MappingTemplate.id == template_id,
            MappingTemplate.account_id == account_id
        ).first()
