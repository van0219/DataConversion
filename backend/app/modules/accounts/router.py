from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import decode_access_token
from app.modules.accounts.service import AccountService
from app.modules.accounts.schemas import (
    AccountCreate,
    AccountLogin,
    AccountResponse,
    AccountListItem,
    LoginResponse,
    AccountUpdate
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

router = APIRouter()
security = HTTPBearer()

def get_current_account_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> int:
    """Dependency to get current authenticated account ID from JWT"""
    token = credentials.credentials
    payload = decode_access_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    account_id = payload.get("account_id")
    if not account_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    
    return account_id

@router.post("/login", response_model=LoginResponse)
def login(login_data: AccountLogin, db: Session = Depends(get_db)):
    """Authenticate account and return JWT token"""
    access_token = AccountService.authenticate(
        db,
        login_data.account_name,
        login_data.password
    )
    
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid account name or password"
        )
    
    account = AccountService.get_account_by_name(db, login_data.account_name)
    
    return LoginResponse(
        access_token=access_token,
        account=AccountResponse.from_orm(account)
    )

@router.post("/", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
def create_account(account_data: AccountCreate, db: Session = Depends(get_db)):
    """Create new account"""
    # Check if account name already exists
    existing = AccountService.get_account_by_name(db, account_data.account_name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account name already exists"
        )
    
    try:
        account = AccountService.create_account(
            db,
            account_name=account_data.account_name,
            project_name=account_data.project_name,
            tenant_id=account_data.tenant_id,
            base_url=account_data.base_url,
            oauth_url=account_data.oauth_url,
            client_id=account_data.client_id,
            client_secret=account_data.client_secret,
            saak=account_data.saak,
            sask=account_data.sask,
            username=account_data.username,
            password=account_data.password
        )
        return AccountResponse.from_orm(account)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create account: {str(e)}"
        )

@router.get("/list", response_model=List[AccountListItem])
def list_accounts(db: Session = Depends(get_db)):
    """List all accounts (for login dropdown)"""
    accounts = AccountService.list_accounts(db)
    return [AccountListItem.from_orm(acc) for acc in accounts]

@router.get("/me", response_model=AccountResponse)
def get_current_account(
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Get current authenticated account"""
    account = AccountService.get_account_by_id(db, account_id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    return AccountResponse.from_orm(account)

@router.put("/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: int,
    update_data: AccountUpdate,
    current_account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Update account (only own account)"""
    if account_id != current_account_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only update own account"
        )
    
    account = AccountService.update_account(
        db,
        account_id,
        project_name=update_data.project_name,
        tenant_id=update_data.tenant_id,
        base_url=update_data.base_url,
        client_id=update_data.client_id,
        client_secret=update_data.client_secret,
        password=update_data.password
    )
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    return AccountResponse.from_orm(account)

@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    account_id: int,
    current_account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Delete account (only own account)"""
    if account_id != current_account_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only delete own account"
        )
    
    success = AccountService.delete_account(db, account_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
