"""
Import Business Class Data from CSV Files

Imports FSM business class metadata from 3 CSV files into business_class_registry table.
"""

import csv
import json
from sqlalchemy.orm import Session
from app.core.database import engine, SessionLocal
from app.models.business_class_registry import BusinessClassRegistry
from app.core.logging import logger


def parse_csv_list(value: str) -> list:
    """Parse comma-separated CSV value into list"""
    if not value or value.strip() == "":
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def infer_table_roles(related_classes: list, business_class: str) -> dict:
    """Infer table roles from naming patterns"""
    roles = {}
    
    for cls in related_classes:
        # Main class is header
        if cls == business_class:
            roles[cls] = "header"
        # Detail/Line classes
        elif "Detail" in cls or "Line" in cls:
            roles[cls] = "lines"
        # Distribution classes
        elif "Distribution" in cls:
            roles[cls] = "distributions"
        # Comment classes
        elif "Comment" in cls:
            roles[cls] = "comments"
        # Error classes
        elif "Error" in cls:
            roles[cls] = "errors"
        # Result classes
        elif "Result" in cls:
            roles[cls] = "results"
        # AddOnCharge/AOC classes
        elif "AddOnCharge" in cls or "AOC" in cls:
            roles[cls] = "charges"
        # Payment classes
        elif "Payment" in cls:
            roles[cls] = "payments"
        # Fund classes
        elif "Fund" in cls:
            roles[cls] = "funds"
        # Options classes
        elif "Options" in cls:
            roles[cls] = "options"
        # Default to header
        else:
            roles[cls] = "header"
    
    return roles


def import_from_enriched_csv(db: Session, file_path: str) -> int:
    """Import from fsm_business_classes_single_multiple_enriched.csv"""
    count = 0
    
    logger.info(f"Reading {file_path}...")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            business_class = row['business_class']
            is_load = row['is_load_business_class'] == 'Y'
            single_or_multiple = row['single_or_multiple']
            
            # Skip non-load classes
            if single_or_multiple == 'non_load':
                continue
            
            # Parse related classes
            related_classes_csv = row.get('related_business_classes_csv', '')
            related_classes = parse_csv_list(related_classes_csv)
            
            # Infer table roles
            table_roles = infer_table_roles(related_classes, business_class) if related_classes else {}
            
            # Create registry entry
            entry = BusinessClassRegistry(
                business_class=business_class,
                description=row.get('description', ''),
                is_load_business_class=is_load,
                single_or_multiple=single_or_multiple,
                load_family_root=row.get('load_family_root') or None,
                family_root_base=row.get('family_root_base') or None,
                naming_pattern=row.get('naming_pattern') or None,
                relationship_role=row.get('relationship_role') or None,
                family_member_count=int(row.get('family_member_count', 0)),
                related_business_classes=related_classes if related_classes else None,
                table_roles=table_roles if table_roles else None
            )
            
            db.add(entry)
            count += 1
            
            if count % 100 == 0:
                logger.info(f"Processed {count} records...")
    
    return count


def import_from_load_csv(db: Session, file_path: str) -> int:
    """Import from fsm_load_business_classes_single_multiple.csv"""
    count = 0
    
    logger.info(f"Reading {file_path}...")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            business_class = row['business_class']
            
            # Check if already exists
            existing = db.query(BusinessClassRegistry).filter(
                BusinessClassRegistry.business_class == business_class
            ).first()
            
            if existing:
                # Update existing record
                existing.is_load_business_class = True
                existing.single_or_multiple = row['single_or_multiple']
                existing.load_family_root = row.get('load_family_root') or None
                existing.family_root_base = row.get('family_root_base') or None
                existing.naming_pattern = row.get('naming_pattern') or None
                existing.relationship_role = row.get('relationship_role') or None
                existing.family_member_count = int(row.get('family_member_count', 0))
                
                # Parse related classes
                related_classes_csv = row.get('related_business_classes_csv', '')
                related_classes = parse_csv_list(related_classes_csv)
                if related_classes:
                    existing.related_business_classes = related_classes
                    existing.table_roles = infer_table_roles(related_classes, business_class)
                
                count += 1
            else:
                # Create new record
                related_classes_csv = row.get('related_business_classes_csv', '')
                related_classes = parse_csv_list(related_classes_csv)
                table_roles = infer_table_roles(related_classes, business_class) if related_classes else {}
                
                entry = BusinessClassRegistry(
                    business_class=business_class,
                    description=row.get('description', ''),
                    is_load_business_class=True,
                    single_or_multiple=row['single_or_multiple'],
                    load_family_root=row.get('load_family_root') or None,
                    family_root_base=row.get('family_root_base') or None,
                    naming_pattern=row.get('naming_pattern') or None,
                    relationship_role=row.get('relationship_role') or None,
                    family_member_count=int(row.get('family_member_count', 0)),
                    related_business_classes=related_classes if related_classes else None,
                    table_roles=table_roles if table_roles else None
                )
                
                db.add(entry)
                count += 1
            
            if count % 50 == 0:
                logger.info(f"Processed {count} records...")
    
    return count


def run_import():
    """Import all CSV files"""
    db = SessionLocal()
    
    try:
        logger.info("Starting business class data import...")
        
        # CSV files are in parent directory
        import os
        parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        # Import from enriched CSV (all business classes)
        enriched_path = os.path.join(parent_dir, 'fsm_business_classes_single_multiple_enriched.csv')
        count1 = import_from_enriched_csv(db, enriched_path)
        db.commit()
        logger.info(f"✅ Imported {count1} records from enriched CSV")
        
        # Import from load CSV (load business classes only)
        load_path = os.path.join(parent_dir, 'fsm_load_business_classes_single_multiple.csv')
        count2 = import_from_load_csv(db, load_path)
        db.commit()
        logger.info(f"✅ Updated/added {count2} load business class records")
        
        # Summary
        total = db.query(BusinessClassRegistry).count()
        single_count = db.query(BusinessClassRegistry).filter(
            BusinessClassRegistry.single_or_multiple == 'single'
        ).count()
        multiple_count = db.query(BusinessClassRegistry).filter(
            BusinessClassRegistry.single_or_multiple == 'multiple'
        ).count()
        
        logger.info(f"\n📊 Import Summary:")
        logger.info(f"   Total records: {total}")
        logger.info(f"   Single table: {single_count}")
        logger.info(f"   Multiple tables: {multiple_count}")
        
        return True
        
    except Exception as e:
        logger.error(f"Import failed: {e}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    success = run_import()
    if success:
        print("\n✅ Import completed successfully")
        print("Next step: Test auto-detection with sample CSV files")
    else:
        print("\n❌ Import failed")
