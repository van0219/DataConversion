"""
Database Migration: Add business_class_registry table

Creates the business_class_registry table to store FSM business class metadata
for auto-detection of single vs multiple table structures.
"""

from sqlalchemy import create_engine, Column, Integer, String, Boolean, JSON, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.logging import logger

# Create engine
engine = create_engine(settings.DATABASE_URL)
Session = sessionmaker(bind=engine)
Base = declarative_base()


class BusinessClassRegistry(Base):
    """Business class registry table definition"""
    __tablename__ = "business_class_registry"
    
    id = Column(Integer, primary_key=True, index=True)
    business_class = Column(String(200), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_load_business_class = Column(Boolean, default=False, nullable=False)
    single_or_multiple = Column(String(20), nullable=False)  # 'single', 'multiple', 'non_load'
    load_family_root = Column(String(200), nullable=True, index=True)
    family_root_base = Column(String(200), nullable=True)
    naming_pattern = Column(String(50), nullable=True)  # 'Import', 'Interface', etc.
    relationship_role = Column(String(50), nullable=True)  # 'header', 'lines', 'distributions', etc.
    family_member_count = Column(Integer, default=0)
    related_business_classes = Column(JSON, nullable=True)  # List of related class names
    table_roles = Column(JSON, nullable=True)  # Dict mapping class name to role


def run_migration():
    """Create business_class_registry table"""
    try:
        logger.info("Creating business_class_registry table...")
        
        # Create table
        Base.metadata.create_all(engine, tables=[BusinessClassRegistry.__table__])
        
        logger.info("✅ business_class_registry table created successfully")
        
        # Verify table exists
        session = Session()
        try:
            count = session.query(BusinessClassRegistry).count()
            logger.info(f"Table verified: {count} records")
        finally:
            session.close()
        
        return True
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        return False


if __name__ == "__main__":
    success = run_migration()
    if success:
        print("\n✅ Migration completed successfully")
        print("Next step: Run import_business_class_data.py to populate the table")
    else:
        print("\n❌ Migration failed")
