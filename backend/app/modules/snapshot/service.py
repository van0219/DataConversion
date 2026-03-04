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
        """Create new setup business class (marked as 'custom')"""
        # Check if name already exists
        existing = db.query(SetupBusinessClass).filter(SetupBusinessClass.name == name).first()
        if existing:
            raise ValueError(f"Setup business class '{name}' already exists")
        
        setup_class = SetupBusinessClass(
            name=name,
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
        
        logger.info(f"Created custom setup business class: {name}")
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
        Supports both formats:
        - Single .json files (swagger format)
        - Folders with .schema.json files (JSON Schema format)
        Returns list with business class name, endpoint_url, and key_field parsed from swagger.
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
            # Scan for .json files (swagger format)
            for swagger_file in setup_dir.glob("*.json"):
                business_class = swagger_file.stem  # Filename without .json
                if business_class not in existing_names:
                    # Parse swagger to get endpoint and key field
                    swagger_data = SnapshotService._parse_swagger_file(swagger_file, business_class)
                    if swagger_data:
                        available_files.append({
                            "name": business_class,
                            "endpoint_url": swagger_data["endpoint_url"],
                            "key_field": swagger_data["key_field"],
                            "folder": "Setup"
                        })
            
            # Scan for folders (JSON Schema format)
            for item in setup_dir.iterdir():
                if item.is_dir():
                    business_class = item.name
                    if business_class not in existing_names:
                        # Parse JSON Schema folder
                        swagger_data = SnapshotService._parse_swagger_file(item, business_class)
                        if swagger_data:
                            available_files.append({
                                "name": business_class,
                                "endpoint_url": swagger_data["endpoint_url"],
                                "key_field": swagger_data["key_field"],
                                "folder": "Setup"
                            })
        
        logger.info(f"Found {len(available_files)} available setup class swagger files not yet added")
        return available_files
    
    @staticmethod
    def _parse_swagger_file(swagger_file: Path, business_class: str) -> Optional[Dict]:
        """
        Parse swagger file OR JSON Schema folder to extract endpoint URL and key field.
        Supports two formats:
        1. Single .json file (swagger format)
        2. Folder with .schema.json and .properties.json files (JSON Schema format)
        
        Returns dict with endpoint_url and key_field, or None if parsing fails.
        """
        try:
            # Check if it's a folder (JSON Schema format)
            if swagger_file.is_dir():
                return SnapshotService._parse_json_schema_folder(swagger_file, business_class)
            
            # Otherwise, parse as single swagger file
            with open(swagger_file, 'r') as f:
                swagger_json = json.load(f)
            
            # Extract endpoint URL from paths (e.g., "/api/v2/Account")
            endpoint_url = None
            if "paths" in swagger_json:
                # Get first path that contains the business class name
                for path in swagger_json["paths"].keys():
                    if business_class in path:
                        # Remove leading slash and extract relative path
                        endpoint_url = path.lstrip('/')
                        break
            
            # If not found in paths, construct default
            if not endpoint_url:
                endpoint_url = f"api/v2/{business_class}"
            
            # Extract key field from schema
            key_field = None
            if "components" in swagger_json and "schemas" in swagger_json["components"]:
                # Look for schema with business class name
                for schema_name, schema_def in swagger_json["components"]["schemas"].items():
                    if business_class in schema_name:
                        # Look for common key field patterns
                        if "properties" in schema_def:
                            props = schema_def["properties"]
                            # Try common patterns
                            if "Id" in props:
                                key_field = "Id"
                            elif f"{business_class}Id" in props:
                                key_field = f"{business_class}Id"
                            elif "id" in props:
                                key_field = "id"
                            else:
                                # Use first property as fallback
                                key_field = list(props.keys())[0] if props else "Id"
                        break
            
            # Default key field if not found
            if not key_field:
                key_field = "Id"
            
            return {
                "endpoint_url": endpoint_url,
                "key_field": key_field
            }
            
        except Exception as e:
            logger.error(f"Failed to parse swagger file {swagger_file}: {e}")
            return None
    
    @staticmethod
    def _parse_json_schema_folder(folder_path: Path, business_class: str) -> Optional[Dict]:
        """
        Parse JSON Schema folder format (schema.json + properties.json).
        Example: FinanceDimension6/FSM_FinanceDimension06.schema.json
        """
        try:
            # Find schema.json file
            schema_files = list(folder_path.glob("*.schema.json"))
            if not schema_files:
                logger.error(f"No .schema.json file found in {folder_path}")
                return None
            
            schema_file = schema_files[0]
            
            # Find properties.json file
            properties_files = list(folder_path.glob("*.properties.json"))
            
            # Parse schema.json
            with open(schema_file, 'r') as f:
                schema_json = json.load(f)
            
            # Extract key field from properties.json if available
            key_field = None
            if properties_files:
                with open(properties_files[0], 'r') as f:
                    properties_json = json.load(f)
                
                # Get key field from IdentifierPaths
                if "IdentifierPaths" in properties_json:
                    identifier_paths = properties_json["IdentifierPaths"]
                    if identifier_paths:
                        # Extract field name from JSON path (e.g., "$.FinanceDimension6" -> "FinanceDimension6")
                        # Use the last identifier (most specific)
                        last_identifier = identifier_paths[-1].replace("$.", "")
                        key_field = last_identifier
            
            # If not found in properties, try to extract from schema
            if not key_field and "properties" in schema_json:
                props = schema_json["properties"]
                # Look for field matching business class name
                if business_class in props:
                    key_field = business_class
                elif f"{business_class}Key" in props:
                    key_field = f"{business_class}Key"
                elif "Id" in props:
                    key_field = "Id"
                else:
                    # Use first property
                    key_field = list(props.keys())[0] if props else "Id"
            
            # Generate endpoint URL based on business class pattern
            # Special handling for FinanceDimension classes
            if business_class.startswith("FinanceDimension"):
                # FinanceDimension classes use FlatList format
                endpoint_url = f"soap/classes/{business_class}/lists/{business_class}FlatList?_fields=_all&_limit=100000&_links=false&_pageNav=true&_out=JSON&_flatten=false"
            else:
                # For other classes, provide a generic template that user can edit
                # Common patterns: PrimaryXXXList, DetailXXXList, XXXFlatList
                # User will need to update the list name in the UI
                endpoint_url = f"soap/classes/{business_class}/lists/Primary{business_class}List?_fields=_all&_limit=100000&_links=false&_pageNav=true&_out=JSON&_flatten=false"
            
            return {
                "endpoint_url": endpoint_url,
                "key_field": key_field or "Id"
            }
            
        except Exception as e:
            logger.error(f"Failed to parse JSON Schema folder {folder_path}: {e}")
            return None
