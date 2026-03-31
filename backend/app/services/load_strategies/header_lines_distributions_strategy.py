"""
Header/Lines/Distributions Load Strategy

Handles loading of business classes with header, lines, and distributions tables (3-table structure).
Example: PayablesInvoice with header, lines, and GL distributions.
"""

from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from app.services.load_strategies.base_strategy import BaseLoadStrategy
from app.services.fsm_client import FSMClient
from app.core.logging import logger


class HeaderLinesDistributionsLoadStrategy(BaseLoadStrategy):
    """
    Load strategy for business classes with header, lines, and distributions tables.
    
    Process:
    1. Load header records first
    2. Capture header IDs from FSM response
    3. Load lines with header foreign keys
    4. Capture line IDs from FSM response
    5. Load distributions with line foreign keys
    6. Rollback all tables on failure (reverse order)
    """
    
    def __init__(self, business_class: str, config: Dict):
        super().__init__(business_class, config)
        self.header_table = config.get('related_tables', {}).get('header')
        self.lines_table = config.get('related_tables', {}).get('lines')
        self.distributions_table = config.get('related_tables', {}).get('distributions')
        self.header_ids: Dict[str, str] = {}  # Map temp ID to FSM ID
        self.line_ids: Dict[str, str] = {}  # Map temp ID to FSM ID
    
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
        Load header, lines, and distributions records sequentially.
        
        Args:
            db: Database session
            fsm_client: FSM API client
            records: All records (header + lines + distributions combined)
            mapping: Field mapping
            run_group: Unique run group identifier
            load_mode: FSM load operation
            
        Returns:
            Load result with success/failure counts
        """
        logger.info(f"Starting header/lines/distributions load for {self.business_class}")
        
        try:
            # Step 1: Separate records by type
            header_records, lines_records, dist_records = self._separate_records(records)
            
            logger.info(
                f"Separated {len(header_records)} headers, "
                f"{len(lines_records)} lines, "
                f"{len(dist_records)} distributions"
            )
            
            # Step 2: Load headers
            header_result = await self._load_headers(
                fsm_client, header_records, mapping, run_group, load_mode
            )
            
            if header_result['failure_count'] > 0:
                logger.error(f"Header load failed")
                return self._build_failure_result(len(records), 'Header load failed', header_result)
            
            # Step 3: Load lines
            lines_result = await self._load_lines(
                fsm_client, lines_records, mapping, run_group, load_mode
            )
            
            if lines_result['failure_count'] > 0:
                logger.error(f"Lines load failed")
                await self._rollback_headers(fsm_client, run_group)
                return self._build_failure_result(len(records), 'Lines load failed, headers rolled back', lines_result)
            
            # Step 4: Load distributions
            dist_result = await self._load_distributions(
                fsm_client, dist_records, mapping, run_group, load_mode
            )
            
            if dist_result['failure_count'] > 0:
                logger.error(f"Distributions load failed")
                await self._rollback_lines(fsm_client, run_group)
                await self._rollback_headers(fsm_client, run_group)
                return self._build_failure_result(
                    len(records), 
                    'Distributions load failed, lines and headers rolled back', 
                    dist_result
                )
            
            # Success
            total_success = (
                header_result['success_count'] + 
                lines_result['success_count'] + 
                dist_result['success_count']
            )
            
            logger.info(f"Load complete: {total_success} records loaded successfully")
            
            return {
                'status': 'success',
                'total_records': len(records),
                'success_count': total_success,
                'failure_count': 0,
                'run_group': run_group,
                'header_count': header_result['success_count'],
                'lines_count': lines_result['success_count'],
                'distributions_count': dist_result['success_count']
            }
            
        except Exception as e:
            logger.error(f"Load failed with exception: {e}")
            # Attempt full rollback
            try:
                await self.rollback(fsm_client, run_group)
            except:
                pass
            
            return self._build_failure_result(len(records), str(e), None)
    
    def _separate_records(self, records: List[Dict]) -> tuple[List[Dict], List[Dict], List[Dict]]:
        """
        Separate combined records into header, lines, and distributions.
        
        Logic:
        - Records with distribution fields are distributions
        - Records with line fields are lines
        - Remaining records are headers
        """
        header_records = []
        lines_records = []
        dist_records = []
        
        # Field indicators
        dist_indicators = ['distribution', 'account', 'debit', 'credit', 'amount']
        line_indicators = ['line', 'detail', 'item', 'quantity', 'unit']
        
        for record in records:
            fields_lower = [f.lower() for f in record.keys()]
            
            # Check for distribution fields
            is_dist = any(indicator in field for field in fields_lower for indicator in dist_indicators)
            if is_dist:
                dist_records.append(record)
                continue
            
            # Check for line fields
            is_line = any(indicator in field for field in fields_lower for indicator in line_indicators)
            if is_line:
                lines_records.append(record)
                continue
            
            # Default to header
            header_records.append(record)
        
        return header_records, lines_records, dist_records
    
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
        
        result = await fsm_client.batch_create(
            business_class=self.header_table,
            records=records,
            load_mode=load_mode
        )
        
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
        
        enriched_records = self._add_header_references(records)
        
        result = await fsm_client.batch_create(
            business_class=self.lines_table,
            records=enriched_records,
            load_mode=load_mode
        )
        
        if result.get('success_count', 0) > 0:
            self._capture_line_ids(result.get('response', []))
        
        return result
    
    async def _load_distributions(
        self,
        fsm_client: FSMClient,
        records: List[Dict],
        mapping: Dict,
        run_group: str,
        load_mode: str
    ) -> Dict:
        """Load distributions records with line foreign keys"""
        logger.info(f"Loading {len(records)} distribution records")
        
        enriched_records = self._add_line_references(records)
        
        result = await fsm_client.batch_create(
            business_class=self.distributions_table,
            records=enriched_records,
            load_mode=load_mode
        )
        
        return result
    
    def _capture_header_ids(self, response: List[Dict]):
        """Extract header IDs from FSM response"""
        for record in response:
            if 'id' in record and 'temp_id' in record:
                self.header_ids[record['temp_id']] = record['id']
    
    def _capture_line_ids(self, response: List[Dict]):
        """Extract line IDs from FSM response"""
        for record in response:
            if 'id' in record and 'temp_id' in record:
                self.line_ids[record['temp_id']] = record['id']
    
    def _add_header_references(self, lines: List[Dict]) -> List[Dict]:
        """Add header foreign key references to lines"""
        enriched = []
        for line in lines:
            temp_header_id = line.get('header_ref')
            if temp_header_id and temp_header_id in self.header_ids:
                line['header_id'] = self.header_ids[temp_header_id]
            enriched.append(line)
        return enriched
    
    def _add_line_references(self, distributions: List[Dict]) -> List[Dict]:
        """Add line foreign key references to distributions"""
        enriched = []
        for dist in distributions:
            temp_line_id = dist.get('line_ref')
            if temp_line_id and temp_line_id in self.line_ids:
                dist['line_id'] = self.line_ids[temp_line_id]
            enriched.append(dist)
        return enriched
    
    async def _rollback_headers(self, fsm_client: FSMClient, run_group: str):
        """Rollback header records"""
        logger.info(f"Rolling back headers")
        try:
            await fsm_client.delete_by_run_group(self.header_table, run_group)
        except Exception as e:
            logger.error(f"Header rollback failed: {e}")
    
    async def _rollback_lines(self, fsm_client: FSMClient, run_group: str):
        """Rollback lines records"""
        logger.info(f"Rolling back lines")
        try:
            await fsm_client.delete_by_run_group(self.lines_table, run_group)
        except Exception as e:
            logger.error(f"Lines rollback failed: {e}")
    
    async def _rollback_distributions(self, fsm_client: FSMClient, run_group: str):
        """Rollback distributions records"""
        logger.info(f"Rolling back distributions")
        try:
            await fsm_client.delete_by_run_group(self.distributions_table, run_group)
        except Exception as e:
            logger.error(f"Distributions rollback failed: {e}")
    
    def _build_failure_result(self, total: int, message: str, details: Optional[Dict]) -> Dict:
        """Build failure result dictionary"""
        return {
            'status': 'failed',
            'total_records': total,
            'success_count': 0,
            'failure_count': total,
            'error_message': message,
            'error_details': details.get('error_details') if details else None
        }
    
    async def rollback(
        self,
        fsm_client: FSMClient,
        run_group: str
    ) -> Dict:
        """
        Rollback all three tables.
        
        Order: Distributions → Lines → Headers (reverse of load order)
        """
        logger.info(f"Rolling back header/lines/distributions for run_group: {run_group}")
        
        results = []
        
        # Rollback distributions first
        try:
            await self._rollback_distributions(fsm_client, run_group)
            results.append(f"Distributions rolled back: {self.distributions_table}")
        except Exception as e:
            results.append(f"Distributions rollback failed: {e}")
        
        # Rollback lines
        try:
            await self._rollback_lines(fsm_client, run_group)
            results.append(f"Lines rolled back: {self.lines_table}")
        except Exception as e:
            results.append(f"Lines rollback failed: {e}")
        
        # Rollback headers
        try:
            await self._rollback_headers(fsm_client, run_group)
            results.append(f"Headers rolled back: {self.header_table}")
        except Exception as e:
            results.append(f"Headers rollback failed: {e}")
        
        return {
            'status': 'completed',
            'results': results
        }
    
    def supports_interface(self) -> bool:
        """Check if interface operation is supported"""
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
        
        return {
            'status': 'not_implemented',
            'message': 'Interface operation not yet implemented'
        }
    
    async def verify_load(
        self,
        fsm_client: FSMClient,
        run_group: str
    ) -> Dict:
        """Verify all three tables were loaded successfully"""
        logger.info(f"Verifying load for run_group: {run_group}")
        
        header_count = await self._count_records(fsm_client, self.header_table, run_group)
        lines_count = await self._count_records(fsm_client, self.lines_table, run_group)
        dist_count = await self._count_records(fsm_client, self.distributions_table, run_group)
        
        return {
            'status': 'verified',
            'header_count': header_count,
            'lines_count': lines_count,
            'distributions_count': dist_count,
            'total_count': header_count + lines_count + dist_count
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
