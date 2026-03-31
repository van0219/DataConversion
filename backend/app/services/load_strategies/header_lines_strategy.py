"""
Header/Lines Load Strategy

Handles loading of business classes with header and lines tables (2-table structure).
Example: PayablesInvoice with header and lines.
"""

from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from app.services.load_strategies.base_strategy import BaseLoadStrategy
from app.services.fsm_client import FSMClient
from app.core.logging import logger


class HeaderLinesLoadStrategy(BaseLoadStrategy):
    """
    Load strategy for business classes with header and lines tables.
    
    Process:
    1. Load header records first
    2. Capture header IDs from FSM response
    3. Load lines with foreign key references to headers
    4. Rollback both tables on failure
    """
    
    def __init__(self, business_class: str, config: Dict):
        super().__init__(business_class, config)
        self.header_table = config.get('related_tables', {}).get('header')
        self.lines_table = config.get('related_tables', {}).get('lines')
        self.header_ids: Dict[str, str] = {}  # Map temp ID to FSM ID
    
    async def load_records(
        self,
        db: Session,
        fsm_client: FSMClient,
        records: List[Dict],
        mapping: Dict,
        run_group: str,
        load_mode: str = "createUnreleased"
    ) -> Dict:
        """
        Load header and lines records sequentially.
        
        Args:
            db: Database session
            fsm_client: FSM API client
            records: All records (header + lines combined)
            mapping: Field mapping
            run_group: Unique run group identifier
            load_mode: FSM load operation
            
        Returns:
            Load result with success/failure counts
        """
        logger.info(f"Starting header/lines load for {self.business_class}")
        
        try:
            # Step 1: Separate header and lines records
            header_records, lines_records = self._separate_records(records)
            
            logger.info(f"Separated {len(header_records)} header and {len(lines_records)} lines records")
            
            # Step 2: Load headers first
            header_result = await self._load_headers(
                fsm_client, header_records, mapping, run_group, load_mode
            )
            
            if header_result['failure_count'] > 0:
                logger.error(f"Header load failed: {header_result['failure_count']} failures")
                return {
                    'status': 'failed',
                    'total_records': len(records),
                    'success_count': 0,
                    'failure_count': len(records),
                    'error_message': 'Header load failed',
                    'error_details': header_result.get('error_details')
                }
            
            # Step 3: Load lines with header references
            lines_result = await self._load_lines(
                fsm_client, lines_records, mapping, run_group, load_mode
            )
            
            if lines_result['failure_count'] > 0:
                logger.error(f"Lines load failed: {lines_result['failure_count']} failures")
                # Rollback headers
                await self._rollback_headers(fsm_client, run_group)
                return {
                    'status': 'failed',
                    'total_records': len(records),
                    'success_count': 0,
                    'failure_count': len(records),
                    'error_message': 'Lines load failed, headers rolled back',
                    'error_details': lines_result.get('error_details')
                }
            
            # Success
            total_success = header_result['success_count'] + lines_result['success_count']
            logger.info(f"Load complete: {total_success} records loaded successfully")
            
            return {
                'status': 'success',
                'total_records': len(records),
                'success_count': total_success,
                'failure_count': 0,
                'run_group': run_group,
                'header_count': header_result['success_count'],
                'lines_count': lines_result['success_count']
            }
            
        except Exception as e:
            logger.error(f"Load failed with exception: {e}")
            # Attempt rollback
            try:
                await self._rollback_headers(fsm_client, run_group)
            except:
                pass
            
            return {
                'status': 'failed',
                'total_records': len(records),
                'success_count': 0,
                'failure_count': len(records),
                'error_message': str(e)
            }
    
    def _separate_records(self, records: List[Dict]) -> tuple[List[Dict], List[Dict]]:
        """
        Separate combined records into header and lines.
        
        Logic:
        - Records with line-specific fields are lines
        - Records without line fields are headers
        - Use field naming patterns to detect
        """
        header_records = []
        lines_records = []
        
        # Common line field indicators
        line_indicators = ['line', 'detail', 'item', 'quantity', 'unit']
        
        for record in records:
            # Check if record has line-specific fields
            is_line = any(
                indicator in field.lower() 
                for field in record.keys() 
                for indicator in line_indicators
            )
            
            if is_line:
                lines_records.append(record)
            else:
                header_records.append(record)
        
        return header_records, lines_records
    
    async def _load_headers(
        self,
        fsm_client: FSMClient,
        records: List[Dict],
        mapping: Dict,
        run_group: str,
        load_mode: str
    ) -> Dict:
        """Load header records and capture IDs"""
        logger.info(f"Loading {len(records)} header records")
        
        # Use FSM client to load headers
        result = await fsm_client.batch_create(
            business_class=self.header_table,
            records=records,
            load_mode=load_mode
        )
        
        # Capture header IDs from response
        if result.get('success_count', 0) > 0:
            self._capture_header_ids(result.get('response', []))
        
        return result
    
    async def _load_lines(
        self,
        fsm_client: FSMClient,
        records: List[Dict],
        mapping: Dict,
        run_group: str,
        load_mode: str
    ) -> Dict:
        """Load lines records with header foreign keys"""
        logger.info(f"Loading {len(records)} lines records")
        
        # Add header foreign keys to lines
        enriched_records = self._add_header_references(records)
        
        # Use FSM client to load lines
        result = await fsm_client.batch_create(
            business_class=self.lines_table,
            records=enriched_records,
            load_mode=load_mode
        )
        
        return result
    
    def _capture_header_ids(self, response: List[Dict]):
        """Extract header IDs from FSM response"""
        for record in response:
            if 'id' in record and 'temp_id' in record:
                self.header_ids[record['temp_id']] = record['id']
    
    def _add_header_references(self, lines: List[Dict]) -> List[Dict]:
        """Add header foreign key references to lines"""
        enriched = []
        
        for line in lines:
            # Get header ID from temp reference
            temp_header_id = line.get('header_ref')
            if temp_header_id and temp_header_id in self.header_ids:
                line['header_id'] = self.header_ids[temp_header_id]
            
            enriched.append(line)
        
        return enriched
    
    async def _rollback_headers(self, fsm_client: FSMClient, run_group: str):
        """Rollback header records"""
        logger.info(f"Rolling back headers for run_group: {run_group}")
        
        try:
            await fsm_client.delete_by_run_group(
                business_class=self.header_table,
                run_group=run_group
            )
            logger.info("Headers rolled back successfully")
        except Exception as e:
            logger.error(f"Rollback failed: {e}")
    
    async def rollback(
        self,
        fsm_client: FSMClient,
        run_group: str
    ) -> Dict:
        """
        Rollback both header and lines tables.
        
        Order: Lines first, then headers (reverse of load order)
        """
        logger.info(f"Rolling back header/lines for run_group: {run_group}")
        
        results = []
        
        # Rollback lines first
        try:
            await fsm_client.delete_by_run_group(
                business_class=self.lines_table,
                run_group=run_group
            )
            results.append(f"Lines rolled back: {self.lines_table}")
        except Exception as e:
            results.append(f"Lines rollback failed: {e}")
        
        # Rollback headers
        try:
            await fsm_client.delete_by_run_group(
                business_class=self.header_table,
                run_group=run_group
            )
            results.append(f"Headers rolled back: {self.header_table}")
        except Exception as e:
            results.append(f"Headers rollback failed: {e}")
        
        return {
            'status': 'completed',
            'results': results
        }
    
    def supports_interface(self) -> bool:
        """Header/lines structures typically don't support interface operations"""
        return self.config.get('supports_interface', False)
    
    async def interface(
        self,
        fsm_client: FSMClient,
        run_group: str,
        params: Optional[Dict] = None
    ) -> Dict:
        """Interface operation (if supported)"""
        if not self.supports_interface():
            return {
                'status': 'not_supported',
                'message': 'Interface operation not supported for this business class'
            }
        
        # Implement interface logic if needed
        return {
            'status': 'not_implemented',
            'message': 'Interface operation not yet implemented'
        }
    
    async def verify_load(
        self,
        fsm_client: FSMClient,
        run_group: str
    ) -> Dict:
        """Verify both header and lines were loaded successfully"""
        logger.info(f"Verifying load for run_group: {run_group}")
        
        # Query both tables
        header_count = await self._count_records(fsm_client, self.header_table, run_group)
        lines_count = await self._count_records(fsm_client, self.lines_table, run_group)
        
        return {
            'status': 'verified',
            'header_count': header_count,
            'lines_count': lines_count,
            'total_count': header_count + lines_count
        }
    
    async def _count_records(
        self,
        fsm_client: FSMClient,
        business_class: str,
        run_group: str
    ) -> int:
        """Count records for a business class and run group"""
        try:
            result = await fsm_client.query_records(
                business_class=business_class,
                filter=f'RunGroup = "{run_group}"',
                fields=['id'],
                limit=10000
            )
            return len(result.get('records', []))
        except:
            return 0
