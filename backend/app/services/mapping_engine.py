from typing import Dict, List, Tuple
from Levenshtein import distance as levenshtein_distance
from app.core.logging import logger

class MappingEngine:
    """
    Intelligent field mapping engine.
    Performs exact match and fuzzy match using Levenshtein distance.
    """
    
    # Confidence thresholds
    EXACT_MATCH = "exact"
    HIGH_CONFIDENCE = "high"
    MEDIUM_CONFIDENCE = "medium"
    LOW_CONFIDENCE = "low"
    UNMAPPED = "unmapped"
    
    @staticmethod
    def auto_map_fields(
        csv_headers: List[str],
        fsm_fields: List[str]
    ) -> Dict[str, Dict]:
        """
        Auto-map CSV columns to FSM fields.
        Returns mapping with confidence scores.
        
        Returns:
            {
                "csv_column": {
                    "fsm_field": "matched_field",
                    "confidence": "exact|high|medium|low|unmapped",
                    "score": float
                }
            }
        """
        logger.info(f"Auto-mapping {len(csv_headers)} CSV columns to {len(fsm_fields)} FSM fields")
        
        mapping = {}
        used_fsm_fields = set()
        
        for csv_col in csv_headers:
            # Skip internal fields
            if csv_col.startswith('_'):
                continue
            
            best_match, confidence, score = MappingEngine._find_best_match(
                csv_col,
                fsm_fields,
                used_fsm_fields
            )
            
            if best_match:
                used_fsm_fields.add(best_match)
            
            mapping[csv_col] = {
                "fsm_field": best_match,
                "confidence": confidence,
                "score": score
            }
            
            logger.debug(f"Mapped '{csv_col}' -> '{best_match}' ({confidence}, score={score:.2f})")
        
        # Log summary
        exact = sum(1 for m in mapping.values() if m["confidence"] == MappingEngine.EXACT_MATCH)
        high = sum(1 for m in mapping.values() if m["confidence"] == MappingEngine.HIGH_CONFIDENCE)
        medium = sum(1 for m in mapping.values() if m["confidence"] == MappingEngine.MEDIUM_CONFIDENCE)
        low = sum(1 for m in mapping.values() if m["confidence"] == MappingEngine.LOW_CONFIDENCE)
        unmapped = sum(1 for m in mapping.values() if m["confidence"] == MappingEngine.UNMAPPED)
        
        logger.info(f"Mapping summary: {exact} exact, {high} high, {medium} medium, {low} low, {unmapped} unmapped")
        
        return mapping
    
    @staticmethod
    def _find_best_match(
        csv_col: str,
        fsm_fields: List[str],
        used_fields: set
    ) -> Tuple[str, str, float]:
        """
        Find best matching FSM field for CSV column.
        Returns: (best_match, confidence, score)
        """
        csv_col_normalized = MappingEngine._normalize_field_name(csv_col)
        
        best_match = None
        best_score = float('inf')
        
        for fsm_field in fsm_fields:
            # Skip already used fields
            if fsm_field in used_fields:
                continue
            
            fsm_field_normalized = MappingEngine._normalize_field_name(fsm_field)
            
            # Exact match (case-insensitive)
            if csv_col_normalized == fsm_field_normalized:
                return fsm_field, MappingEngine.EXACT_MATCH, 0.0
            
            # Calculate Levenshtein distance
            distance = levenshtein_distance(csv_col_normalized, fsm_field_normalized)
            
            if distance < best_score:
                best_score = distance
                best_match = fsm_field
        
        # Determine confidence based on distance
        if best_match is None:
            return None, MappingEngine.UNMAPPED, 1.0
        
        # Normalize score (0-1 range)
        max_len = max(len(csv_col_normalized), len(MappingEngine._normalize_field_name(best_match)))
        normalized_score = best_score / max_len if max_len > 0 else 1.0
        
        # Assign confidence level
        if normalized_score <= 0.2:
            confidence = MappingEngine.HIGH_CONFIDENCE
        elif normalized_score <= 0.4:
            confidence = MappingEngine.MEDIUM_CONFIDENCE
        elif normalized_score <= 0.6:
            confidence = MappingEngine.LOW_CONFIDENCE
        else:
            # Too different, don't map
            return None, MappingEngine.UNMAPPED, normalized_score
        
        return best_match, confidence, normalized_score
    
    @staticmethod
    def _normalize_field_name(field_name: str) -> str:
        """
        Normalize field name for comparison.
        Removes spaces, underscores, converts to lowercase.
        """
        return field_name.replace('_', '').replace(' ', '').replace('-', '').lower()
    
    @staticmethod
    def apply_mapping(
        record: Dict,
        mapping: Dict[str, Dict]
    ) -> Dict:
        """
        Apply field mapping to a record.
        Transforms CSV column names to FSM field names.
        """
        mapped_record = {}
        
        for csv_col, value in record.items():
            # Skip internal fields and None keys (from trailing commas in CSV)
            if csv_col is None or csv_col.startswith('_'):
                mapped_record[csv_col] = value
                continue
            
            # Get mapping
            mapping_info = mapping.get(csv_col)
            
            if mapping_info and mapping_info["fsm_field"]:
                fsm_field = mapping_info["fsm_field"]
                mapped_record[fsm_field] = value
            else:
                # Keep unmapped fields with original name
                mapped_record[csv_col] = value
        
        return mapped_record
    
    @staticmethod
    def validate_mapping(
        mapping: Dict[str, Dict],
        required_fields: List[str]
    ) -> Dict:
        """
        Validate that all required FSM fields are mapped.
        Returns validation result with missing fields.
        """
        mapped_fsm_fields = set()
        
        for csv_col, mapping_info in mapping.items():
            if mapping_info["fsm_field"]:
                mapped_fsm_fields.add(mapping_info["fsm_field"])
        
        missing_required = [
            field for field in required_fields
            if field not in mapped_fsm_fields
        ]
        
        is_valid = len(missing_required) == 0
        
        return {
            "is_valid": is_valid,
            "missing_required_fields": missing_required,
            "mapped_fields_count": len(mapped_fsm_fields),
            "required_fields_count": len(required_fields)
        }
