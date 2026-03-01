from sqlalchemy.orm import Session
from typing import Optional, List
from app.models.account import Account
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token
from app.utils.encryption import encryption
from datetime import timedelta

class AccountService:
    @staticmethod
    def create_account(
        db: Session,
        account_name: str,
        project_name: str,
        tenant_id: str,
        base_url: str,
        oauth_url: str,
        client_id: str,
        client_secret: str,
        saak: str,
        sask: str,
        username: str,
        password: str
    ) -> Account:
        """Create new account with encrypted FSM credentials"""
        # Encrypt FSM OAuth credentials
        client_id_encrypted = encryption.encrypt(client_id)
        client_secret_encrypted = encryption.encrypt(client_secret)
        saak_encrypted = encryption.encrypt(saak)
        sask_encrypted = encryption.encrypt(sask)
        
        # Hash password
        password_hash = hash_password(password)
        
        account = Account(
            account_name=account_name,
            project_name=project_name,
            tenant_id=tenant_id,
            base_url=base_url,
            oauth_url=oauth_url,
            client_id_encrypted=client_id_encrypted,
            client_secret_encrypted=client_secret_encrypted,
            saak_encrypted=saak_encrypted,
            sask_encrypted=sask_encrypted,
            username=username,
            password_hash=password_hash
        )
        
        db.add(account)
        db.commit()
        db.refresh(account)
        return account
    
    @staticmethod
    def authenticate(db: Session, account_name: str, password: str) -> Optional[dict]:
        """Authenticate account and return JWT tokens"""
        account = db.query(Account).filter(Account.account_name == account_name).first()
        
        if not account:
            return None
        
        if not verify_password(password, account.password_hash):
            return None
        
        # Create JWT tokens
        token_data = {
            "sub": str(account.id),
            "account_name": account.account_name,
            "account_id": account.id
        }
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token
        }
    
    @staticmethod
    def authenticate_account(db: Session, account_name: str, password: str) -> Optional[Account]:
        """Authenticate account and return Account object (for compatibility)"""
        account = db.query(Account).filter(Account.account_name == account_name).first()
        
        if not account:
            return None
        
        if not verify_password(password, account.password_hash):
            return None
        
        return account
    
    @staticmethod
    def get_account_by_id(db: Session, account_id: int) -> Optional[Account]:
        """Get account by ID"""
        return db.query(Account).filter(Account.id == account_id).first()
    
    @staticmethod
    def get_account_by_name(db: Session, account_name: str) -> Optional[Account]:
        """Get account by name"""
        return db.query(Account).filter(Account.account_name == account_name).first()
    
    @staticmethod
    def list_accounts(db: Session) -> List[Account]:
        """List all accounts (for login dropdown)"""
        return db.query(Account).order_by(Account.account_name).all()
    
    @staticmethod
    def get_decrypted_credentials(account: Account) -> dict:
        """Decrypt FSM OAuth credentials"""
        return {
            "client_id": encryption.decrypt(account.client_id_encrypted),
            "client_secret": encryption.decrypt(account.client_secret_encrypted),
            "saak": encryption.decrypt(account.saak_encrypted),
            "sask": encryption.decrypt(account.sask_encrypted),
            "base_url": account.base_url,
            "oauth_url": account.oauth_url,
            "tenant_id": account.tenant_id
        }
    
    @staticmethod
    def update_account(
        db: Session,
        account_id: int,
        project_name: Optional[str] = None,
        tenant_id: Optional[str] = None,
        base_url: Optional[str] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        password: Optional[str] = None
    ) -> Optional[Account]:
        """Update account details"""
        account = db.query(Account).filter(Account.id == account_id).first()
        if not account:
            return None
        
        if project_name:
            account.project_name = project_name
        if tenant_id:
            account.tenant_id = tenant_id
        if base_url:
            account.base_url = base_url
        if client_id:
            account.client_id_encrypted = encryption.encrypt(client_id)
        if client_secret:
            account.client_secret_encrypted = encryption.encrypt(client_secret)
        if password:
            account.password_hash = hash_password(password)
        
        db.commit()
        db.refresh(account)
        return account
    
    @staticmethod
    def delete_account(db: Session, account_id: int) -> bool:
        """Delete account"""
        account = db.query(Account).filter(Account.id == account_id).first()
        if not account:
            return False
        
        db.delete(account)
        db.commit()
        return True
