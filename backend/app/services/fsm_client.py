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
        """
        await self._ensure_authenticated()
        
        logger.info(f"Batch creating {len(records)} records for {business_class} (trigger_interface={trigger_interface})")
        
        payload = {
            "records": records,
            "triggerInterface": trigger_interface
        }
        
        async with httpx.AsyncClient(timeout=300.0) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/api/classes/{business_class}/actions/CreateUnreleased/batch",
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json"
                    },
                    json=payload
                )
                response.raise_for_status()
                
                result = response.json()
                logger.info(f"Batch create completed: {result.get('successCount', 0)} success, {result.get('failureCount', 0)} failures")
                return result
                
            except httpx.HTTPStatusError as e:
                logger.error(f"Batch create failed: {e.response.status_code} - {e.response.text}")
                raise Exception(f"Batch create failed: {e.response.status_code}")
            except Exception as e:
                logger.error(f"Batch create error: {str(e)}")
                raise Exception(f"Batch create error: {str(e)}")
    
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
        
        async with httpx.AsyncClient(timeout=120.0) as client:
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
    
    async def test_connection(self) -> bool:
        """Test FSM connection and credentials"""
        try:
            await self.authenticate()
            return True
        except Exception:
            return False
