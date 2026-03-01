#!/usr/bin/env python3
"""
Migration: Update setup_business_classes with correct 13 business classes
based on available swagger files and correct API endpoints.
"""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import engine, SessionLocal, Base
from app.models.setup_business_class import SetupBusinessClass

def migrate():
    """Update setup_business_classes with correct 13 classes"""
    print("=" * 80)
    print("Migration: Update setup_business_classes")
    print("=" * 80)
    
    db = SessionLocal()
    
    try:
        # Delete all existing entries
        print("\n✓ Clearing existing setup business classes...")
        db.query(SetupBusinessClass).delete()
        db.commit()
        
        # Seed with correct 13 classes based on available swagger files
        print("\n" + "=" * 80)
        print("Seeding 13 Setup Business Classes")
        print("=" * 80)
        
        setup_classes = [
            {
                "name": "GeneralLedgerChartAccount",
                "endpoint_url": "soap/classes/GeneralLedgerChartAccount/lists/DetailAccountList?_fields=DisplayAccount,AccountDescription,ChartSection,AccountType,AccountSubType,AccountSubType.Description,ChartType,SystemAccount,Active&_limit=100000&_links=false&_pageNav=false&_out=JSON&_flatten=false",
                "key_field": "DisplayAccount",
                "is_active": True
            },
            {
                "name": "AccountingEntity",
                "endpoint_url": "soap/classes/AccountingEntity/lists/PrimaryAccountingEntityList?_fields=AccountingEntity,Description,Active&_limit=100000&_links=false&_pageNav=false&_out=JSON&_flatten=false",
                "key_field": "AccountingEntity",
                "is_active": True
            },
            {
                "name": "Ledger",
                "endpoint_url": "soap/classes/Ledger/lists/PrimaryLedgerList?_fields=Ledger,Description,Active&_limit=100000&_links=false&_pageNav=false&_out=JSON&_flatten=false",
                "key_field": "Ledger",
                "is_active": True
            },
            {
                "name": "Currency",
                "endpoint_url": "soap/classes/Currency/lists/PrimaryCurrencyList?_fields=Currency,Description,Active&_limit=100000&_links=false&_pageNav=false&_out=JSON&_flatten=false",
                "key_field": "Currency",
                "is_active": True
            },
            {
                "name": "FinanceEnterpriseGroup",
                "endpoint_url": "soap/classes/FinanceEnterpriseGroup/lists/PrimaryFinanceEnterpriseGroupList?_fields=FinanceEnterpriseGroup,Description,Active&_limit=100000&_links=false&_pageNav=false&_out=JSON&_flatten=false",
                "key_field": "FinanceEnterpriseGroup",
                "is_active": True
            },
            {
                "name": "Account",
                "endpoint_url": "soap/classes/Account/lists/PrimaryAccountList?_fields=Account,Description,Active&_limit=100000&_links=false&_pageNav=false&_out=JSON&_flatten=false",
                "key_field": "Account",
                "is_active": True
            },
            {
                "name": "FinanceDimension1",
                "endpoint_url": "soap/classes/FinanceDimension1/lists/PrimaryFinanceDimension1List?_fields=FinanceDimension1,Description,Active&_limit=100000&_links=false&_pageNav=false&_out=JSON&_flatten=false",
                "key_field": "FinanceDimension1",
                "is_active": True
            },
            {
                "name": "FinanceDimension2",
                "endpoint_url": "soap/classes/FinanceDimension2/lists/PrimaryFinanceDimension2List?_fields=FinanceDimension2,Description,Active&_limit=100000&_links=false&_pageNav=false&_out=JSON&_flatten=false",
                "key_field": "FinanceDimension2",
                "is_active": True
            },
            {
                "name": "FinanceDimension3",
                "endpoint_url": "soap/classes/FinanceDimension3/lists/PrimaryFinanceDimension3List?_fields=FinanceDimension3,Description,Active&_limit=100000&_links=false&_pageNav=false&_out=JSON&_flatten=false",
                "key_field": "FinanceDimension3",
                "is_active": True
            },
            {
                "name": "FinanceDimension4",
                "endpoint_url": "soap/classes/FinanceDimension4/lists/PrimaryFinanceDimension4List?_fields=FinanceDimension4,Description,Active&_limit=100000&_links=false&_pageNav=false&_out=JSON&_flatten=false",
                "key_field": "FinanceDimension4",
                "is_active": True
            },
            {
                "name": "FinanceDimension5",
                "endpoint_url": "soap/classes/FinanceDimension5/lists/PrimaryFinanceDimension5List?_fields=FinanceDimension5,Description,Active&_limit=100000&_links=false&_pageNav=false&_out=JSON&_flatten=false",
                "key_field": "FinanceDimension5",
                "is_active": True
            },
            {
                "name": "Project",
                "endpoint_url": "soap/classes/Project/lists/PrimaryProjectList?_fields=Project,Description,Active&_limit=100000&_links=false&_pageNav=false&_out=JSON&_flatten=false",
                "key_field": "Project",
                "is_active": True
            }
        ]
        
        for setup_class in setup_classes:
            entry = SetupBusinessClass(**setup_class)
            db.add(entry)
            status = "Active" if setup_class["is_active"] else "Inactive"
            print(f"✓ Added: {setup_class['name']:30} - {status}")
        
        db.commit()
        print(f"\n✓ Successfully updated with {len(setup_classes)} setup business classes")
        print(f"✓ All 12 classes are active reference data classes")
        
    except Exception as e:
        db.rollback()
        print(f"\n✗ Error updating data: {e}")
        raise
    finally:
        db.close()
    
    print("\n" + "=" * 80)
    print("Migration Complete")
    print("=" * 80)
    print("\nNOTE: All 12 business classes are reference data classes")
    print("      GLTransactionInterface excluded (staging/transaction table)")
    print("      All classes match available swagger files in FSM_Swagger/")

if __name__ == "__main__":
    migrate()
