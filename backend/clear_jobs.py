"""
Clear all conversion jobs and related data from the database
"""
from app.core.database import SessionLocal
from app.models.job import ConversionJob, ValidationError, LoadResult

def clear_all_jobs():
    db = SessionLocal()
    try:
        # Delete all validation errors
        deleted_errors = db.query(ValidationError).delete()
        print(f"Deleted {deleted_errors} validation error records")
        
        # Delete all load results
        deleted_results = db.query(LoadResult).delete()
        print(f"Deleted {deleted_results} load result records")
        
        # Delete all conversion jobs
        deleted_jobs = db.query(ConversionJob).delete()
        print(f"Deleted {deleted_jobs} conversion job records")
        
        db.commit()
        print("\n✅ All job records cleared successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error clearing jobs: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    print("Clearing all conversion jobs from database...")
    clear_all_jobs()
