import hashlib
import json

def compute_schema_hash(schema_json: dict) -> str:
    """Compute SHA256 hash of schema JSON for versioning"""
    schema_str = json.dumps(schema_json, sort_keys=True)
    return hashlib.sha256(schema_str.encode()).hexdigest()
