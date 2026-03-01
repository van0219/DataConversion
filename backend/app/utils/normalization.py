from datetime import datetime
from typing import Optional

def normalize_date(date_str: str) -> Optional[str]:
    """
    Normalize date string to FSM format (YYYYMMDD).
    Supports common formats: MM/DD/YYYY, YYYY-MM-DD, etc.
    """
    if not date_str or str(date_str).strip() == "":
        return None
    
    date_formats = [
        "%m/%d/%Y",
        "%Y-%m-%d",
        "%m-%d-%Y",
        "%d/%m/%Y",
        "%Y/%m/%d",
        "%m/%d/%y",
        "%Y%m%d"
    ]
    
    for fmt in date_formats:
        try:
            dt = datetime.strptime(str(date_str).strip(), fmt)
            return dt.strftime("%Y%m%d")
        except ValueError:
            continue
    
    return None
