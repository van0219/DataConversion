import json
from pathlib import Path
from typing import Dict, List
from app.core.logging import logger

class DependencyConfig:
    """
    Load and manage dependency_map.json.
    Used ONLY for snapshot orchestration, NOT validation logic.
    """
    
    _config: Dict = {}
    
    @classmethod
    def load(cls):
        """Load dependency map from JSON file"""
        config_path = Path(__file__).parent.parent.parent / "dependency_map.json"
        
        try:
            with open(config_path, 'r') as f:
                cls._config = json.load(f)
            logger.info(f"Loaded dependency map: {len(cls._config)} business classes configured")
        except FileNotFoundError:
            logger.warning("dependency_map.json not found, using empty config")
            cls._config = {}
        except json.JSONDecodeError as e:
            logger.error(f"Invalid dependency_map.json: {e}")
            cls._config = {}
    
    @classmethod
    def get_dependencies(cls, business_class: str) -> Dict[str, str]:
        """
        Get dependency mapping for a business class.
        Returns: {"field_name": "reference_business_class", ...}
        """
        if not cls._config:
            cls.load()
        
        return cls._config.get(business_class, {})
    
    @classmethod
    def get_dependency_business_classes(cls, business_class: str) -> List[str]:
        """
        Get list of business classes that need to be snapshotted.
        Returns unique list of reference business classes.
        """
        dependencies = cls.get_dependencies(business_class)
        return list(set(dependencies.values()))
    
    @classmethod
    def has_dependencies(cls, business_class: str) -> bool:
        """Check if business class has dependencies"""
        return business_class in cls._config and len(cls._config[business_class]) > 0

# Load config on module import
DependencyConfig.load()
