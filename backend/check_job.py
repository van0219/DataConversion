from app.core.database import SessionLocal
from app.models.job import ConversionJob

db = SessionLocal()
job = db.query(ConversionJob).filter(ConversionJob.id == 44).first()
if job:
    print(f"Job 44 filename: {job.filename}")
else:
    print("Job 44 not found")
db.close()
