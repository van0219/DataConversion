import httpx
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from app.core.logging import logger

class FSMClient:
    """
    FSM API client with OAuth2 password grant authentication.
    Handles token management, API calls, and error handling.
    """
    
    def __init__(self, base_url: str, oauth_url: str, tenant_id: str, client_id: str, client_secret: str, saak: str, sask: str):
        self.base_url = base_url.rstrip('/')
        self.oauth_url = oauth_url.rstrip('/')
        self.tenant_id = tenant_id
        self.client_id = client_id
        self.client_secret = client_secret
        self.saak = saak
        self.sask = sask
        self.access_token: Optional[str] = None
        self.token_expiry: Optional[datetime] = None
    
    async def authenticate(self) -> str:
        """
        Authenticate with FSM using OAuth2 password grant.
        Returns access token.
        """
        # Build OAuth token endpoint: {oauth_url}/token.oauth2
        # Ensure proper URL joining (oauth_url may or may not have trailing slash)
        oauth_base = self.oauth_url.rstrip('/')
        token_endpoint = f"{oauth_base}/token.oauth2"
        
        # Username is saak (already includes tenant_id prefix)
        username = self.saak
        password = self.sask
        
        logger.info(f"Authenticating with FSM: {token_endpoint}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    token_endpoint,
                    data={
                        "grant_type": "password",
                        "username": username,
                        "password": password,
                        "client_id": self.client_id,
                        "client_secret": self.client_secret
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                response.raise_for_status()
                
                data = response.json()
                self.access_token = data["access_token"]
                expires_in = data.get("expires_in", 3600)
                self.token_expiry = datetime.now() + timedelta(seconds=expires_in)
                
                logger.info("FSM authentication successful")
                return self.access_token
                
            except httpx.HTTPStatusError as e:
                logger.error(f"FSM authentication failed: {e.response.status_code} - {e.response.text}")
                raise Exception(f"FSM authentication failed: {e.response.status_code} - {e.response.text}")
            except Exception as e:
                logger.error(f"FSM authentication error: {str(e)}")
                raise Exception(f"FSM authentication error: {str(e)}")
    
    async def _ensure_authenticated(self):
        """Ensure token is valid, refresh if needed"""
        if not self.access_token or not self.token_expiry or datetime.now() >= self.token_expiry:
            await self.authenticate()
    
    async def get_openapi_schema(self, business_class: str) -> Dict:
        """
        Fetch OpenAPI JSON schema for business class.
        Returns complete OpenAPI specification.
        """
        await self._ensure_authenticated()
        
        logger.info(f"Fetching OpenAPI schema for {business_class}")
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.get(
                    f"{self.base_url}/api/metadata/openapi",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    params={"businessClass": business_class}
                )
                response.raise_for_status()
                
                logger.info(f"OpenAPI schema fetched successfully for {business_class}")
                return response.json()
                
            except httpx.HTTPStatusError as e:
                logger.error(f"Failed to fetch schema: {e.response.status_code} - {e.response.text}")
                raise Exception(f"Failed to fetch schema: {e.response.status_code}")
            except Exception as e:
                logger.error(f"Schema fetch error: {str(e)}")
                raise Exception(f"Schema fetch error: {str(e)}")
    
    async def fetch_records(
        self,
        business_class: str,
        last_modified_after: Optional[datetime] = None,
        limit: int = 1000,
        offset: int = 0
    ) -> List[Dict]:
        """
        Fetch records from FSM with optional delta sync.
        Used for snapshot synchronization.
        """
        await self._ensure_authenticated()
        
        logger.info(f"Fetching records for {business_class} (limit={limit}, offset={offset})")
        
        params = {
            "limit": limit,
            "offset": offset
        }
        
        if last_modified_after:
            params["lastModifiedDate"] = last_modified_after.strftime("%Y-%m-%dT%H:%M:%S")
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                response = await client.get(
                    f"{self.base_url}/api/classes/{business_class}",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    params=params
                )
                response.raise_for_status()
                
                data = response.json()
                records = data.get("items", [])
                
                logger.info(f"Fetched {len(records)} records for {business_class}")
                return records
                
            except httpx.HTTPStatusError as e:
                logger.error(f"Failed to fetch records: {e.response.status_code} - {e.response.text}")
                raise Exception(f"Failed to fetch records: {e.response.status_code}")
            except Exception as e:
                logger.error(f"Record fetch error: {str(e)}")
                raise Exception(f"Record fetch error: {str(e)}")
    
    async def batch_create_unreleased(
        self,
        business_class: str,
        records: List[Dict],
        trigger_interface: bool = False
    ) -> Dict:
        """
        Batch create unreleased records in FSM.
        Returns FSM API response with success/failure details.
        
        FSM batch endpoint format (from swagger):
        POST /api/classes/{business_class}/actions/CreateUnreleased/batch
        Body: {"_records": [{"_fields": {...}}, {"_fields": {...}}]}
        """
        await self._ensure_authenticated()
        
        logger.info(f"Batch creating {len(records)} records for {business_class}")
        
        # Format records according to FSM batch API spec
        # Each record must have "_fields" AND "message": "BatchImport"
        # Keep empty strings (FSM expects them)
        formatted_records = [
            {
                "_fields": record,
                "message": "BatchImport"
            }
            for record in records
        ]
        
        payload = {
            "_records": formatted_records
        }
        
        async with httpx.AsyncClient(timeout=300.0) as client:
            try:
                # Construct correct FSM API URL with tenant_id and FSM/fsm/soap path
                url = f"{self.base_url}/{self.tenant_id}/FSM/fsm/soap/classes/{business_class}/actions/CreateUnreleased/batch"
                
                response = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json"
                    },
                    json=payload
                )
                response.raise_for_status()
                
                result = response.json()
                
                # Parse FSM batch response
                # Response is an array of records with success/failure info
                if isinstance(result, list):
                    # Count successes: records with "created" message or no exception
                    success_count = 0
                    failure_count = 0
                    
                    for r in result:
                        # Skip batch status records (not actual data records)
                        if "batchStatus" in r:
                            continue
                        
                        # Check if record has an exception (failure)
                        if "exception" in r:
                            failure_count += 1
                        # Check if record was created successfully
                        elif r.get("message") and "created" in r.get("message", "").lower():
                            success_count += 1
                        # If has _fields, assume success
                        elif "_fields" in r:
                            success_count += 1
                    
                    logger.info(f"Batch create completed: {success_count} success, {failure_count} failures")
                    
                    return {
                        "successCount": success_count,
                        "failureCount": failure_count,
                        "results": result
                    }
                else:
                    # Unexpected response format
                    logger.warning(f"Unexpected batch response format: {type(result)}")
                    return result
                
            except httpx.HTTPStatusError as e:
                logger.error(f"Batch create failed: {e.response.status_code} - {e.response.text}")
                raise Exception(f"Batch create failed: {e.response.status_code} - {e.response.text}")
            except Exception as e:
                logger.error(f"Batch create error: {str(e)}")
                raise Exception(f"Batch create error: {str(e)}")
    
    async def delete_all_transactions_for_run_group(
        self,
        business_class: str,
        run_group: str
    ) -> Dict:
        """
        Delete all transactions for a specific RunGroup (rollback operation).
        Used when batch load has failures to maintain data integrity.
        
        URL format:
        {base_url}/{tenant_id}/FSM/fsm/soap/ldrest/{business_class}/DeleteAllTransactionsForRunGroup_DeleteAllTransactionsForRunGroupForm_FormOperation?PrmRunGroup={run_group}&_cmAll=true
        """
        await self._ensure_authenticated()
        
        logger.info(f"Deleting all transactions for RunGroup: {run_group}")
        
        # Construct FSM delete URL
        url = f"{self.base_url}/{self.tenant_id}/FSM/fsm/soap/ldrest/{business_class}/DeleteAllTransactionsForRunGroup_DeleteAllTransactionsForRunGroupForm_FormOperation"
        
        params = {
            "PrmRunGroup": run_group,
            "_cmAll": "true"
        }
        
        async with httpx.AsyncClient(timeout=300.0) as client:
            try:
                response = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    params=params
                )
                response.raise_for_status()
                
                result = response.json()
                logger.info(f"Successfully deleted all transactions for RunGroup: {run_group}")
                return result
                
            except httpx.HTTPStatusError as e:
                logger.error(f"Delete failed: {e.response.status_code} - {e.response.text}")
                raise Exception(f"Delete failed: {e.response.status_code} - {e.response.text}")
            except Exception as e:
                logger.error(f"Delete error: {str(e)}")
                raise Exception(f"Delete error: {str(e)}")
    
    async def create_unreleased_single(
        self,
        business_class: str,
        record: Dict
    ) -> Dict:
        """
        Create a single unreleased record in FSM (non-batch endpoint).
        Returns FSM API response.
        
        FSM single record endpoint format (from swagger):
        POST /api/classes/{business_class}/actions/CreateUnreleased
        Body: {field1: value1, field2: value2, ...} (direct fields, no wrapper)
        """
        await self._ensure_authenticated()
        
        logger.info(f"Creating single record for {business_class}")
        
        # Remove empty string fields
        cleaned_record = {k: v for k, v in record.items() if v != ""}
        
        # Build full URL
        url = f"{self.base_url}/api/classes/{business_class}/actions/CreateUnreleased"
        
        # Log the exact request details
        import json
        logger.info(f"=== FSM API REQUEST ===")
        logger.info(f"URL: {url}")
        logger.info(f"Method: POST")
        logger.info(f"Headers: Authorization: Bearer {self.access_token[:20]}..., Content-Type: application/json")
        logger.info(f"Payload: {json.dumps(cleaned_record, indent=2)}")
        
        async with httpx.AsyncClient(timeout=300.0) as client:
            try:
                response = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json"
                    },
                    json=cleaned_record
                )
                
                # Log response
                logger.info(f"=== FSM API RESPONSE ===")
                logger.info(f"Status: {response.status_code}")
                logger.info(f"Body: {response.text}")
                
                response.raise_for_status()
                
                result = response.json()
                logger.info(f"Single record created successfully")
                return result
                
            except httpx.HTTPStatusError as e:
                logger.error(f"=== FSM API ERROR ===")
                logger.error(f"Status: {e.response.status_code}")
                logger.error(f"Response: {e.response.text}")
                raise Exception(f"Single record create failed: {e.response.status_code} - {e.response.text}")
            except Exception as e:
                logger.error(f"Single record create error: {str(e)}")
                raise Exception(f"Single record create error: {str(e)}")
    
    async def fetch_setup_data(self, endpoint_url: str) -> List[Dict]:
        """
        Fetch setup data from FSM using configured list endpoint.
        Used for snapshot orchestration.
        
        Args:
            endpoint_url: Relative endpoint path (e.g., "soap/classes/Currency/lists/PrimaryCurrencyList?...")
        
        Returns:
            List of records from _records array in response
        """
        await self._ensure_authenticated()
        
        # Construct full URL: base_url + tenant_id + /FSM/fsm + endpoint_url
        # Ensure proper URL joining
        base = self.base_url.rstrip('/')
        full_url = f"{base}/{self.tenant_id}/FSM/fsm/{endpoint_url}"
        
        logger.info(f"Fetching setup data from: {full_url}")
        
        # Use longer timeout for setup data (can be large datasets like GeneralLedgerChartAccount)
        async with httpx.AsyncClient(timeout=300.0) as client:
            try:
                response = await client.get(
                    full_url,
                    headers={"Authorization": f"Bearer {self.access_token}"}
                )
                response.raise_for_status()
                
                data = response.json()
                
                # Handle different response formats
                if isinstance(data, list):
                    # Response is directly a list of records
                    # First item may be metadata (_count, _links), skip it
                    # Remaining items have _fields wrapper
                    flattened_records = []
                    for i, record in enumerate(data):
                        if isinstance(record, dict):
                            # Skip metadata item (has _count or _links but no _fields)
                            if "_count" in record or ("_links" in record and "_fields" not in record):
                                logger.debug(f"Skipping metadata item at index {i}")
                                continue
                            
                            # Extract _fields if present
                            if "_fields" in record:
                                flattened_records.append(record["_fields"])
                            else:
                                flattened_records.append(record)
                    
                    logger.info(f"Fetched {len(flattened_records)} records from setup endpoint (direct list)")
                    return flattened_records
                elif isinstance(data, dict):
                    # Response is a dict, extract _records array
                    records = data.get("_records", [])
                    
                    # Flatten _fields from each record
                    flattened_records = []
                    for record in records:
                        if "_fields" in record:
                            flattened_records.append(record["_fields"])
                        else:
                            flattened_records.append(record)
                    
                    logger.info(f"Fetched {len(flattened_records)} records from setup endpoint")
                    return flattened_records
                else:
                    logger.error(f"Unexpected response type: {type(data)}")
                    return []
                
            except httpx.HTTPStatusError as e:
                logger.error(f"Failed to fetch setup data: {e.response.status_code} - {e.response.text}")
                raise Exception(f"Failed to fetch setup data: {e.response.status_code}")
            except Exception as e:
                logger.error(f"Setup data fetch error: {str(e)}")
                raise Exception(f"Setup data fetch error: {str(e)}")
    
    async def interface_transactions(
        self,
        business_class: str,
        run_group: str,
        enterprise_group: str = "",
        accounting_entity: str = "",
        edit_only: bool = False,
        edit_and_interface: bool = False,
        partial_update: bool = False,
        journalize_by_entity: bool = True,
        journal_by_journal_code: bool = False,
        bypass_organization_code: bool = True,
        bypass_account_code: bool = True,
        bypass_structure_relation_edit: bool = False,
        interface_in_detail: bool = True,
        currency_table: str = "",
        bypass_negative_rate_edit: bool = False,
        primary_ledger: str = "",
        move_errors_to_new_run_group: bool = False,
        error_run_group_prefix: str = ""
    ) -> Dict:
        """
        Interface (post/journalize) transactions for a specific RunGroup.
        
        URL format:
        {base_url}/{tenant_id}/FSM/fsm/soap/ldrest/{business_class}/InterfaceTransactions_InterfaceTransactionsForm_FormOperation
        
        Parameters (all from FSM swagger):
        - PrmRunGroup: RunGroup to interface (required)
        - PrmEnterpriseGroup: Finance Enterprise Group filter (optional)
        - PrmAccountingEntity: Legal Entity filter (optional)
        - PrmEditOnly: Edit only, no update (true/false)
        - PrmEditAndInterface: Edit and interface if no errors (true/false)
        - PrmPartialUpdate: Partial update mode (true/false)
        - PrmJournalizeByEntity: Journalize by legal entity (true/false)
        - PrmJournalByJournalCode: Split journals by journal code (true/false)
        - PrmByPassOrganizationCode: Bypass organization code validation (true/false)
        - PrmByPassAccountCode: Bypass account code validation (true/false)
        - PrmBypassStructureRelationEdit: Bypass structure relation validation (true/false)
        - PrmInterfaceInDetail: Interface in detail mode (true/false)
        - PrmCurrencyTable: Currency table (optional)
        - PrmBypassNegativeRateEdit: Bypass negative rate edit (true/false)
        - PrmPrimaryLedger: Primary ledger (optional)
        - PrmMoveErrorsToNewRunGroup: Move errors to new run group (true/false)
        - PrmErrorRunGroupPrefix: Error run group prefix (optional)
        - _cmAll: Always true
        """
        await self._ensure_authenticated()
        
        logger.info(f"Interfacing transactions for RunGroup: {run_group}")
        
        # Construct FSM interface URL
        url = f"{self.base_url}/{self.tenant_id}/FSM/fsm/soap/ldrest/{business_class}/InterfaceTransactions_InterfaceTransactionsForm_FormOperation"
        
        # Build query parameters (only include non-empty values)
        params = {
            "PrmRunGroup": run_group,
            "_cmAll": "true"
        }
        
        # Add optional string parameters if provided
        if enterprise_group:
            params["PrmEnterpriseGroup"] = enterprise_group
        if accounting_entity:
            params["PrmAccountingEntity"] = accounting_entity
        if currency_table:
            params["PrmCurrencyTable"] = currency_table
        if primary_ledger:
            params["PrmPrimaryLedger"] = primary_ledger
        if error_run_group_prefix:
            params["PrmErrorRunGroupPrefix"] = error_run_group_prefix
        
        # Add boolean parameters (FSM expects lowercase string "true" or "false")
        params["PrmEditOnly"] = str(edit_only).lower()
        params["PrmEditAndInterface"] = str(edit_and_interface).lower()
        params["PrmPartialUpdate"] = str(partial_update).lower()
        params["PrmJournalizeByEntity"] = str(journalize_by_entity).lower()
        params["PrmJournalByJournalCode"] = str(journal_by_journal_code).lower()
        params["PrmByPassOrganizationCode"] = str(bypass_organization_code).lower()
        params["PrmByPassAccountCode"] = str(bypass_account_code).lower()
        params["PrmBypassStructureRelationEdit"] = str(bypass_structure_relation_edit).lower()
        params["PrmInterfaceInDetail"] = str(interface_in_detail).lower()
        params["PrmBypassNegativeRateEdit"] = str(bypass_negative_rate_edit).lower()
        params["PrmMoveErrorsToNewRunGroup"] = str(move_errors_to_new_run_group).lower()
        
        async with httpx.AsyncClient(timeout=300.0) as client:
            try:
                response = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    params=params
                )
                response.raise_for_status()
                
                result = response.json()
                logger.info(f"Successfully interfaced transactions for RunGroup: {run_group}")
                return result
                
            except httpx.HTTPStatusError as e:
                logger.error(f"Interface failed: {e.response.status_code} - {e.response.text}")
                raise Exception(f"Interface failed: {e.response.status_code} - {e.response.text}")
            except Exception as e:
                logger.error(f"Interface error: {str(e)}")
                raise Exception(f"Interface error: {str(e)}")
    
    async def test_connection(self) -> bool:
        """Test FSM connection and credentials"""
        try:
            await self.authenticate()
            return True
        except Exception:
            return False

    async def query_gl_transaction_interface_result(
        self,
        run_group: str
    ) -> Dict:
        """
        Query GLTransactionInterfaceResult to get interface summary (RecordsProcessed, RecordsImported, RecordsWithError).
        Returns the latest result (highest ResultSequence) for the RunGroup.
        
        URL format:
        {base_url}/{tenant_id}/FSM/fsm/soap/classes/GLTransactionInterfaceResult/lists/_generic?
        _fields=RunGroup,Status,ResultSequence,RecordCount,PassedCount,FailedCount,GLTransactionInterfaceResult
        &_limit=5
        &_lplFilter=RunGroup = "{run_group}"
        &_links=false&_pageNav=true&_out=JSON&_flatten=false&_omitCountValue=false
        """
        await self._ensure_authenticated()
        
        # Build URL with dynamic tenant_id and run_group
        url = f"{self.base_url}/{self.tenant_id}/FSM/fsm/soap/classes/GLTransactionInterfaceResult/lists/_generic"
        
        # Build query parameters - use simple filter (date filter causes FSM errors)
        params = {
            "_fields": "RunGroup,Status,ResultSequence,RecordCount,PassedCount,FailedCount,GLTransactionInterfaceResult",
            "_limit": "10",
            "_lplFilter": f'RunGroup = "{run_group}"',
            "_links": "false",
            "_pageNav": "true",
            "_out": "JSON",
            "_flatten": "false",
            "_omitCountValue": "false"
        }
        
        logger.info(f"Querying GLTransactionInterfaceResult for RunGroup: {run_group}")
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    params=params
                )
                response.raise_for_status()
                
                result = response.json()
                logger.info(f"Query completed successfully")
                
                # Response format: [metadata, record1, record2, ...]
                # Extract records (skip first element which is metadata)
                if isinstance(result, list) and len(result) > 1:
                    # Get all records and find the one with highest GLTransactionInterfaceResult
                    records = []
                    for i in range(1, len(result)):  # Skip metadata at index 0
                        if isinstance(result[i], dict) and "_fields" in result[i]:
                            records.append(result[i]["_fields"])
                    
                    if records:
                        # Sort by GLTransactionInterfaceResult (highest first) to get latest run
                        latest_record = max(records, key=lambda x: int(x.get("GLTransactionInterfaceResult", 0)))
                        
                        # Extract summary data from latest record
                        summary = {
                            "result_sequence": latest_record.get("GLTransactionInterfaceResult", ""),
                            "status": latest_record.get("Status", ""),
                            "status_label": "Complete" if latest_record.get("Status") == "1" else "Incomplete" if latest_record.get("Status") == "2" else "Unknown",
                            "total_records": int(latest_record.get("RecordCount", 0)),
                            "successfully_imported": int(latest_record.get("PassedCount", 0)),
                            "records_with_error": int(latest_record.get("FailedCount", 0)),
                            "run_group": latest_record.get("RunGroup", ""),
                            "interface_successful": (
                                latest_record.get("Status") == "1" and 
                                int(latest_record.get("FailedCount", 0)) == 0 and 
                                int(latest_record.get("PassedCount", 0)) > 0
                            )
                        }
                        
                        logger.info(f"Interface result summary (latest of {len(records)} runs):")
                        logger.info(f"  Result Sequence: {summary['result_sequence']}")
                        logger.info(f"  Status: {summary['status_label']} ({summary['status']})")
                        logger.info(f"  Total Records: {summary['total_records']}")
                        logger.info(f"  Successfully Imported: {summary['successfully_imported']}")
                        logger.info(f"  Records with Error: {summary['records_with_error']}")
                        logger.info(f"  Interface Successful: {summary['interface_successful']}")
                        
                        return summary
                    else:
                        logger.warning(f"No valid records found in response")
                        return None
                else:
                    logger.warning(f"No results found for RunGroup: {run_group}")
                    return None
                
            except httpx.HTTPStatusError as e:
                logger.error(f"Query failed: {e.response.status_code} - {e.response.text}")
                # If it's a filter syntax error, try without the date filter
                if "ConditionNode tree failed" in e.response.text or "Expected a logical operator" in e.response.text:
                    logger.warning(f"Filter syntax error, retrying without date filter...")
                    # Retry with simpler filter
                    simple_params = params.copy()
                    simple_params["_lplFilter"] = f'RunGroup = "{run_group}"'
                    
                    retry_response = await client.get(url, headers={"Authorization": f"Bearer {self.access_token}"}, params=simple_params)
                    if retry_response.status_code == 200:
                        result = retry_response.json()
                        logger.info(f"Retry successful with simple filter")
                    else:
                        raise Exception(f"Query failed even with simple filter: {retry_response.status_code} - {retry_response.text}")
                else:
                    raise Exception(f"Query failed: {e.response.status_code} - {e.response.text}")
            except Exception as e:
                logger.error(f"Query error: {str(e)}")
                raise Exception(f"Query error: {str(e)}")
    
    async def query_gl_transaction_interface_errors(
        self,
        run_group: str
    ) -> List[Dict]:
        """
        Query GLTransactionInterface records to get detailed error information for failed records.
        Returns list of records with their error messages.
        
        URL format:
        {base_url}/{tenant_id}/FSM/fsm/soap/classes/GLTransactionInterface/lists/_generic?
        _fields=GLTransactionInterface.SequenceNumber,GLTransactionInterface.RunGroup,GLTransactionInterface.ErrorMessage,GLTransactionInterface.Description,GLTransactionInterface.TransactionAmount,GLTransactionInterface.AccountCode
        &_limit=1000
        &_lplFilter=GLTransactionInterface.RunGroup = "{run_group}" AND GLTransactionInterface.ErrorMessage <> ""
        &_links=false&_pageNav=true&_out=JSON&_flatten=false&_omitCountValue=false
        """
        await self._ensure_authenticated()
        
        # Build URL
        url = f"{self.base_url}/{self.tenant_id}/FSM/fsm/soap/classes/GLTransactionInterface/lists/_generic"
        
        # Build query parameters - get records with error messages
        params = {
            "_fields": "GLTransactionInterface.SequenceNumber,GLTransactionInterface.RunGroup,GLTransactionInterface.ErrorMessage,GLTransactionInterface.Description,GLTransactionInterface.TransactionAmount,GLTransactionInterface.AccountCode,GLTransactionInterface.PostingDate,GLTransactionInterface.FinanceEnterpriseGroup,GLTransactionInterface.AccountingEntity",
            "_limit": "1000",
            "_lplFilter": f'GLTransactionInterface.RunGroup = "{run_group}" AND GLTransactionInterface.ErrorMessage <> ""',
            "_links": "false",
            "_pageNav": "true",
            "_out": "JSON",
            "_flatten": "false",
            "_omitCountValue": "false"
        }
        
        logger.info(f"Querying GLTransactionInterface errors for RunGroup: {run_group}")
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    params=params
                )
                response.raise_for_status()
                
                result = response.json()
                logger.info(f"Error query completed successfully")
                
                # Response format: [metadata, record1, record2, ...]
                # Extract error records (skip first element which is metadata)
                error_records = []
                if isinstance(result, list) and len(result) > 1:
                    for i in range(1, len(result)):  # Skip metadata at index 0
                        if isinstance(result[i], dict) and "_fields" in result[i]:
                            fields = result[i]["_fields"]
                            error_records.append({
                                "sequence_number": fields.get("GLTransactionInterface.SequenceNumber", ""),
                                "run_group": fields.get("GLTransactionInterface.RunGroup", ""),
                                "error_message": fields.get("GLTransactionInterface.ErrorMessage", ""),
                                "description": fields.get("GLTransactionInterface.Description", ""),
                                "transaction_amount": fields.get("GLTransactionInterface.TransactionAmount", ""),
                                "account_code": fields.get("GLTransactionInterface.AccountCode", ""),
                                "posting_date": fields.get("GLTransactionInterface.PostingDate", ""),
                                "finance_enterprise_group": fields.get("GLTransactionInterface.FinanceEnterpriseGroup", ""),
                                "accounting_entity": fields.get("GLTransactionInterface.AccountingEntity", "")
                            })
                
                logger.info(f"Found {len(error_records)} records with interface errors")
                return error_records
                
            except httpx.HTTPStatusError as e:
                logger.error(f"Error query failed: {e.response.status_code} - {e.response.text}")
                # Try with simpler filter if complex filter fails
                if "ConditionNode tree failed" in e.response.text:
                    logger.warning(f"Complex filter failed, trying simpler approach...")
                    # Get all records for RunGroup and filter client-side
                    simple_params = {
                        "_fields": "GLTransactionInterface.SequenceNumber,GLTransactionInterface.RunGroup,GLTransactionInterface.ErrorMessage,GLTransactionInterface.Description,GLTransactionInterface.TransactionAmount,GLTransactionInterface.AccountCode,GLTransactionInterface.PostingDate,GLTransactionInterface.FinanceEnterpriseGroup,GLTransactionInterface.AccountingEntity",
                        "_limit": "1000",
                        "_lplFilter": f'GLTransactionInterface.RunGroup = "{run_group}"',
                        "_links": "false",
                        "_pageNav": "true",
                        "_out": "JSON",
                        "_flatten": "false",
                        "_omitCountValue": "false"
                    }
                    
                    retry_response = await client.get(url, headers={"Authorization": f"Bearer {self.access_token}"}, params=simple_params)
                    retry_response.raise_for_status()
                    
                    result = retry_response.json()
                    error_records = []
                    if isinstance(result, list) and len(result) > 1:
                        for i in range(1, len(result)):
                            if isinstance(result[i], dict) and "_fields" in result[i]:
                                fields = result[i]["_fields"]
                                error_msg = fields.get("GLTransactionInterface.ErrorMessage", "")
                                # Filter client-side for non-empty error messages
                                if error_msg and error_msg.strip():
                                    error_records.append({
                                        "sequence_number": fields.get("GLTransactionInterface.SequenceNumber", ""),
                                        "run_group": fields.get("GLTransactionInterface.RunGroup", ""),
                                        "error_message": error_msg,
                                        "description": fields.get("GLTransactionInterface.Description", ""),
                                        "transaction_amount": fields.get("GLTransactionInterface.TransactionAmount", ""),
                                        "account_code": fields.get("GLTransactionInterface.AccountCode", ""),
                                        "posting_date": fields.get("GLTransactionInterface.PostingDate", ""),
                                        "finance_enterprise_group": fields.get("GLTransactionInterface.FinanceEnterpriseGroup", ""),
                                        "accounting_entity": fields.get("GLTransactionInterface.AccountingEntity", "")
                                    })
                    
                    logger.info(f"Found {len(error_records)} records with interface errors (client-side filtered)")
                    return error_records
                else:
                    raise Exception(f"Error query failed: {e.response.status_code} - {e.response.text}")
            except Exception as e:
                logger.error(f"Error query error: {str(e)}")
                raise Exception(f"Error query error: {str(e)}")

    async def check_run_group_exists(
        self,
        run_group: str
    ) -> Dict:
        """
        Check if a RunGroup already exists in GLTransactionInterface.
        Returns count of existing records for the RunGroup.
        
        URL format:
        {base_url}/{tenant_id}/FSM/fsm/soap/classes/GLTransactionInterface/lists/_generic?
        _fields=GLTransactionInterface.RunGroup
        &_limit=1
        &_lplFilter=GLTransactionInterface.RunGroup = "{run_group}"
        &_links=false&_pageNav=true&_out=JSON&_flatten=false&_omitCountValue=false
        """
        await self._ensure_authenticated()
        
        # Build URL
        url = f"{self.base_url}/{self.tenant_id}/FSM/fsm/soap/classes/GLTransactionInterface/lists/_generic"
        
        # Build query parameters
        params = {
            "_fields": "GLTransactionInterface.RunGroup",
            "_limit": "1",
            "_lplFilter": f'GLTransactionInterface.RunGroup = "{run_group}"',
            "_links": "false",
            "_pageNav": "true",
            "_out": "JSON",
            "_flatten": "false",
            "_omitCountValue": "false"
        }
        
        logger.info(f"Checking if RunGroup exists: {run_group}")
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    params=params
                )
                response.raise_for_status()
                
                result = response.json()
                
                # Response format: [metadata, record1, record2, ...]
                # Check metadata for count
                if isinstance(result, list) and len(result) > 0:
                    metadata = result[0]
                    record_count = metadata.get("_count", 0)
                    
                    exists = record_count > 0
                    logger.info(f"RunGroup '{run_group}' exists: {exists}, count: {record_count}")
                    
                    return {
                        "exists": exists,
                        "record_count": record_count,
                        "run_group": run_group
                    }
                else:
                    logger.warning(f"Unexpected response format")
                    return {
                        "exists": False,
                        "record_count": 0,
                        "run_group": run_group
                    }
                
            except httpx.HTTPStatusError as e:
                logger.error(f"Check failed: {e.response.status_code} - {e.response.text}")
                raise Exception(f"Check failed: {e.response.status_code} - {e.response.text}")
            except Exception as e:
                logger.error(f"Check error: {str(e)}")
                raise Exception(f"Check error: {str(e)}")
