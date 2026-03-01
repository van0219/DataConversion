#!/usr/bin/env python3
"""
Migration: Add setup_business_classes table and seed with 16 FSM setup classes.
"""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import engine, SessionLocal, Base
from app.models.setup_business_class import SetupBusinessClass
from sqlalchemy import inspect

def migrate():
    """Add setup_business_classes table and seed data"""
    print("=" * 80)
    print("Migration: Add setup_business_classes table")
    print("=" * 80)
    
    # Check if table exists
    inspector = inspect(engine)
    if "setup_business_classes" in inspector.get_table_names():
        print("\n✓ Table 'setup_business_classes' already exists")
        
        # Check if data exists
        db = SessionLocal()
        count = db.query(SetupBusinessClass).count()
        db.close()
        
        if count > 0:
            print(f"✓ Table already has {count} entries")
            print("\nMigration already applied. Skipping.")
            return
        else:
            print("⚠ Table exists but is empty. Seeding data...")
    else:
        print("\n✓ Creating table 'setup_business_classes'...")
        Base.metadata.create_all(bind=engine, tables=[SetupBusinessClass.__table__])
        print("✓ Table created successfully")
    
    # Seed data with 16 FSM setup business classes
    print("\n" + "=" * 80)
    print("Seeding Setup Business Classes")
    print("=" * 80)
    
    setup_classes = [
        {
            "name": "GeneralLedgerChartAccount",
            "endpoint_url": "soap/classes/GeneralLedgerChartAccount/lists/DetailAccountList?_fields=DisplayAccount,AccountingEntity&_links=false&_pageNav=false&_flatten=false&_limit=100000&_out=JSON",
            "key_field": "DisplayAccount",
            "is_active": True
        },
        {
            "name": "AccountingEntity",
            "endpoint_url": "soap/classes/AccountingEntity/lists/PrimaryAccountingEntityList?_fields=AccountingEntity&_links=false&_pageNav=false&_flatten=false&_limit=100000&_out=JSON",
            "key_field": "AccountingEntity",
            "is_active": True
        },
        {
            "name": "Ledger",
            "endpoint_url": "soap/classes/Ledger/lists/PrimaryLedgerList?_fields=Ledger&_links=false&_pageNav=false&_flatten=false&_limit=100000&_out=JSON",
            "key_field": "Ledger",
            "is_active": True
        },
        {
            "name": "Currency",
            "endpoint_url": "soap/classes/Currency/lists/PrimaryCurrencyList?_fields=Currency&_links=false&_pageNav=false&_flatten=false&_limit=100000&_out=JSON",
            "key_field": "Currency",
            "is_active": True
        },
        {
            "name": "FinanceEnterpriseGroup",
            "endpoint_url": "soap/classes/FinanceEnterpriseGroup/lists/PrimaryFinanceEnterpriseGroupList?_fields=FinanceEnterpriseGroup&_links=false&_pageNav=false&_flatten=false&_limit=100000&_out=JSON",
            "key_field": "FinanceEnterpriseGroup",
            "is_active": True
        },
        {
            "name": "JournalCode",
            "endpoint_url": "soap/classes/JournalCode/lists/PrimaryJournalCodeList?_fields=JournalCode&_links=false&_pageNav=false&_flatten=false&_limit=100000&_out=JSON",
            "key_field": "JournalCode",
            "is_active": True
        },
        {
            "name": "Vendor",
            "endpoint_url": "soap/classes/Vendor/lists/PrimaryVendorList?_fields=Vendor&_links=false&_pageNav=false&_flatten=false&_limit=100000&_out=JSON",
            "key_field": "Vendor",
            "is_active": True
        },
        {
            "name": "VendorGroup",
            "endpoint_url": "soap/classes/VendorGroup/lists/PrimaryVendorGroupList?_fields=VendorGroup&_links=false&_pageNav=false&_flatten=false&_limit=100000&_out=JSON",
            "key_field": "VendorGroup",
            "is_active": True
        },
        {
            "name": "Customer",
            "endpoint_url": "soap/classes/Customer/lists/PrimaryCustomerList?_fields=Customer&_links=false&_pageNav=false&_flatten=false&_limit=100000&_out=JSON",
            "key_field": "Customer",
            "is_active": True
        },
        {
            "name": "CustomerGroup",
            "endpoint_url": "soap/classes/CustomerGroup/lists/PrimaryCustomerGroupList?_fields=CustomerGroup&_links=false&_pageNav=false&_flatten=false&_limit=100000&_out=JSON",
            "key_field": "CustomerGroup",
            "is_active": True
        },
        {
            "name": "Item",
            "endpoint_url": "soap/classes/Item/lists/PrimaryItemList?_fields=Item&_links=false&_pageNav=false&_flatten=false&_limit=100000&_out=JSON",
            "key_field": "Item",
            "is_active": True
        },
        {
            "name": "ItemGroup",
            "endpoint_url": "soap/classes/ItemGroup/lists/PrimaryItemGroupList?_fields=ItemGroup&_links=false&_pageNav=false&_flatten=false&_limit=100000&_out=JSON",
            "key_field": "ItemGroup",
            "is_active": True
        },
        {
            "name": "Location",
            "endpoint_url": "soap/classes/Location/lists/PrimaryLocationList?_fields=Location&_links=false&_pageNav=false&_flatten=false&_limit=100000&_out=JSON",
            "key_field": "Location",
            "is_active": True
        },
        {
            "name": "Warehouse",
            "endpoint_url": "soap/classes/Warehouse/lists/PrimaryWarehouseList?_fields=Warehouse&_links=false&_pageNav=false&_flatten=false&_limit=100000&_out=JSON",
            "key_field": "Warehouse",
            "is_active": True
        },
        {
            "name": "PaymentTerms",
            "endpoint_url": "soap/classes/PaymentTerms/lists/PrimaryPaymentTermsList?_fields=PaymentTerms&_links=false&_pageNav=false&_flatten=false&_limit=100000&_out=JSON",
            "key_field": "PaymentTerms",
            "is_active": True
        },
        {
            "name": "TaxCode",
            "endpoint_url": "soap/classes/TaxCode/lists/PrimaryTaxCodeList?_fields=TaxCode&_links=false&_pageNav=false&_flatten=false&_limit=100000&_out=JSON",
            "key_field": "TaxCode",
            "is_active": True
        }
    ]
    
    db = SessionLocal()
    
    try:
        for setup_class in setup_classes:
            entry = SetupBusinessClass(**setup_class)
            db.add(entry)
            print(f"✓ Added: {setup_class['name']}")
        
        db.commit()
        print(f"\n✓ Successfully seeded {len(setup_classes)} setup business classes")
        
    except Exception as e:
        db.rollback()
        print(f"\n✗ Error seeding data: {e}")
        raise
    finally:
        db.close()
    
    print("\n" + "=" * 80)
    print("Migration Complete")
    print("=" * 80)

if __name__ == "__main__":
    migrate()
