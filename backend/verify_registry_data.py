"""
Verify Business Class Registry Data

Quick script to verify the imported data.
"""

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.business_class_registry import BusinessClassRegistry
from app.core.logging import logger


def verify_data():
    """Verify imported data"""
    db = SessionLocal()
    
    try:
        # Total count
        total = db.query(BusinessClassRegistry).count()
        print(f"\n📊 Registry Statistics:")
        print(f"   Total records: {total}")
        
        # By structure type
        single_count = db.query(BusinessClassRegistry).filter(
            BusinessClassRegistry.single_or_multiple == 'single'
        ).count()
        multiple_count = db.query(BusinessClassRegistry).filter(
            BusinessClassRegistry.single_or_multiple == 'multiple'
        ).count()
        non_load_count = db.query(BusinessClassRegistry).filter(
            BusinessClassRegistry.single_or_multiple == 'non_load'
        ).count()
        
        print(f"\n📋 By Structure Type:")
        print(f"   Single table: {single_count}")
        print(f"   Multiple tables: {multiple_count}")
        print(f"   Non-load: {non_load_count}")
        
        # Load business classes
        load_count = db.query(BusinessClassRegistry).filter(
            BusinessClassRegistry.is_load_business_class == True
        ).count()
        print(f"\n✅ Load Business Classes: {load_count}")
        
        # Sample single table class
        print(f"\n📄 Sample Single Table Class:")
        single_sample = db.query(BusinessClassRegistry).filter(
            BusinessClassRegistry.business_class == 'GLTransactionInterface'
        ).first()
        if single_sample:
            print(f"   Class: {single_sample.business_class}")
            print(f"   Type: {single_sample.single_or_multiple}")
            print(f"   Family: {single_sample.load_family_root}")
            print(f"   Members: {single_sample.family_member_count}")
        
        # Sample multiple table class
        print(f"\n📑 Sample Multiple Table Class:")
        multiple_sample = db.query(BusinessClassRegistry).filter(
            BusinessClassRegistry.business_class == 'PayablesInvoiceImport'
        ).first()
        if multiple_sample:
            print(f"   Class: {multiple_sample.business_class}")
            print(f"   Type: {multiple_sample.single_or_multiple}")
            print(f"   Family: {multiple_sample.load_family_root}")
            print(f"   Members: {multiple_sample.family_member_count}")
            print(f"   Related: {multiple_sample.related_business_classes}")
            print(f"   Roles: {multiple_sample.table_roles}")
        
        # Top 5 largest families
        print(f"\n🏆 Top 5 Largest Families:")
        largest = db.query(BusinessClassRegistry).filter(
            BusinessClassRegistry.single_or_multiple == 'multiple'
        ).order_by(
            BusinessClassRegistry.family_member_count.desc()
        ).limit(5).all()
        
        for i, cls in enumerate(largest, 1):
            print(f"   {i}. {cls.business_class}: {cls.family_member_count} tables")
        
        print(f"\n✅ Data verification complete!")
        
    finally:
        db.close()


if __name__ == "__main__":
    verify_data()
