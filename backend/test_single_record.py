"""
Test single record creation (non-batch endpoint)
"""
import asyncio
import json
from pathlib import Path
from app.services.fsm_client import FSMClient
from app.modules.accounts.service import AccountService
from app.core.database import SessionLocal

async def test_single_record():
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
        print("[OK] Authentication successful")
        
        # Get sample record from the most recent job
        from app.models.job import ConversionJob
        job = db.query(ConversionJob).filter(
            ConversionJob.account_id == account.id
        ).order_by(ConversionJob.created_at.desc()).first()
        
        if not job:
            print("No job found")
            return
        
        print(f"\nUsing job: {job.id} ({job.business_class})")
        
        # Read first record from CSV
        import csv
        csv_path = Path(__file__).parent / "uploads" / f"{job.id}.csv"
        
        if not csv_path.exists():
            print(f"CSV file not found: {csv_path}")
            return
        
        print(f"\nReading first record from CSV...")
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            first_row = next(reader)
            
            # Use 1:1 mapping (CSV columns already match FSM field names)
            sample_record = {k: v.strip() if isinstance(v, str) else v for k, v in first_row.items()}
        
        print(f"[OK] Loaded sample record")
        
        # Display sample record
        print("\nSample record:")
        print(json.dumps(sample_record, indent=2))
        
        # Test single record create
        print(f"\nTesting single record create...")
        print(f"Endpoint: /api/classes/{job.business_class}/actions/CreateUnreleased")
        
        try:
            result = await fsm_client.create_unreleased_single(
                job.business_class,
                sample_record
            )
            
            print("\n[OK] Single record create successful!")
            print("\nResult:")
            print(json.dumps(result, indent=2))
            
        except Exception as e:
            print(f"\n[ERROR] Single record create failed: {e}")
    
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_single_record())
