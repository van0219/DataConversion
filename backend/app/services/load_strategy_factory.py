"""
Load Strategy Factory

Creates appropriate load strategy based on business class configuration.
"""

from typing import Dict, Optional
from sqlalchemy.orm import Session
from app.services.load_strategies import (
    BaseLoadStrategy,
    SingleTableLoadStrategy,
    HeaderLinesLoadStrategy,
    HeaderLinesDistributionsLoadStrategy
)
from app.models.business_class_config import BusinessClassConfig
from app.models.business_class_registry import BusinessClassRegistry
from app.core.logging import logger


class LoadStrategyFactory:
    """
    Factory for creating load strategies based on business class configuration.
    
    Determines the appropriate strategy from:
    1. BusinessClassConfig table (if configured)
    2. BusinessClassRegistry table (auto-detected structure)
    3. Fallback to single table strategy
    """
    
    STRATEGIES = {
        "single_table": SingleTableLoadStrategy,
        "header_lines": HeaderLinesLoadStrategy,
        "header_lines_distributions": HeaderLinesDistributionsLoadStrategy
    }
    
    @staticmethod
    def create_strategy(
        db: Session,
        business_class: str
    ) -> BaseLoadStrategy:
        """
        Create appropriate load strategy for business class.
        
        Args:
            db: Database session
            business_class: FSM business class name
            
        Returns:
            Appropriate load strategy instance
        """
        logger.info(f"Creating load strategy for {business_class}")
        
        # Try to get explicit configuration first
        config = db.query(BusinessClassConfig).filter(
            BusinessClassConfig.business_class == business_class
        ).first()
        
        if config:
            logger.info(f"Found explicit config: load_type={config.load_type}")
            return LoadStrategyFactory._create_from_config(config)
        
        # Fall back to registry-based detection
        registry = db.query(BusinessClassRegistry).filter(
            BusinessClassRegistry.business_class == business_class
        ).first()
        
        if registry:
            logger.info(f"Found registry entry: structure_type={registry.single_or_multiple}")
            return LoadStrategyFactory._create_from_registry(registry)
        
        # Ultimate fallback: single table
        logger.warning(f"No config or registry found for {business_class}, using single table strategy")
        return LoadStrategyFactory._create_fallback(business_class)
    
    @staticmethod
    def _create_from_config(config: BusinessClassConfig) -> BaseLoadStrategy:
        """Create strategy from explicit configuration"""
        strategy_class = LoadStrategyFactory.STRATEGIES.get(config.load_type)
        
        if not strategy_class:
            logger.warning(f"Unknown load_type: {config.load_type}, falling back to single table")
            strategy_class = SingleTableLoadStrategy
        
        # Build config dict
        config_dict = {
            'load_type': config.load_type,
            'related_tables': config.related_tables,
            'load_sequence': config.load_sequence,
            'supports_interface': config.supports_interface,
            'interface_operation': config.interface_operation,
            'rollback_operation': config.rollback_operation,
            'supports_rungroup': config.supports_rungroup
        }
        
        return strategy_class(config.business_class, config_dict)
    
    @staticmethod
    def _create_from_registry(registry: BusinessClassRegistry) -> BaseLoadStrategy:
        """Create strategy from registry detection"""
        
        # Determine strategy type from structure
        if registry.single_or_multiple == 'single':
            strategy_class = SingleTableLoadStrategy
            load_type = 'single_table'
        else:
            # Multiple tables - determine complexity
            member_count = registry.family_member_count
            
            if member_count <= 2:
                strategy_class = HeaderLinesLoadStrategy
                load_type = 'header_lines'
            else:
                # Check if has distributions
                has_distributions = any(
                    'distribution' in table.lower()
                    for table in (registry.related_business_classes or [])
                )
                
                if has_distributions:
                    strategy_class = HeaderLinesDistributionsLoadStrategy
                    load_type = 'header_lines_distributions'
                else:
                    strategy_class = HeaderLinesLoadStrategy
                    load_type = 'header_lines'
        
        # Build config dict from registry
        config_dict = {
            'load_type': load_type,
            'related_tables': LoadStrategyFactory._infer_related_tables(registry),
            'load_sequence': LoadStrategyFactory._infer_load_sequence(registry),
            'supports_interface': False,  # Default to false for auto-detected
            'supports_rungroup': True  # Most classes support RunGroup
        }
        
        logger.info(f"Created {load_type} strategy from registry")
        
        return strategy_class(registry.business_class, config_dict)
    
    @staticmethod
    def _infer_related_tables(registry: BusinessClassRegistry) -> Optional[Dict]:
        """Infer related tables structure from registry"""
        if not registry.related_business_classes or not registry.table_roles:
            return None
        
        related = {}
        
        for table, role in registry.table_roles.items():
            if role == 'header':
                related['header'] = table
            elif role == 'lines':
                related['lines'] = table
            elif role == 'distributions':
                related['distributions'] = table
        
        return related if related else None
    
    @staticmethod
    def _infer_load_sequence(registry: BusinessClassRegistry) -> Optional[list]:
        """Infer load sequence from table roles"""
        if not registry.table_roles:
            return None
        
        sequence = []
        
        # Standard sequence: header → lines → distributions
        if 'header' in registry.table_roles.values():
            sequence.append('header')
        if 'lines' in registry.table_roles.values():
            sequence.append('lines')
        if 'distributions' in registry.table_roles.values():
            sequence.append('distributions')
        
        return sequence if sequence else None
    
    @staticmethod
    def _create_fallback(business_class: str) -> BaseLoadStrategy:
        """Create fallback single table strategy"""
        config_dict = {
            'load_type': 'single_table',
            'supports_interface': False,
            'supports_rungroup': True
        }
        
        return SingleTableLoadStrategy(business_class, config_dict)
    
    @staticmethod
    def get_strategy_info(db: Session, business_class: str) -> Dict:
        """
        Get information about the strategy that would be used.
        
        Useful for UI display and debugging.
        """
        # Check config
        config = db.query(BusinessClassConfig).filter(
            BusinessClassConfig.business_class == business_class
        ).first()
        
        if config:
            return {
                'source': 'config',
                'load_type': config.load_type,
                'related_tables': config.related_tables,
                'supports_interface': config.supports_interface,
                'supports_rungroup': config.supports_rungroup
            }
        
        # Check registry
        registry = db.query(BusinessClassRegistry).filter(
            BusinessClassRegistry.business_class == business_class
        ).first()
        
        if registry:
            load_type = 'single_table' if registry.single_or_multiple == 'single' else 'header_lines'
            return {
                'source': 'registry',
                'load_type': load_type,
                'structure_type': registry.single_or_multiple,
                'member_count': registry.family_member_count,
                'related_tables': LoadStrategyFactory._infer_related_tables(registry)
            }
        
        # Fallback
        return {
            'source': 'fallback',
            'load_type': 'single_table',
            'supports_interface': False,
            'supports_rungroup': True
        }
