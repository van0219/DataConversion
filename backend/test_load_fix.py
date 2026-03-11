"""
Test the fixed load functionality with correct FSM batch API format
"""
import asyncio
import sqlite3
import json
from pathlib import Path
from app.services.fsm_client import FSMClient
from app.modules.accounts.service import AccountService
from app.core.database import SessionLocal

async def test_load():
    # Get database session
    db = SessionLocal()
    
    try:
        # Get the most recent account
        from app.models.account import Account
        account = db.query(Account).order_by(Account.created_at.desc()).first()
        
        if not account:
            print("No account found")
            return
        
        print(f"\nUsing account: {account.account_name} (ID: {account.id})")
        
        # Get decrypted credentials
        credentials = AccountService.get_decrypted_credentials(account)
        
        # Initialize FSM client
        fsm_client = FSMClient(
            base_url=credentials["base_url"],
            oauth_url=credentials["oauth_url"],
            tenant_id=credentials["tenant_id"],
            client_id=credentials["client_id"],
            client_secret=credentials["client_secret"],
            saak=credentials["saak"],
            sask=credentials["sask"]
        )
        
        # Authenticate
        print("\nAuthenticating with FSM...")
        await fsm_client.authenticate()
        print("✓ Authentication successful")
        
        # Get sample records from the most recent job
        from app.models.job import ConversionJob
        job = db.query(ConversionJob).filter(
            ConversionJob.account_id == account.id
        ).order_by(ConversionJob.created_at.desc()).first()
        
        if not job:
            print("No job found")
            return
        
        print(f"\nUsing job: {job.id} ({job.business_class})")
        
        # For this test, use 1:1 mapping since CSV columns match FSM field names
        # Read CSV headers to build mapping
        import csv
        csv_path = Path(__file__).parent / "uploads" / f"{job.id}.csv"
        
        if not csv_path.exists():
            print(f"CSV file not found: {csv_path}")
            return
        
        print(f"\nReading sample records from CSV...")
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            sample_records = []
            
            for i, row in enumerate(reader):
                if i >= 2:  # Only take 2 records for testing
                    break
                
                # Use 1:1 mapping (CSV columns already match FSM field names)
                mapped_record = {k: v.strip() if isinstance(v, str) else v for k, v in row.items()}
                sample_records.append(mapped_record)
        
        print(f"✓ Loaded {len(sample_records)} sample records")
        
        # Display sample record
        print("\nSample record (first record):")
        print(json.dumps(sample_records[0], indent=2))
        
        # Test batch create with correct format
        print(f"\nTesting batch create with {len(sample_records)} records...")
        print(f"Endpoint: /api/classes/{job.business_class}/actions/CreateUnreleased/batch")
        
        try:
            result = await fsm_client.batch_create_unreleased(
                job.business_class,
                sample_records,
                trigger_interface=False
            )
            
            print("\n✓ Batch create successful!")
            print(f"Success count: {result.get('successCount', 0)}")
            print(f"Failure count: {result.get('failureCount', 0)}")
            
            # Show first result
            if result.get('results'):
                print("\nFirst result:")
                print(json.dumps(result['results'][0], indent=2))
            
        except Exception as e:
            print(f"\n✗ Batch create failed: {e}")
    
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_load())
