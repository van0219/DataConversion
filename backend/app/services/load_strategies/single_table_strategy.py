"""
Single Table Load Strategy

For business classes with single staging table (e.g., GLTransactionInterface).
"""

from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from .base_strategy import BaseLoadStrategy
from app.core.logging import logger


class SingleTableLoadStrategy(BaseLoadStrategy):
    """
    Load strategy for single-table business classes.
    
    Examples:
    - GLTransactionInterface
    - Simple master data imports
    """
    
    async def load_records(
        self,
        db: Session,
        fsm_client: Any,
        records: List[Dict],
        mapping: Dict,
        run_group: str,
        load_mode: str
    ) -> Dict:
        """
        Load records to single FSM table.
        
        This is the current GLTransactionInterface implementation.
        """
        try:
            # Build FSM payload
            fsm_records = []
            for record in records:
                fsm_record = {
                    "_fields": {},
                    "message": "BatchImport"
                }
                
                # Apply field mapping
                for csv_field, value in record.items():
                    if csv_field in mapping:
                        fsm_field = mapping[csv_field].get('fsm_field')
                        if fsm_field:
                            fsm_record["_fields"][fsm_field] = value or ""
                
                # Add RunGroup
                if self.supports_rungroup():
                    fsm_record["_fields"][f"{self.business_class}.RunGroup"] = run_group
                
                fsm_records.append(fsm_record)
            
            # Call FSM batch API
            response = await fsm_client.batch_create(
                business_class=self.business_class,
                records=fsm_records,
                mode=load_mode
            )
            
            # Parse response
            success_count = 0
            failure_count = 0
            error_details = None
            
            for record in response:
                if "batchStatus" in record:
                    continue
                
                if "exception" in record:
                    failure_count += 1
                    if not error_details:
                        error_details = {
                            "failure_count": failure_count,
                            "fsm_response": response
                        }
                elif "created" in record.get("message", "").lower():
                    success_count += 1
            
            # Rollback on any failure
            if failure_count > 0:
                logger.warning(f"Load failed with {failure_count} errors, rolling back...")
                await self.rollback(fsm_client, run_group)
            
            return {
                "success_count": success_count,
                "failure_count": failure_count,
                "error_details": error_details
            }
            
        except Exception as e:
            logger.error(f"Single table load failed: {e}")
            return {
                "success_count": 0,
                "failure_count": len(records),
                "error_details": {
                    "exception": str(e),
                    "exception_type": type(e).__name__
                }
            }
    
    async def rollback(
        self,
        fsm_client: Any,
        run_group: str
    ) -> bool:
        """Rollback using DeleteAllTransactionsForRunGroup operation"""
        try:
            if not self.supports_rungroup():
                logger.warning(f"{self.business_class} does not support RunGroup rollback")
                return False
            
            rollback_op = self.config.get('rollback_operation')
            if not rollback_op:
                logger.error(f"No rollback operation configured for {self.business_class}")
                return False
            
            await fsm_client.delete_run_group(
                business_class=self.business_class,
                run_group=run_group,
                operation=rollback_op
            )
            
            logger.info(f"Rollback successful for RunGroup: {run_group}")
            return True
            
        except Exception as e:
            logger.error(f"Rollback failed: {e}")
            return False
    
    async def interface(
        self,
        fsm_client: Any,
        run_group: str,
        params: Optional[Dict] = None
    ) -> Dict:
        """Interface transactions (e.g., post to GL)"""
        if not self.supports_interface():
            return {
                "success": False,
                "message": f"{self.business_class} does not support interface operation"
            }
        
        try:
            interface_op = self.config.get('interface_operation')
            if not interface_op:
                return {
                    "success": False,
                    "message": "No interface operation configured"
                }
            
            result = await fsm_client.interface_transactions(
                business_class=self.business_class,
                run_group=run_group,
                operation=interface_op,
                params=params or {}
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Interface failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def verify_load(
        self,
        fsm_client: Any,
        run_group: str
    ) -> Dict:
        """Verify load by querying interface result table"""
        if not self.supports_interface():
            return {
                "verified": False,
                "message": "No verification available for this business class"
            }
        
        try:
            result_table = self.config.get('interface_result_table')
            if not result_table:
                return {
                    "verified": False,
                    "message": "No result table configured"
                }
            
            # Query interface results
            results = await fsm_client.query_interface_results(
                result_table=result_table,
                run_group=run_group
            )
            
            return results
            
        except Exception as e:
            logger.error(f"Verification failed: {e}")
            return {
                "verified": False,
                "error": str(e)
            }
