"""In-memory batch upload progress tracker."""
from typing import Dict, Optional, List
from datetime import datetime
import threading


class BatchProgress:
    """Thread-safe progress tracker for batch file uploads."""

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._batches: Dict[str, Dict] = {}
        return cls._instance

    def start(self, batch_id: str, filenames: List[str]):
        with self._lock:
            self._batches[batch_id] = {
                "batch_id": batch_id,
                "running": True,
                "cancelled": False,
                "files": {f: {"status": "queued"} for f in filenames},
                "completed": 0,
                "total": len(filenames),
                "started_at": datetime.now().isoformat(),
            }

    def update_file(self, batch_id: str, filename: str, **kwargs):
        with self._lock:
            batch = self._batches.get(batch_id)
            if batch and filename in batch["files"]:
                batch["files"][filename].update(kwargs)

    def complete_file(self, batch_id: str, filename: str, **kwargs):
        with self._lock:
            batch = self._batches.get(batch_id)
            if batch and filename in batch["files"]:
                batch["files"][filename].update({"status": "done", **kwargs})
                batch["completed"] = sum(
                    1 for f in batch["files"].values() if f["status"] in ("done", "error")
                )
                if batch["completed"] >= batch["total"]:
                    batch["running"] = False

    def fail_file(self, batch_id: str, filename: str, error: str):
        with self._lock:
            batch = self._batches.get(batch_id)
            if batch and filename in batch["files"]:
                batch["files"][filename].update({"status": "error", "error_message": error})
                batch["completed"] = sum(
                    1 for f in batch["files"].values() if f["status"] in ("done", "error")
                )
                if batch["completed"] >= batch["total"]:
                    batch["running"] = False

    def cancel(self, batch_id: str):
        with self._lock:
            batch = self._batches.get(batch_id)
            if batch:
                batch["cancelled"] = True
                # Mark remaining queued files as cancelled
                for f in batch["files"].values():
                    if f["status"] == "queued":
                        f["status"] = "error"
                        f["error_message"] = "Cancelled"
                batch["running"] = False

    def is_cancelled(self, batch_id: str) -> bool:
        with self._lock:
            batch = self._batches.get(batch_id)
            return batch.get("cancelled", False) if batch else False

    def get(self, batch_id: str) -> Optional[Dict]:
        with self._lock:
            batch = self._batches.get(batch_id)
            if not batch:
                return None
            import copy
            return copy.deepcopy(batch)

    def finish(self, batch_id: str):
        with self._lock:
            batch = self._batches.get(batch_id)
            if batch:
                batch["running"] = False


batch_progress = BatchProgress()
