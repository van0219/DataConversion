"""
Test with the exact working data format from user
"""
import asyncio
import json
from app.services.fsm_client import FSMClient
from app.modules.accounts.service import AccountService
from app.core.database import SessionLocal

async def test_with_working_data():
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
        
        # Use exact working data from user's example (first 2 records)
        working_records = [
            {
                "AccountCode": "30005",
                "AccountingEntity": "28",
                "AutoReverseReference": "0",
                "Description": "ACH Disbursements",
                "FinanceDimension1": "13",
                "FinanceDimension3": "2899",
                "FinanceDimension4": "1000",
                "FinanceEnterpriseGroup": "FCE",
                "GeneralLedgerEvent": "JE",
                "GLTransactionInterface.RunGroup": "Empower_GlTransrel_XCEBCC_Van",
                "GLTransactionInterface.SequenceNumber": "1",
                "PostingDate": "20240402",
                "Project": "",
                "System": "E1",
                "ToAccountingEntity": "11",
                "TransactionAmount": "-375.00",
                "TransactionDate": "20240402"
            },
            {
                "AccountCode": "36050",
                "AccountingEntity": "28",
                "AutoReverseReference": "0",
                "Description": "ACH Receipts",
                "FinanceDimension1": "40",
                "FinanceDimension3": "2830",
                "FinanceDimension4": "1000",
                "FinanceEnterpriseGroup": "FCE",
                "GeneralLedgerEvent": "JE",
                "GLTransactionInterface.RunGroup": "Empower_GlTransrel_XCEBCC_Van",
                "GLTransactionInterface.SequenceNumber": "2",
                "PostingDate": "20240402",
                "Project": "",
                "System": "E1",
                "ToAccountingEntity": "28",
                "TransactionAmount": "375.00",
                "TransactionDate": "20240402"
            }
        ]
        
        print(f"\nTesting with working data format (2 records)...")
        print(f"Endpoint: /api/classes/GLTransactionInterface/actions/CreateUnreleased/batch")
        
        try:
            result = await fsm_client.batch_create_unreleased(
                "GLTransactionInterface",
                working_records,
                trigger_interface=False
            )
            
            print("\n[OK] Batch create successful!")
            print(f"Success count: {result.get('successCount', 0)}")
            print(f"Failure count: {result.get('failureCount', 0)}")
            
            # Show first result
            if result.get('results'):
                print("\nFirst result:")
                print(json.dumps(result['results'][0], indent=2))
            
        except Exception as e:
            print(f"\n[ERROR] Batch create failed: {e}")
    
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_with_working_data())
