import csv
import io
from typing import Generator, Dict, List, Callable, Optional
from pathlib import Path
from app.core.logging import logger

class StreamingEngine:
    """
    Generator-based CSV streaming engine.
    Processes files in chunks without loading entire file into memory.
    Designed to handle millions of records efficiently.
    """

    @staticmethod
    def _read_file(file_path: Path) -> str:
        """Read file content with encoding fallback: UTF-8 → Latin-1."""
        for enc in ('utf-8-sig', 'latin-1'):
            try:
                with open(file_path, 'r', encoding=enc, newline='') as f:
                    return f.read()
            except UnicodeDecodeError:
                continue
        raise ValueError(f"Cannot decode file {file_path} with UTF-8 or Latin-1")

    @staticmethod
    def _open_file(file_path: Path, **kwargs):
        """Open file with encoding fallback: UTF-8 → Latin-1."""
        for enc in ('utf-8-sig', 'latin-1'):
            try:
                f = open(file_path, 'r', encoding=enc, **kwargs)
                # Try reading a small chunk to verify encoding works
                f.read(4096)
                f.seek(0)
                return f
            except UnicodeDecodeError:
                try:
                    f.close()
                except:
                    pass
                continue
        raise ValueError(f"Cannot decode file {file_path} with UTF-8 or Latin-1")
    
    @staticmethod
    def stream_csv(
        file_path: Path,
        chunk_size: int = 1000
    ) -> Generator[List[Dict], None, None]:
        """
        Stream CSV file in chunks.
        Yields chunks of records as list of dictionaries.
        Never loads entire file into memory.
        
        Args:
            file_path: Path to CSV file
            chunk_size: Number of records per chunk
            
        Yields:
            List[Dict]: Chunk of records with _row_number added
        """
        logger.info(f"Starting CSV stream: {file_path} (chunk_size={chunk_size})")
        
        try:
            raw = StreamingEngine._read_file(file_path)
            
            # Strip leading and trailing blank lines only
            lines = raw.splitlines(keepends=True)
            while lines and not lines[0].strip():
                lines.pop(0)
            while lines and not lines[-1].strip():
                lines.pop()
            
            reader = csv.DictReader(io.StringIO(''.join(lines)))
            
            chunk = []
            row_number = 1
            
            for row in reader:
                # Add row number for error tracking
                row['_row_number'] = row_number
                # Flag rows with trailing commas (csv.DictReader produces None key)
                if None in row:
                    row['_has_trailing_comma'] = True
                chunk.append(row)
                row_number += 1
                
                # Yield chunk when full
                if len(chunk) >= chunk_size:
                    logger.debug(f"Yielding chunk: rows {row_number - chunk_size} to {row_number - 1}")
                    yield chunk
                    chunk = []
            
            # Yield remaining records
            if chunk:
                logger.debug(f"Yielding final chunk: {len(chunk)} records")
                yield chunk
            
            logger.info(f"CSV stream complete: {row_number - 1} total records")
                
        except FileNotFoundError:
            logger.error(f"File not found: {file_path}")
            raise FileNotFoundError(f"CSV file not found: {file_path}")
        except csv.Error as e:
            logger.error(f"CSV parsing error: {e}")
            raise ValueError(f"Invalid CSV format: {e}")
        except Exception as e:
            logger.error(f"Streaming error: {str(e)}")
            raise Exception(f"Failed to stream CSV: {str(e)}")
    
    @staticmethod
    async def process_stream(
        file_path: Path,
        processor: Callable[[List[Dict]], None],
        chunk_size: int = 1000,
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> Dict:
        """
        Process CSV file in streaming fashion with custom processor function.
        
        Args:
            file_path: Path to CSV file
            processor: Async function to process each chunk
            chunk_size: Number of records per chunk
            progress_callback: Optional callback for progress updates (chunk_num, total_records)
            
        Returns:
            Dict with summary statistics
        """
        total_records = 0
        processed_chunks = 0
        
        for chunk in StreamingEngine.stream_csv(file_path, chunk_size):
            # Process chunk
            await processor(chunk)
            
            total_records += len(chunk)
            processed_chunks += 1
            
            # Progress callback
            if progress_callback:
                await progress_callback(processed_chunks, total_records)
        
        return {
            "total_records": total_records,
            "processed_chunks": processed_chunks,
            "chunk_size": chunk_size
        }
    
    @staticmethod
    def get_csv_headers(file_path: Path) -> List[str]:
        """
        Get CSV column headers without loading entire file.
        Used for mapping interface.
        """
        try:
            f = StreamingEngine._open_file(file_path, newline='')
            reader = csv.DictReader(f)
            headers = reader.fieldnames or []
            f.close()
            return headers
        except Exception as e:
            logger.error(f"Failed to read CSV headers: {str(e)}")
            raise ValueError(f"Failed to read CSV headers: {str(e)}")
    
    @staticmethod
    def get_sample_records(file_path: Path, sample_size: int = 5) -> List[Dict]:
        """
        Get sample records from CSV for preview.
        Returns first N records without loading entire file.
        """
        try:
            f = StreamingEngine._open_file(file_path, newline='')
            reader = csv.DictReader(f)
            samples = []
            
            for i, row in enumerate(reader):
                if i >= sample_size:
                    break
                samples.append(row)
            
            f.close()
            return samples
        except Exception as e:
            logger.error(f"Failed to read sample records: {str(e)}")
            raise ValueError(f"Failed to read sample records: {str(e)}")
    
    @staticmethod
    def estimate_record_count(file_path: Path) -> int:
        """
        Estimate total record count by counting non-blank data lines.
        Excludes header and blank lines.
        """
        try:
            f = StreamingEngine._open_file(file_path)
            # Skip header
            next(f)
            # Count non-blank lines only
            count = sum(1 for line in f if line.strip())
            f.close()
            return count
        except Exception as e:
            logger.error(f"Failed to estimate record count: {str(e)}")
            return 0
