"""
Base Load Strategy

Abstract base class for all load strategies.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session


class BaseLoadStrategy(ABC):
    """
    Abstract base class for FSM load strategies.
    
    Each business class type (single table, header/lines, etc.) 
    implements this interface with its specific logic.
    """
    
    def __init__(self, business_class: str, config: Dict[str, Any]):
        """
        Initialize load strategy.
        
        Args:
            business_class: FSM business class name
            config: Business class configuration from database
        """
        self.business_class = business_class
        self.config = config
    
    @abstractmethod
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
        Load records to FSM.
        
        Args:
            db: Database session
            fsm_client: FSM API client
            records: List of records to load
            mapping: Field mapping configuration
            run_group: Unique run group identifier
            load_mode: Load mode (createUnreleased, createReleased, etc.)
            
        Returns:
            Dict with success_count, failure_count, error_details
        """
        pass
    
    @abstractmethod
    async def rollback(
        self,
        fsm_client: Any,
        run_group: str
    ) -> bool:
        """
        Rollback loaded records.
        
        Args:
            fsm_client: FSM API client
            run_group: Run group to rollback
            
        Returns:
            True if rollback successful, False otherwise
        """
        pass
    
    @abstractmethod
    async def interface(
        self,
        fsm_client: Any,
        run_group: str,
        params: Optional[Dict] = None
    ) -> Dict:
        """
        Interface/post loaded records (if supported).
        
        Args:
            fsm_client: FSM API client
            run_group: Run group to interface
            params: Optional interface parameters
            
        Returns:
            Dict with interface results
        """
        pass
    
    @abstractmethod
    async def verify_load(
        self,
        fsm_client: Any,
        run_group: str
    ) -> Dict:
        """
        Verify load results.
        
        Args:
            fsm_client: FSM API client
            run_group: Run group to verify
            
        Returns:
            Dict with verification results
        """
        pass
    
    def supports_interface(self) -> bool:
        """Check if this business class supports interface operation"""
        return self.config.get('supports_interface', False)
    
    def supports_rungroup(self) -> bool:
        """Check if this business class uses RunGroup"""
        return self.config.get('supports_rungroup', True)
