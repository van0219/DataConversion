"""In-memory sync progress tracker for setup data sync operations."""
from typing import Dict, Optional, List
from datetime import datetime
import threading

class SyncProgress:
    """Thread-safe progress tracker for sync operations."""
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._progress: Dict[str, Dict] = {}
            cls._instance._batch: Optional[Dict] = None
        return cls._instance
    
    # --- Per-class progress ---
    
    def start(self, business_class: str):
        with self._lock:
            self._progress[business_class] = {
                "business_class": business_class,
                "phase": "fetching",
                "records_fetched": 0,
                "records_stored": 0,
                "pages_fetched": 0,
                "current_page_size": 0,
                "started_at": datetime.now().isoformat(),
                "last_update": datetime.now().isoformat(),
                "message": "Connecting to FSM...",
                "done": False,
                "error": None,
                "elapsed_seconds": 0
            }
    
    def update_fetching_page(self, business_class: str, page_num: int, page_size: int, records_so_far: int):
        with self._lock:
            if business_class in self._progress:
                p = self._progress[business_class]
                started = datetime.fromisoformat(p["started_at"])
                elapsed = int((datetime.now() - started).total_seconds())
                p["current_page_size"] = page_size
                p["elapsed_seconds"] = elapsed
                p["last_update"] = datetime.now().isoformat()
                if records_so_far > 0:
                    p["message"] = f"Fetching page {page_num} (limit={page_size})... {records_so_far:,} records so far [{elapsed}s]"
                else:
                    p["message"] = f"Fetching page {page_num} from FSM (limit={page_size})... [{elapsed}s]"
    
    def update_fetch(self, business_class: str, records_fetched: int, pages_fetched: int, page_size: int):
        with self._lock:
            if business_class in self._progress:
                p = self._progress[business_class]
                started = datetime.fromisoformat(p["started_at"])
                elapsed = int((datetime.now() - started).total_seconds())
                p["records_fetched"] = records_fetched
                p["pages_fetched"] = pages_fetched
                p["current_page_size"] = page_size
                p["elapsed_seconds"] = elapsed
                p["last_update"] = datetime.now().isoformat()
                p["message"] = f"Fetched page {pages_fetched} — {records_fetched:,} records so far [{elapsed}s]"
    
    def update_store(self, business_class: str, records_stored: int, total: int):
        with self._lock:
            if business_class in self._progress:
                p = self._progress[business_class]
                started = datetime.fromisoformat(p["started_at"])
                elapsed = int((datetime.now() - started).total_seconds())
                p["phase"] = "storing"
                p["records_stored"] = records_stored
                p["elapsed_seconds"] = elapsed
                p["last_update"] = datetime.now().isoformat()
                p["message"] = f"Storing records... {records_stored:,} / {total:,} [{elapsed}s]"
    
    def complete(self, business_class: str, total_records: int):
        with self._lock:
            if business_class in self._progress:
                p = self._progress[business_class]
                started = datetime.fromisoformat(p["started_at"])
                elapsed = int((datetime.now() - started).total_seconds())
                p["phase"] = "done"
                p["records_stored"] = total_records
                p["done"] = True
                p["elapsed_seconds"] = elapsed
                p["last_update"] = datetime.now().isoformat()
                p["message"] = f"Complete — {total_records:,} records synced in {elapsed}s"
    
    def fail(self, business_class: str, error: str):
        with self._lock:
            if business_class in self._progress:
                p = self._progress[business_class]
                p["phase"] = "error"
                p["done"] = True
                p["error"] = error
                p["last_update"] = datetime.now().isoformat()
                p["message"] = f"Failed: {error}"
    
    def get(self, business_class: str) -> Optional[Dict]:
        with self._lock:
            return self._progress.get(business_class, {}).copy() if business_class in self._progress else None
    
    def get_all(self) -> Dict[str, Dict]:
        with self._lock:
            return {k: v.copy() for k, v in self._progress.items()}
    
    def clear(self, business_class: str):
        with self._lock:
            self._progress.pop(business_class, None)
    
    # --- Batch sync orchestration ---
    
    def start_batch(self, class_names: List[str]):
        with self._lock:
            self._batch = {
                "running": True,
                "started_at": datetime.now().isoformat(),
                "classes": {name: "queued" for name in class_names},
                "current": None,
                "completed": 0,
                "total": len(class_names),
                "results": {}
            }
    
    def set_batch_current(self, class_name: str):
        with self._lock:
            if self._batch:
                self._batch["current"] = class_name
                self._batch["classes"][class_name] = "syncing"
    
    def set_batch_class_done(self, class_name: str, record_count: int):
        with self._lock:
            if self._batch:
                self._batch["classes"][class_name] = "completed"
                self._batch["completed"] += 1
                self._batch["results"][class_name] = {"status": "success", "record_count": record_count}
                if self._batch["completed"] >= self._batch["total"]:
                    self._batch["running"] = False
                    self._batch["current"] = None
    
    def set_batch_class_failed(self, class_name: str, error: str):
        with self._lock:
            if self._batch:
                self._batch["classes"][class_name] = "failed"
                self._batch["completed"] += 1
                self._batch["results"][class_name] = {"status": "failed", "error": error}
                if self._batch["completed"] >= self._batch["total"]:
                    self._batch["running"] = False
                    self._batch["current"] = None
    
    def finish_batch(self):
        with self._lock:
            if self._batch:
                self._batch["running"] = False
                self._batch["current"] = None
    
    def get_batch(self) -> Optional[Dict]:
        with self._lock:
            if not self._batch:
                return None
            import copy
            return copy.deepcopy(self._batch)


sync_progress = SyncProgress()
