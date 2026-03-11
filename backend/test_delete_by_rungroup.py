"""
Test delete all transactions for RunGroup
"""
import asyncio
import json
from app.services.fsm_client import FSMClient
from app.modules.accounts.service import AccountService
from app.core.database import SessionLocal

async def test_delete_by_rungroup():
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
        
        # Test delete by RunGroup
        run_group = "DATACONVERSION_DEMO_CORRECT"
        business_class = "GLTransactionInterface"
        
        print(f"\nDeleting all transactions for RunGroup: {run_group}")
        print(f"Business Class: {business_class}")
        
        # Construct URL
        url = f"{credentials['base_url']}/{credentials['tenant_id']}/FSM/fsm/soap/ldrest/{business_class}/DeleteAllTransactionsForRunGroup_DeleteAllTransactionsForRunGroupForm_FormOperation"
        print(f"\nURL: {url}")
        print(f"Params: PrmRunGroup={run_group}, _cmAll=true")
        
        try:
            result = await fsm_client.delete_all_transactions_for_run_group(
                business_class,
                run_group
            )
            
            print("\n[OK] Delete successful!")
            print("\nResult:")
            print(json.dumps(result, indent=2))
            
        except Exception as e:
            print(f"\n[ERROR] Delete failed: {e}")
    
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_delete_by_rungroup())
