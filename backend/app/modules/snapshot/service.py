from sqlalchemy.orm import Session
from typing import List, Dict, Optional
from datetime import datetime
from app.models.snapshot import SnapshotRegistry, SnapshotRecord
from app.models.setup_business_class import SetupBusinessClass
from app.services.fsm_client import FSMClient
from app.modules.accounts.service import AccountService
from app.core.logging import logger
import json

class SnapshotService:
    @staticmethod
    async def sync_all_active_setup_classes(
        db: Session,
        account_id: int
    ) -> Dict:
        """
        Sync all active setup business classes for an account.
        Returns summary of sync operation.
        """
        # Get all active setup business classes
        active_classes = db.query(SetupBusinessClass).filter(
            SetupBusinessClass.is_active == True
        ).all()
        
        if not active_classes:
            logger.warning("No active setup business classes configured")
            return {
                "status": "warning",
                "message": "No active setup business classes configured",
                "classes_synced": [],
                "total_records": 0
            }
        
        logger.info(f"Syncing {len(active_classes)} active setup business classes")
        
        # Get account credentials
        account = AccountService.get_account_by_id(db, account_id)
        if not account:
            raise ValueError("Account not found")
        
        credentials = AccountService.get_decrypted_credentials(account)
        
        # Create FSM client
        fsm_client = FSMClient(
            base_url=credentials["base_url"],
            oauth_url=credentials["oauth_url"],
            tenant_id=credentials["tenant_id"],
            client_id=credentials["client_id"],
            client_secret=credentials["client_secret"],
            saak=credentials["saak"],
            sask=credentials["sask"]
        )
        
        # Sync each active class sequentially
        sync_results = []
        total_records = 0
        
        for setup_class in active_classes:
            try:
                result = await SnapshotService._sync_single_setup_class(
                    db,
                    account_id,
                    setup_class,
                    fsm_client
                )
                sync_results.append(result)
                total_records += result["record_count"]
            except Exception as e:
                logger.error(f"Failed to sync {setup_class.name}: {str(e)}")
                sync_results.append({
                    "business_class": setup_class.name,
                    "status": "failed",
                    "error": str(e),
                    "record_count": 0
                })
        
        return {
            "status": "success",
            "classes_synced": sync_results,
            "total_records": total_records
        }
    
    @staticmethod
    async def sync_single_setup_class_by_name(
        db: Session,
        account_id: int,
        business_class_name: str
    ) -> Dict:
        """
        Sync a single setup business class by name.
        """
        # Get setup class configuration
        setup_class = db.query(SetupBusinessClass).filter(
            SetupBusinessClass.name == business_class_name
        ).first()
        
        if not setup_class:
            raise ValueError(f"Setup business class '{business_class_name}' not found")
        
        if not setup_class.is_active:
            raise ValueError(f"Setup business class '{business_class_name}' is not active")
        
        # Get account credentials
        account = AccountService.get_account_by_id(db, account_id)
        if not account:
            raise ValueError("Account not found")
        
        credentials = AccountService.get_decrypted_credentials(account)
        
        # Create FSM client
        fsm_client = FSMClient(
            base_url=credentials["base_url"],
            oauth_url=credentials["oauth_url"],
            tenant_id=credentials["tenant_id"],
            client_id=credentials["client_id"],
            client_secret=credentials["client_secret"],
            saak=credentials["saak"],
            sask=credentials["sask"]
        )
        
        # Sync the class
        result = await SnapshotService._sync_single_setup_class(
            db,
            account_id,
            setup_class,
            fsm_client
        )
        
        return result
    
    @staticmethod
    async def _sync_single_setup_class(
        db: Session,
        account_id: int,
        setup_class: SetupBusinessClass,
        fsm_client: FSMClient
    ) -> Dict:
        """
        Sync a single setup business class using configured endpoint.
        Stores records in unified snapshot_records table.
        """
        logger.info(f"Syncing {setup_class.name} using endpoint: {setup_class.endpoint_url}")
        
        try:
            # Fetch records from FSM using configured endpoint
            records = await fsm_client.fetch_setup_data(setup_class.endpoint_url)
            
            logger.info(f"Fetched {len(records)} records for {setup_class.name}")
            
            # Store records in snapshot_records table
            records_stored = 0
            batch_size = 100  # Commit every 100 records
            
            for i, record in enumerate(records):
                # Extract primary key using configured key_field
                primary_key = str(record.get(setup_class.key_field, ""))
                
                if not primary_key:
                    logger.warning(f"Record missing key field '{setup_class.key_field}', skipping: {record}")
                    continue
                
                try:
                    # Upsert snapshot record
                    existing = db.query(SnapshotRecord).filter(
                        SnapshotRecord.account_id == account_id,
                        SnapshotRecord.business_class == setup_class.name,
                        SnapshotRecord.primary_key == primary_key
                    ).first()
                    
                    if existing:
                        existing.raw_json = json.dumps(record)
                        existing.last_modified_date = datetime.now()
                    else:
                        snapshot_record = SnapshotRecord(
                            account_id=account_id,
                            business_class=setup_class.name,
                            primary_key=primary_key,
                            last_modified_date=datetime.now(),
                            raw_json=json.dumps(record)
                        )
                        db.add(snapshot_record)
                    
                    records_stored += 1
                    
                    # Commit every batch_size records
                    if (i + 1) % batch_size == 0:
                        db.commit()
                        logger.debug(f"Committed batch of {batch_size} records for {setup_class.name}")
                
                except Exception as e:
                    logger.error(f"Error storing record {primary_key}: {str(e)}")
                    db.rollback()
                    continue
            
            # Commit remaining records
            db.commit()
            
            # Update registry
            registry = db.query(SnapshotRegistry).filter(
                SnapshotRegistry.account_id == account_id,
                SnapshotRegistry.business_class == setup_class.name
            ).first()
            
            if registry:
                registry.last_sync_timestamp = datetime.now()
                registry.record_count = records_stored
            else:
                registry = SnapshotRegistry(
                    account_id=account_id,
                    business_class=setup_class.name,
                    last_sync_timestamp=datetime.now(),
                    record_count=records_stored
                )
                db.add(registry)
            
            db.commit()
            
            logger.info(f"Stored {records_stored} records for {setup_class.name}")
            
            return {
                "business_class": setup_class.name,
                "status": "success",
                "record_count": records_stored,
                "last_sync": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to sync {setup_class.name}: {str(e)}")
            raise
    
    @staticmethod
    def get_snapshot_registry(
        db: Session,
        account_id: int
    ) -> List[SnapshotRegistry]:
        """Get all snapshot registry entries for account"""
        return db.query(SnapshotRegistry).filter(
            SnapshotRegistry.account_id == account_id
        ).order_by(SnapshotRegistry.business_class).all()
    
    @staticmethod
    def check_reference_exists(
        db: Session,
        account_id: int,
        business_class: str,
        primary_key: str
    ) -> bool:
        """
        Check if a reference record exists in snapshot.
        Used by validation engine for REFERENCE_EXISTS rules.
        """
        record = db.query(SnapshotRecord).filter(
            SnapshotRecord.account_id == account_id,
            SnapshotRecord.business_class == business_class,
            SnapshotRecord.primary_key == primary_key
        ).first()
        
        return record is not None
    
    # Setup Business Class Management
    
    @staticmethod
    def get_all_setup_classes(db: Session) -> List[SetupBusinessClass]:
        """Get all setup business classes"""
        return db.query(SetupBusinessClass).order_by(SetupBusinessClass.name).all()
    
    @staticmethod
    def get_setup_class_by_id(db: Session, class_id: int) -> Optional[SetupBusinessClass]:
        """Get setup business class by ID"""
        return db.query(SetupBusinessClass).filter(SetupBusinessClass.id == class_id).first()
    
    @staticmethod
    def create_setup_class(
        db: Session,
        name: str,
        endpoint_url: str,
        key_field: str,
        is_active: bool = True
    ) -> SetupBusinessClass:
        """Create new setup business class"""
        # Check if name already exists
        existing = db.query(SetupBusinessClass).filter(SetupBusinessClass.name == name).first()
        if existing:
            raise ValueError(f"Setup business class '{name}' already exists")
        
        setup_class = SetupBusinessClass(
            name=name,
            endpoint_url=endpoint_url,
            key_field=key_field,
            is_active=is_active
        )
        
        db.add(setup_class)
        db.commit()
        db.refresh(setup_class)
        
        logger.info(f"Created setup business class: {name}")
        return setup_class
    
    @staticmethod
    def update_setup_class(
        db: Session,
        class_id: int,
        name: Optional[str] = None,
        endpoint_url: Optional[str] = None,
        key_field: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> SetupBusinessClass:
        """Update setup business class"""
        setup_class = SnapshotService.get_setup_class_by_id(db, class_id)
        if not setup_class:
            raise ValueError(f"Setup business class with ID {class_id} not found")
        
        if name is not None:
            # Check if new name conflicts with existing
            existing = db.query(SetupBusinessClass).filter(
                SetupBusinessClass.name == name,
                SetupBusinessClass.id != class_id
            ).first()
            if existing:
                raise ValueError(f"Setup business class '{name}' already exists")
            setup_class.name = name
        
        if endpoint_url is not None:
            setup_class.endpoint_url = endpoint_url
        
        if key_field is not None:
            setup_class.key_field = key_field
        
        if is_active is not None:
            setup_class.is_active = is_active
        
        db.commit()
        db.refresh(setup_class)
        
        logger.info(f"Updated setup business class: {setup_class.name}")
        return setup_class
    
    @staticmethod
    def delete_setup_class(db: Session, class_id: int):
        """Delete setup business class"""
        setup_class = SnapshotService.get_setup_class_by_id(db, class_id)
        if not setup_class:
            raise ValueError(f"Setup business class with ID {class_id} not found")
        
        name = setup_class.name
        db.delete(setup_class)
        db.commit()
        
        logger.info(f"Deleted setup business class: {name}")
    
    @staticmethod
    def toggle_setup_class_active(db: Session, class_id: int) -> SetupBusinessClass:
        """Toggle is_active status of setup business class"""
        setup_class = SnapshotService.get_setup_class_by_id(db, class_id)
        if not setup_class:
            raise ValueError(f"Setup business class with ID {class_id} not found")
        
        setup_class.is_active = not setup_class.is_active
        db.commit()
        db.refresh(setup_class)
        
        logger.info(f"Toggled {setup_class.name} active status to: {setup_class.is_active}")
        return setup_class
