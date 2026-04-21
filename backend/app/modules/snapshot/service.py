from sqlalchemy.orm import Session
from typing import List, Dict, Optional
from datetime import datetime
from pathlib import Path
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
        Full replace strategy: delete old records, insert fresh data, count actual rows.
        """
        logger.info(f"Syncing {setup_class.name} using endpoint: {setup_class.endpoint_url}")
        
        try:
            from app.services.sync_progress import sync_progress
            
            sync_progress.start(setup_class.name)
            
            # Progress callback for fetch_setup_data
            def on_page(records_fetched, pages_fetched, page_size):
                sync_progress.update_fetch(setup_class.name, records_fetched, pages_fetched, page_size)
            
            def on_page_start(page_num, page_size, records_so_far):
                sync_progress.update_fetching_page(setup_class.name, page_num, page_size, records_so_far)
            
            # Fetch records from FSM using configured endpoint
            records = await fsm_client.fetch_setup_data(setup_class.endpoint_url, on_page_fetched=on_page, on_page_starting=on_page_start)
            
            logger.info(f"Fetched {len(records)} records for {setup_class.name}")
            
            # Delete existing records for this account+class before inserting fresh data
            db.query(SnapshotRecord).filter(
                SnapshotRecord.account_id == account_id,
                SnapshotRecord.business_class == setup_class.name
            ).delete()
            db.commit()
            
            # Insert fresh records in batches (deduplicate by primary key — keep last occurrence)
            records_stored = 0
            batch_size = 500
            seen_keys = set()
            
            batch = []
            for i, record in enumerate(records):
                primary_key = str(record.get(setup_class.key_field, ""))
                
                if not primary_key:
                    logger.warning(f"Record missing key field '{setup_class.key_field}' for {setup_class.name}, skipping")
                    continue
                
                if primary_key in seen_keys:
                    continue
                seen_keys.add(primary_key)
                
                batch.append(SnapshotRecord(
                    account_id=account_id,
                    business_class=setup_class.name,
                    primary_key=primary_key,
                    last_modified_date=datetime.now(),
                    raw_json=json.dumps(record)
                ))
                records_stored += 1

                if len(batch) >= batch_size:
                    db.bulk_save_objects(batch)
                    db.commit()
                    sync_progress.update_store(setup_class.name, records_stored, len(records))
                    batch = []

            if batch:
                db.bulk_save_objects(batch)
                db.commit()
            
            # Count actual rows in DB for accuracy
            actual_count = db.query(SnapshotRecord).filter(
                SnapshotRecord.account_id == account_id,
                SnapshotRecord.business_class == setup_class.name
            ).count()
            
            # Update registry with actual count
            registry = db.query(SnapshotRegistry).filter(
                SnapshotRegistry.account_id == account_id,
                SnapshotRegistry.business_class == setup_class.name
            ).first()
            
            if registry:
                registry.last_sync_timestamp = datetime.now()
                registry.record_count = actual_count
            else:
                registry = SnapshotRegistry(
                    account_id=account_id,
                    business_class=setup_class.name,
                    last_sync_timestamp=datetime.now(),
                    record_count=actual_count
                )
                db.add(registry)
            
            db.commit()
            
            logger.info(f"Stored {actual_count} records for {setup_class.name} (fetched {len(records)}, stored {records_stored})")
            
            sync_progress.complete(setup_class.name, actual_count)
            
            return {
                "business_class": setup_class.name,
                "status": "success",
                "record_count": actual_count,
                "last_sync": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to sync {setup_class.name}: {str(e)}")
            from app.services.sync_progress import sync_progress
            sync_progress.fail(setup_class.name, str(e))
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
        list_name: str,
        endpoint_url: str,
        key_field: str,
        is_active: bool = True
    ) -> SetupBusinessClass:
        """Create new setup business class (marked as 'custom')"""
        # Check if name already exists
        existing = db.query(SetupBusinessClass).filter(SetupBusinessClass.name == name).first()
        if existing:
            raise ValueError(f"Setup business class '{name}' already exists")
        
        setup_class = SetupBusinessClass(
            name=name,
            list_name=list_name,
            endpoint_url=endpoint_url,
            key_field=key_field,
            is_active=is_active,
            category='custom',  # User-added classes are 'custom'
            original_endpoint_url=endpoint_url,  # Store original values for reset
            original_key_field=key_field
        )
        
        db.add(setup_class)
        db.commit()
        db.refresh(setup_class)
        
        logger.info(f"Created custom setup business class: {name} with list: {list_name}")
        return setup_class
    
    @staticmethod
    def update_setup_class(
        db: Session,
        class_id: int,
        name: Optional[str] = None,
        list_name: Optional[str] = None,
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
        
        if list_name is not None:
            setup_class.list_name = list_name
        
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
        """Delete setup business class (only allowed for 'custom' classes)"""
        setup_class = SnapshotService.get_setup_class_by_id(db, class_id)
        if not setup_class:
            raise ValueError(f"Setup business class with ID {class_id} not found")
        
        # Only allow deletion of custom classes
        if setup_class.category == 'standard':
            raise ValueError(
                f"Cannot delete standard setup business class '{setup_class.name}'. "
                "Use deactivate instead."
            )
        
        name = setup_class.name
        db.delete(setup_class)
        db.commit()
        
        logger.info(f"Deleted custom setup business class: {name}")
    
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
    
    @staticmethod
    def reset_setup_class(db: Session, class_id: int) -> SetupBusinessClass:
        """
        Reset setup business class to original values.
        - Standard classes: Revert to out-of-the-box configuration
        - Custom classes: Revert to first saved values
        """
        setup_class = SnapshotService.get_setup_class_by_id(db, class_id)
        if not setup_class:
            raise ValueError(f"Setup business class with ID {class_id} not found")
        
        # Check if original values exist
        if not setup_class.original_endpoint_url or not setup_class.original_key_field:
            raise ValueError(
                f"No original values found for '{setup_class.name}'. Cannot reset."
            )
        
        # Revert to original values
        setup_class.endpoint_url = setup_class.original_endpoint_url
        setup_class.key_field = setup_class.original_key_field
        
        db.commit()
        db.refresh(setup_class)
        
        logger.info(
            f"Reset {setup_class.category} setup business class '{setup_class.name}' "
            f"to original values"
        )
        return setup_class
    @staticmethod
    def get_available_swagger_files(db: Session) -> List[Dict]:
        """
        Get list of available swagger files that haven't been added yet.
        Scans ONLY FSM_Swagger/Setup/ folder (reference data classes).
        Uses single .json files (OpenAPI/Swagger format).
        Returns list with business class name, available_lists, and key_field parsed from swagger.
        """
        # Get existing setup class names
        existing_classes = db.query(SetupBusinessClass.name).all()
        existing_names = {cls.name for cls in existing_classes}
        
        # Get swagger base directory
        swagger_base_dir = Path(__file__).parent.parent.parent.parent.parent / "FSM_Swagger"
        
        available_files = []
        
        # Scan Setup folder ONLY (reference data classes for validation)
        setup_dir = swagger_base_dir / "Setup"
        if setup_dir.exists():
            # Scan for .json files (OpenAPI/Swagger format)
            for swagger_file in setup_dir.glob("*.json"):
                business_class = swagger_file.stem  # Filename without .json
                if business_class not in existing_names:
                    # Parse swagger to get key field and available lists
                    swagger_data = SnapshotService._parse_swagger_file(swagger_file, business_class)
                    if swagger_data:
                        available_files.append({
                            "name": business_class,
                            "key_field": swagger_data["key_field"],
                            "available_lists": swagger_data["available_lists"],
                            "folder": "Setup"
                        })
        
        logger.info(f"Found {len(available_files)} available setup class swagger files not yet added")
        return available_files
    
    @staticmethod
    def _parse_swagger_file(swagger_file: Path, business_class: str) -> Optional[Dict]:
        """
        Parse single OpenAPI/Swagger JSON file to extract:
        - Key field from contextFields schema
        - Available list names from paths section
        
        Returns dict with key_field and available_lists, or None if parsing fails.
        """
        try:
            # Parse single swagger file
            with open(swagger_file, 'r') as f:
                swagger_json = json.load(f)
            
            # Handle array format (some swagger files are wrapped in array)
            if isinstance(swagger_json, list) and len(swagger_json) > 0:
                swagger_json = swagger_json[0]
            
            # Extract key field from contextFields schema (contains required/key fields)
            key_field = None
            if "components" in swagger_json and "schemas" in swagger_json["components"]:
                schemas = swagger_json["components"]["schemas"]
                
                # Look for contextFields schema (contains key fields)
                if "contextFields" in schemas:
                    context_schema = schemas["contextFields"]
                    if "required" in context_schema and context_schema["required"]:
                        # Use the first required field that matches business class name
                        for req_field in context_schema["required"]:
                            if business_class in req_field:
                                key_field = req_field
                                break
                        # If no match, use first required field
                        if not key_field:
                            key_field = context_schema["required"][0]
                
                # Fallback: Look for allFields schema
                if not key_field and "allFields" in schemas:
                    all_fields_schema = schemas["allFields"]
                    if "required" in all_fields_schema and all_fields_schema["required"]:
                        # Use first required field that matches business class name
                        for req_field in all_fields_schema["required"]:
                            if business_class in req_field:
                                key_field = req_field
                                break
                        # If no match, use first required field
                        if not key_field:
                            key_field = all_fields_schema["required"][0]
            
            # Default key field if not found
            if not key_field:
                key_field = business_class  # Use business class name as key field
            
            # Extract available list names from paths section
            available_lists = []
            if "paths" in swagger_json:
                # Look for /classes/{BusinessClass}/lists/{list} path
                list_path = f"/classes/{business_class}/lists/{{list}}"
                
                if list_path in swagger_json["paths"]:
                    path_def = swagger_json["paths"][list_path]
                    
                    # Look for GET operation
                    if "get" in path_def:
                        get_op = path_def["get"]
                        
                        # Look for parameters
                        if "parameters" in get_op:
                            for param in get_op["parameters"]:
                                # Find the {list} path parameter
                                if param.get("name") == "list" and param.get("in") == "path":
                                    # Extract enum values (list names)
                                    if "schema" in param and "enum" in param["schema"]:
                                        available_lists = param["schema"]["enum"]
                                        break
            
            # If no lists found, provide default based on pattern
            if not available_lists:
                logger.warning(f"No list names found in swagger for {business_class}, using default pattern")
                if business_class.startswith("FinanceDimension"):
                    available_lists = [f"{business_class}FlatList"]
                else:
                    available_lists = [f"Primary{business_class}List"]
            
            logger.info(f"Parsed swagger for {business_class}: key_field={key_field}, lists={len(available_lists)}")
            
            return {
                "key_field": key_field,
                "available_lists": available_lists
            }
            
        except Exception as e:
            logger.error(f"Failed to parse swagger file {swagger_file}: {e}")
            return None
    

