from sqlalchemy.orm import Session
from fastapi import UploadFile
from typing import Dict, Optional
from pathlib import Path
import shutil
from app.models.job import ConversionJob
from app.services.streaming_engine import StreamingEngine
from app.core.logging import logger

class UploadService:
    # Upload directory
    UPLOAD_DIR = Path("uploads")
    
    @classmethod
    def _ensure_upload_dir(cls):
        """Ensure upload directory exists"""
        cls.UPLOAD_DIR.mkdir(exist_ok=True)
    
    @staticmethod
    async def handle_upload(
        db: Session,
        account_id: int,
        file: UploadFile,
        business_class: Optional[str] = None
    ) -> Dict:
        """
        Handle file upload and create conversion job.
        Stores file temporarily and extracts metadata.
        """
        UploadService._ensure_upload_dir()
        
        # Create conversion job first to get job_id
        job = ConversionJob(
            account_id=account_id,
            business_class=business_class or "Unknown",
            filename=file.filename,
            total_records=0,  # Will update after processing
            status="pending"
        )
        
        db.add(job)
        db.commit()
        db.refresh(job)
        
        # Save file with job_id as filename
        file_extension = Path(file.filename).suffix
        stored_filename = f"{job.id}{file_extension}"
        file_path = UploadService.UPLOAD_DIR / stored_filename
        
        # Save uploaded file
        logger.info(f"Saving uploaded file: {file.filename} -> {stored_filename}")
        with open(file_path, 'wb') as f:
            shutil.copyfileobj(file.file, f)
        
        # Get file metadata
        headers = StreamingEngine.get_csv_headers(file_path)
        estimated_records = StreamingEngine.estimate_record_count(file_path)
        sample_records = StreamingEngine.get_sample_records(file_path, sample_size=5)
        
        logger.info(f"File metadata: {len(headers)} columns, ~{estimated_records} records")
        
        # Auto-detect business class from filename if not provided
        if not business_class:
            business_class = UploadService._detect_business_class(file.filename)
            job.business_class = business_class or "Unknown"
        
        # Update job with metadata
        job.total_records = estimated_records
        db.commit()
        
        logger.info(f"Created conversion job {job.id} for {file.filename}")
        
        return {
            "job_id": job.id,
            "filename": file.filename,
            "business_class": business_class,
            "estimated_records": estimated_records,
            "headers": headers,
            "sample_records": sample_records
        }
    
    @staticmethod
    def _detect_business_class(filename: str) -> Optional[str]:
        """
        Auto-detect business class from filename.
        Example: GLTransactionInterface_20251128.csv -> GLTransactionInterface
        """
        # Common business class patterns
        business_classes = [
            "GLTransactionInterface",
            "PayablesInvoice",
            "Vendor",
            "Customer",
            "GeneralLedgerChartAccount",
            "AccountingEntity",
            "Ledger",
            "Currency",
            "FinanceEnterpriseGroup"
        ]
        
        filename_upper = filename.upper()
        
        for bc in business_classes:
            if bc.upper() in filename_upper:
                logger.info(f"Auto-detected business class: {bc}")
                return bc
        
        logger.warning(f"Could not auto-detect business class from filename: {filename}")
        return None
    
    @staticmethod
    def get_file_info(db: Session, account_id: int, job_id: int) -> Optional[Dict]:
        """Get file information for a job"""
        job = db.query(ConversionJob).filter(
            ConversionJob.id == job_id,
            ConversionJob.account_id == account_id
        ).first()
        
        if not job:
            return None
        
        # Reconstruct file path
        file_path = UploadService.UPLOAD_DIR / f"{job_id}.csv"
        
        if not file_path.exists():
            return None
        
        headers = StreamingEngine.get_csv_headers(file_path)
        
        return {
            "job_id": job.id,
            "filename": job.filename,
            "business_class": job.business_class,
            "total_records": job.total_records,
            "headers": headers,
            "status": job.status
        }
    
    @staticmethod
    def get_file_path(job_id: int) -> Path:
        """Get file path for a job"""
        UploadService._ensure_upload_dir()
        
        # Try to find the file with any extension
        for ext in ['.csv', '.CSV']:
            file_path = UploadService.UPLOAD_DIR / f"{job_id}{ext}"
            if file_path.exists():
                return file_path
        
        # If not found, return the expected path (will fail later if doesn't exist)
        return UploadService.UPLOAD_DIR / f"{job_id}.csv"
