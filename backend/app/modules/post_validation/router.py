from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
from app.core.database import get_db
from app.modules.accounts.router import get_current_account_id
from app.models.account import Account
from app.services.fsm_client import FSMClient
from app.modules.accounts.service import AccountService
import logging
import os
import json
import glob

logger = logging.getLogger(__name__)

# File logger for post-validation queries
_file_logger = logging.getLogger("post_validation_file")
_file_logger.setLevel(logging.INFO)
_log_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "temp", "post_validation.log")
_log_path = os.path.normpath(_log_path)
os.makedirs(os.path.dirname(_log_path), exist_ok=True)
_fh = logging.FileHandler(_log_path, mode="a", encoding="utf-8")
_fh.setFormatter(logging.Formatter("%(asctime)s %(message)s", datefmt="%Y-%m-%d %H:%M:%S"))
_file_logger.addHandler(_fh)

router = APIRouter()

# In-memory progress tracking for long-running queries
_query_progress: dict = {}  # account_id -> {fetched, total, status}


class QueryRequest(BaseModel):
    business_class: str
    fields: str = "_all"
    limit: int = 50
    filter_expression: Optional[str] = None
    lpl_filter: Optional[str] = None
    set_name: Optional[str] = None


class AvailableClass(BaseModel):
    name: str
    source: str  # "conversion" or "setup"
    has_generic_list: bool = True


def _get_fsm_client(db: Session, account_id: int) -> FSMClient:
    """Create an authenticated FSM client from account credentials."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    credentials = AccountService.get_decrypted_credentials(account)
    return FSMClient(
        base_url=credentials["base_url"],
        oauth_url=credentials["oauth_url"],
        tenant_id=credentials["tenant_id"],
        client_id=credentials["client_id"],
        client_secret=credentials["client_secret"],
        saak=credentials["saak"],
        sask=credentials["sask"]
    )


@router.get("/available-classes")
def get_available_classes(
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Return list of business classes available for querying from local swagger files."""
    classes = []
    swagger_base = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "FSM_Swagger")
    swagger_base = os.path.normpath(swagger_base)

    # Scan Conversion folder
    conversion_dir = os.path.join(swagger_base, "Conversion")
    if os.path.isdir(conversion_dir):
        for f in sorted(glob.glob(os.path.join(conversion_dir, "*.json"))):
            name = os.path.splitext(os.path.basename(f))[0]
            classes.append({"name": name, "source": "conversion", "has_generic_list": True})

    # Scan Setup folder
    setup_dir = os.path.join(swagger_base, "Setup")
    if os.path.isdir(setup_dir):
        for f in sorted(glob.glob(os.path.join(setup_dir, "*.json"))):
            name = os.path.splitext(os.path.basename(f))[0]
            classes.append({"name": name, "source": "setup", "has_generic_list": True})

    return {"classes": classes}


@router.get("/schema-fields/{business_class}")
def get_schema_fields(
    business_class: str,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Return available fields for a business class from its local swagger file."""
    swagger_base = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "FSM_Swagger")
    swagger_base = os.path.normpath(swagger_base)

    # Try Conversion first, then Setup
    for folder in ["Conversion", "Setup"]:
        path = os.path.join(swagger_base, folder, f"{business_class}.json")
        if os.path.isfile(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    swagger = json.load(f)

                fields = []
                required_fields = []
                # Extract from _generic list endpoint parameters
                paths = swagger.get("paths", {})
                generic_path = f"/classes/{business_class}/lists/_generic"
                if generic_path in paths:
                    params = paths[generic_path].get("get", {}).get("parameters", [])
                    for p in params:
                        if p.get("name") == "_fields":
                            enum_vals = p.get("schema", {}).get("items", {}).get("enum", [])
                            fields = [v for v in enum_vals if v != "_all"]
                            break

                # Fallback: extract from createAllFieldsMultipart schema
                if not fields:
                    schemas = swagger.get("components", {}).get("schemas", {})
                    all_fields_schema = schemas.get("createAllFieldsMultipart", {})
                    props = all_fields_schema.get("properties", {})
                    fields = sorted(props.keys())

                # Extract required fields from createAllFieldsMultipart or minimumFieldsJSON
                schemas = swagger.get("components", {}).get("schemas", {})
                for schema_name in ["createAllFieldsMultipart", "minimumFieldsJSON", "createMinimumFieldsMultipart"]:
                    req = schemas.get(schema_name, {}).get("required", [])
                    if req:
                        required_fields = [f for f in req if f in fields]
                        break

                return {"business_class": business_class, "fields": fields, "required_fields": required_fields, "total": len(fields)}
            except Exception as e:
                logger.error(f"Error parsing swagger for {business_class}: {e}")
                raise HTTPException(status_code=500, detail=f"Error parsing schema: {str(e)}")

    raise HTTPException(status_code=404, detail=f"No swagger file found for {business_class}")


@router.get("/query-progress")
def get_query_progress(
    account_id: int = Depends(get_current_account_id),
):
    """Get progress of the current running query."""
    progress = _query_progress.get(account_id, {"fetched": 0, "total": 0, "status": "idle"})
    return progress


@router.post("/query")
async def query_business_class(
    request: QueryRequest,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """
    Query FSM business class data using the _generic list API with paging.
    Stores ALL fetched records in post_validation_data table for server-side aggregation.
    Returns first page of detail records to the frontend.
    """
    from app.models.post_validation_data import PostValidationData

    fsm_client = _get_fsm_client(db, account_id)

    try:
        await fsm_client.authenticate()

        # 1. Clear previous data for this account
        db.query(PostValidationData).filter(
            PostValidationData.account_id == account_id
        ).delete()
        db.commit()

        # Init progress
        _query_progress[account_id] = {"fetched": 0, "total": request.limit, "status": "running"}

        url = f"{fsm_client.base_url}/{fsm_client.tenant_id}/FSM/fsm/soap/classes/{request.business_class}/lists/_generic"
        page_size = 10000
        all_records = []
        total_fetched = 0

        import httpx
        async with httpx.AsyncClient(timeout=300.0) as client:
            headers = {"Authorization": f"Bearer {fsm_client.access_token}"}
            params = {
                "_fields": request.fields,
                "_limit": str(page_size),
                "_links": "true",
                "_pageNav": "true",
                "_out": "JSON",
                "_flatten": "false",
                "_omitCountValue": "false",
            }
            if request.filter_expression:
                params["_filter"] = request.filter_expression
            if request.lpl_filter:
                params["_lplFilter"] = request.lpl_filter
            if request.set_name:
                params["_setName"] = request.set_name

            logger.info(f"Post-validation query: {request.business_class} fields={request.fields} limit={request.limit}")
            _file_logger.info(f"=== NEW QUERY ===")
            _file_logger.info(f"Business class: {request.business_class}")
            _file_logger.info(f"Fields: {request.fields}")
            _file_logger.info(f"LPL Filter: {request.lpl_filter}")
            _file_logger.info(f"Expected count (limit): {request.limit}")
            _file_logger.info(f"URL: {url}")

            # Build the base URL prefix for resolving relative next hrefs.
            # url = .../classes/{BC}/lists/_generic
            # next href is relative like "../lists/_generic?..."
            # We resolve against the parent of "lists/_generic" → .../classes/{BC}/
            from urllib.parse import urljoin, urlparse, parse_qs
            base_resolve_url = url.rsplit("/lists/", 1)[0] + "/lists/_generic"

            page_num = 0
            next_page_url = None  # Will hold the absolute URL for subsequent pages
            while True:
                if page_num == 0:
                    # First page: use original url + params
                    request_url = url
                    request_params = params
                    _file_logger.info(f"Params: {json.dumps(params, indent=2)}")
                else:
                    # Subsequent pages: use the next href from _links (no extra params)
                    request_url = next_page_url
                    request_params = None

                logger.info(f"Page {page_num} request: {request_url}")
                _file_logger.info(f"Page {page_num} request sent...")

                response = await client.get(request_url, headers=headers, params=request_params)
                if response.status_code != 200:
                    logger.error(f"FSM paging error {response.status_code}: {response.text[:300]}")
                    _file_logger.info(f"Page {page_num} ERROR {response.status_code}: {response.text[:500]}")
                    break

                result = response.json()
                page_records = []
                next_page_url = None  # Reset for this page

                if isinstance(result, list):
                    for item in result:
                        if isinstance(item, dict) and "_fields" in item:
                            page_records.append(item["_fields"])
                        # Extract _links from metadata element (first item with _links)
                        if isinstance(item, dict) and "_links" in item:
                            for link in item["_links"]:
                                if link.get("rel") == "next" and link.get("href"):
                                    raw_href = link["href"]
                                    # Ensure _links=true is preserved in next href
                                    # (FSM may echo back the original param value)
                                    if "_links=false" in raw_href:
                                        raw_href = raw_href.replace("_links=false", "_links=true")
                                    # Resolve relative href against base URL
                                    # href looks like "../lists/_generic?..." — resolve from .../classes/{BC}/lists/
                                    resolve_base = url.rsplit("/_generic", 1)[0] + "/"
                                    next_page_url = urljoin(resolve_base, raw_href)
                                    _file_logger.info(f"Page {page_num} next href: {next_page_url}")

                if not page_records:
                    break

                # Store in temp table (batch insert)
                db_rows = [
                    PostValidationData(
                        account_id=account_id,
                        business_class=request.business_class,
                        row_data=json.dumps(rec)
                    )
                    for rec in page_records
                ]
                db.bulk_save_objects(db_rows)
                db.commit()

                all_records.extend(page_records)
                total_fetched += len(page_records)
                _query_progress[account_id] = {"fetched": total_fetched, "total": request.limit, "status": "running"}
                logger.info(f"Page {page_num}: {len(page_records)} records (total: {total_fetched})")
                _file_logger.info(f"Page {page_num}: {len(page_records)} records (total: {total_fetched})")

                # Stop if no next page URL (next href was blank or missing)
                if not next_page_url:
                    _file_logger.info(f"No next href — all pages fetched.")
                    break
                # Safety stop: stop when we've fetched at least the expected count
                if request.limit > 0 and total_fetched >= request.limit:
                    logger.info(f"Reached expected count ({request.limit}), stopping at {total_fetched}.")
                    break
                # Hard max: 100 pages (1M records)
                if page_num >= 99:
                    logger.warning(f"Hit max page limit. Stopping at {total_fetched} records.")
                    break
                page_num += 1

        columns = list(all_records[0].keys()) if all_records else []

        _query_progress[account_id] = {"fetched": total_fetched, "total": total_fetched, "status": "completed"}
        _file_logger.info(f"=== QUERY COMPLETE: {total_fetched} records in {page_num + 1} pages ===")

        # Return first page for detail view (frontend will paginate client-side from this)
        return {
            "business_class": request.business_class,
            "records": all_records,
            "record_count": total_fetched,
            "columns": columns,
            "metadata": {"pages_fetched": page_num + 1, "stored_in_db": True},
        }

    except Exception as e:
        _query_progress[account_id] = {"fetched": 0, "total": 0, "status": "failed"}
        logger.error(f"Post-validation query failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")


# ── Record Count ──

class CountRequest(BaseModel):
    business_class: str
    fields: str = "GLTransactionInterface.RunGroup"  # minimal field for count
    lpl_filter: Optional[str] = None


@router.post("/count")
async def get_record_count(
    request: CountRequest,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Get record count using _recordCountOnly. Fast — no data fetched."""
    fsm_client = _get_fsm_client(db, account_id)
    try:
        await fsm_client.authenticate()
        url = f"{fsm_client.base_url}/{fsm_client.tenant_id}/FSM/fsm/soap/classes/{request.business_class}/lists/_generic"
        params = {
            "_fields": request.fields.split(",")[0],
            "_limit": "5",
            "_recordCountOnly": "true",
            "_links": "false",
            "_pageNav": "true",
            "_out": "JSON",
            "_flatten": "false",
        }
        if request.lpl_filter:
            params["_lplFilter"] = request.lpl_filter

        import httpx
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(url, headers={"Authorization": f"Bearer {fsm_client.access_token}"}, params=params)
            response.raise_for_status()
            result = response.json()

        count = 0
        if isinstance(result, dict):
            count = result.get("_count", 0)
        elif isinstance(result, list) and len(result) > 0:
            first = result[0] if isinstance(result[0], dict) else {}
            count = first.get("_count", 0)

        page_size = 10000
        estimated_batches = (count + page_size - 1) // page_size if count > 0 else 0

        return {"count": count, "estimated_batches": estimated_batches, "page_size": page_size}
    except Exception as e:
        logger.error(f"Record count failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Count failed: {str(e)}")


# ── Server-side Aggregation (from temp table) ──


class AggregateRequest(BaseModel):
    group_by: List[str]  # field names to group by
    aggregate_columns: List[str] = []  # numeric fields to aggregate
    aggregate_ops: dict = {}  # field -> list of ops e.g. {"TransactionAmount": ["SUM", "AVG"]}
    date_granularity: Optional[dict] = None  # field -> 'exact' | 'year-month' | 'year-quarter' | 'year'


@router.get("/aggregation-support/{business_class}")
def check_aggregation_support(
    business_class: str,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Check if report data exists in temp table for this account."""
    from app.models.post_validation_data import PostValidationData
    count = db.query(PostValidationData).filter(
        PostValidationData.account_id == account_id
    ).count()
    return {"supported": count > 0, "record_count": count}


@router.post("/aggregate")
def aggregate_from_temp_table(
    request: AggregateRequest,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """
    Aggregate data from the post_validation_data temp table.
    Reads stored JSON records, groups by specified fields, computes selected aggregations per field.
    Instant — no FSM API calls.
    """
    from app.models.post_validation_data import PostValidationData

    rows = db.query(PostValidationData.row_data).filter(
        PostValidationData.account_id == account_id
    ).all()

    if not rows:
        raise HTTPException(status_code=404, detail="No report data found. Run a Detail View report first.")

    date_gran = request.date_granularity or {}
    agg_ops = request.aggregate_ops or {}  # field -> list of ops
    groups: dict = {}
    total_scanned = 0

    for (row_json,) in rows:
        rec = json.loads(row_json)
        total_scanned += 1

        key_parts = []
        group_vals = {}
        for f in request.group_by:
            raw = rec.get(f, "") or ""
            transformed = _apply_date_granularity(raw, date_gran.get(f, "exact"))
            key_parts.append(transformed)
            group_vals[f] = transformed

        key = "|".join(key_parts)
        if key not in groups:
            groups[key] = {
                "group_values": group_vals,
                "count": 0,
                "values": {ac: [] for ac in request.aggregate_columns},
            }
        groups[key]["count"] += 1

        for ac in request.aggregate_columns:
            try:
                val = float(rec.get(ac, 0) or 0)
                groups[key]["values"][ac].append(val)
            except (ValueError, TypeError):
                pass

    # Build column list based on selected ops per field
    agg_columns = []
    for ac in request.aggregate_columns:
        ops = agg_ops.get(ac, ["SUM"])
        for op in ops:
            agg_columns.append(f"{op}({ac})")

    records = []
    for g in sorted(groups.values(), key=lambda x: x["count"], reverse=True):
        row = {**g["group_values"], "_count": str(g["count"])}
        for ac in request.aggregate_columns:
            ops = agg_ops.get(ac, ["SUM"])
            vals = g["values"][ac]
            for op in ops:
                if op == "SUM":
                    row[f"SUM({ac})"] = str(round(sum(vals), 2)) if vals else "0"
                elif op == "AVG":
                    row[f"AVG({ac})"] = str(round(sum(vals) / len(vals), 2)) if vals else "0"
                elif op == "MIN":
                    row[f"MIN({ac})"] = str(round(min(vals), 2)) if vals else "0"
                elif op == "MAX":
                    row[f"MAX({ac})"] = str(round(max(vals), 2)) if vals else "0"
        records.append(row)

    columns = request.group_by + ["_count"] + agg_columns

    grand_count = sum(g["count"] for g in groups.values())
    grand_sums = {}
    for ac in request.aggregate_columns:
        ops = agg_ops.get(ac, ["SUM"])
        all_vals = []
        for g in groups.values():
            all_vals.extend(g["values"][ac])
        for op in ops:
            col_name = f"{op}({ac})"
            if op == "SUM":
                grand_sums[col_name] = round(sum(all_vals), 2) if all_vals else 0
            elif op == "AVG":
                grand_sums[col_name] = round(sum(all_vals) / len(all_vals), 2) if all_vals else 0
            elif op == "MIN":
                grand_sums[col_name] = round(min(all_vals), 2) if all_vals else 0
            elif op == "MAX":
                grand_sums[col_name] = round(max(all_vals), 2) if all_vals else 0

    return {
        "records": records,
        "record_count": len(records),
        "columns": columns,
        "metadata": {
            "total_records_scanned": total_scanned,
            "grand_count": grand_count,
            "grand_sums": grand_sums,
        },
    }


def _apply_date_granularity(value: str, granularity: str) -> str:
    if granularity == "exact" or not value or len(value) != 8 or not value.isdigit():
        return value
    y, m = value[:4], value[4:6]
    if granularity == "year":
        return y
    if granularity == "year-month":
        return f"{y}-{m}"
    if granularity == "year-quarter":
        q = (int(m) - 1) // 3 + 1
        return f"{y}-Q{q}"
    return value


# ── Saved Reports CRUD ──

from app.models.saved_report import SavedReport


class SaveReportRequest(BaseModel):
    name: str
    description: Optional[str] = None
    business_class: str
    config: dict  # {fields, groupByFields, aggregateFields, lplFilter, limit, reportMode}
    result_data: Optional[dict] = None  # snapshot of aggregation result


class UpdateReportRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[dict] = None
    result_data: Optional[dict] = None  # snapshot of aggregation result


@router.get("/reports")
def list_saved_reports(
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """List all saved reports for the current account."""
    reports = (
        db.query(SavedReport)
        .filter(SavedReport.account_id == account_id)
        .order_by(SavedReport.updated_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "business_class": r.business_class,
            "config": json.loads(r.config_json),
            "result_data": json.loads(r.result_data_json) if r.result_data_json else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in reports
    ]


@router.post("/reports")
def save_report(
    request: SaveReportRequest,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Save a new report configuration."""
    report = SavedReport(
        account_id=account_id,
        name=request.name,
        description=request.description,
        business_class=request.business_class,
        config_json=json.dumps(request.config),
        result_data_json=json.dumps(request.result_data) if request.result_data else None,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return {
        "id": report.id,
        "name": report.name,
        "description": report.description,
        "business_class": report.business_class,
        "config": json.loads(report.config_json),
        "result_data": json.loads(report.result_data_json) if report.result_data_json else None,
        "created_at": report.created_at.isoformat() if report.created_at else None,
        "updated_at": report.updated_at.isoformat() if report.updated_at else None,
    }


@router.put("/reports/{report_id}")
def update_report(
    report_id: int,
    request: UpdateReportRequest,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Update an existing saved report."""
    report = db.query(SavedReport).filter(
        SavedReport.id == report_id,
        SavedReport.account_id == account_id
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if request.name is not None:
        report.name = request.name
    if request.description is not None:
        report.description = request.description
    if request.config is not None:
        report.config_json = json.dumps(request.config)
    if request.result_data is not None:
        report.result_data_json = json.dumps(request.result_data)
    from datetime import datetime
    report.updated_at = datetime.now()
    db.commit()
    db.refresh(report)
    return {
        "id": report.id,
        "name": report.name,
        "description": report.description,
        "business_class": report.business_class,
        "config": json.loads(report.config_json),
        "result_data": json.loads(report.result_data_json) if report.result_data_json else None,
        "created_at": report.created_at.isoformat() if report.created_at else None,
        "updated_at": report.updated_at.isoformat() if report.updated_at else None,
    }


@router.delete("/reports/{report_id}")
def delete_report(
    report_id: int,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """Delete a saved report."""
    report = db.query(SavedReport).filter(
        SavedReport.id == report_id,
        SavedReport.account_id == account_id
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    db.delete(report)
    db.commit()
    return {"message": "Report deleted"}


# ── Auto-generate Post Validation Report from loaded records ──

class AutoReportRequest(BaseModel):
    business_class: str
    report_name: str
    fields: List[str]
    group_by: List[str] = []
    aggregate_columns: List[str] = []
    aggregate_ops: dict = {}  # field -> list of ops
    date_granularity: dict = {}  # field -> granularity
    records: List[dict]  # the actual loaded records (mapped field values)


@router.post("/auto-report")
def create_auto_report(
    request: AutoReportRequest,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """
    Auto-generate a Post Validation saved report from loaded records.
    Called by Batch Upload after each file is successfully loaded to FSM.
    Aggregates the provided records and saves as a report with cached result data.
    """
    from app.models.saved_report import SavedReport

    agg_ops = request.aggregate_ops or {}
    date_gran = request.date_granularity or {}

    # If group_by is configured, compute aggregation
    result_data = None
    if request.group_by and len(request.records) > 0:
        groups: dict = {}
        total_scanned = 0

        for rec in request.records:
            total_scanned += 1
            key_parts = []
            group_vals = {}
            for f in request.group_by:
                raw = str(rec.get(f, "") or "")
                transformed = _apply_date_granularity(raw, date_gran.get(f, "exact"))
                key_parts.append(transformed)
                group_vals[f] = transformed

            key = "|".join(key_parts)
            if key not in groups:
                groups[key] = {
                    "group_values": group_vals,
                    "count": 0,
                    "values": {ac: [] for ac in request.aggregate_columns},
                }
            groups[key]["count"] += 1

            for ac in request.aggregate_columns:
                try:
                    val = float(rec.get(ac, 0) or 0)
                    groups[key]["values"][ac].append(val)
                except (ValueError, TypeError):
                    pass

        # Build columns
        agg_columns = []
        for ac in request.aggregate_columns:
            ops = agg_ops.get(ac, ["SUM"])
            for op in ops:
                agg_columns.append(f"{op}({ac})")

        records_out = []
        for g in sorted(groups.values(), key=lambda x: x["count"], reverse=True):
            row = {**g["group_values"], "_count": str(g["count"])}
            for ac in request.aggregate_columns:
                ops = agg_ops.get(ac, ["SUM"])
                vals = g["values"][ac]
                for op in ops:
                    if op == "SUM":
                        row[f"SUM({ac})"] = str(round(sum(vals), 2)) if vals else "0"
                    elif op == "AVG":
                        row[f"AVG({ac})"] = str(round(sum(vals) / len(vals), 2)) if vals else "0"
                    elif op == "MIN":
                        row[f"MIN({ac})"] = str(round(min(vals), 2)) if vals else "0"
                    elif op == "MAX":
                        row[f"MAX({ac})"] = str(round(max(vals), 2)) if vals else "0"
            records_out.append(row)

        columns = request.group_by + ["_count"] + agg_columns

        grand_count = sum(g["count"] for g in groups.values())
        grand_sums = {}
        for ac in request.aggregate_columns:
            ops = agg_ops.get(ac, ["SUM"])
            all_vals = []
            for g in groups.values():
                all_vals.extend(g["values"][ac])
            for op in ops:
                col_name = f"{op}({ac})"
                if op == "SUM":
                    grand_sums[col_name] = round(sum(all_vals), 2) if all_vals else 0
                elif op == "AVG":
                    grand_sums[col_name] = round(sum(all_vals) / len(all_vals), 2) if all_vals else 0
                elif op == "MIN":
                    grand_sums[col_name] = round(min(all_vals), 2) if all_vals else 0
                elif op == "MAX":
                    grand_sums[col_name] = round(max(all_vals), 2) if all_vals else 0

        result_data = {
            "records": records_out,
            "record_count": len(records_out),
            "columns": columns,
            "metadata": {
                "total_records_scanned": total_scanned,
                "grand_count": grand_count,
                "grand_sums": grand_sums,
            },
        }
    elif len(request.records) > 0:
        # No group by — just store detail records
        # Filter records to only include selected fields
        filtered = []
        for rec in request.records:
            filtered.append({f: str(rec.get(f, "")) for f in request.fields if f in rec})
        result_data = {
            "records": filtered,
            "record_count": len(filtered),
            "columns": request.fields,
            "metadata": {"total_records_scanned": len(filtered)},
        }

    # Build config
    config = {
        "fields": request.fields,
        "groupByFields": request.group_by,
        "aggregateFields": request.aggregate_columns,
        "aggregateOps": request.aggregate_ops,
        "lplFilter": "",
        "reportMode": "summary" if request.group_by else "detail",
        "dateGranularity": request.date_granularity,
    }

    report = SavedReport(
        account_id=account_id,
        name=request.report_name,
        description=f"Auto-generated from Batch Upload ({len(request.records)} records loaded)",
        business_class=request.business_class,
        config_json=json.dumps(config),
        result_data_json=json.dumps(result_data) if result_data else None,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    logger.info(f"Auto-report created: {request.report_name} ({len(request.records)} records, {len(result_data.get('records', [])) if result_data else 0} groups)")

    return {
        "id": report.id,
        "name": report.name,
        "record_count": len(request.records),
        "groups": result_data.get("record_count", 0) if result_data else 0,
    }


class AutoReportFromJobRequest(BaseModel):
    job_id: int
    business_class: str
    report_name: str
    mapping: dict  # CSV col -> {fsm_field, ...}
    fields: List[str]
    group_by: List[str] = []
    aggregate_columns: List[str] = []
    aggregate_ops: dict = {}
    date_granularity: dict = {}
    date_source_format: Optional[str] = None


@router.post("/auto-report-from-job")
def create_auto_report_from_job(
    request: AutoReportFromJobRequest,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """
    Auto-generate a Post Validation report by reading the job's CSV file,
    applying the mapping, and aggregating. No FSM API calls needed.
    Called by Batch Upload after each file is successfully loaded.
    """
    from app.models.job import ConversionJob, ValidationError as VE
    from app.services.streaming_engine import StreamingEngine
    from app.services.mapping_engine import MappingEngine
    from app.modules.upload.service import UploadService
    from app.modules.validation.service import ValidationService

    job = db.query(ConversionJob).filter(
        ConversionJob.id == request.job_id,
        ConversionJob.account_id == account_id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    file_path = UploadService.get_file_path(request.job_id)

    # Get invalid rows to skip (same as load service)
    invalid_rows = set(
        r[0] for r in db.query(VE.row_number)
        .filter(VE.conversion_job_id == request.job_id)
        .distinct().all()
    )

    # Read CSV, apply mapping, collect valid records
    mapped_records = []
    for chunk in StreamingEngine.stream_csv(file_path, chunk_size=1000):
        for record in chunk:
            row_num = record.get('_row_number', 0)
            if row_num in invalid_rows:
                continue
            mapped = MappingEngine.apply_mapping(record, request.mapping)
            # Apply date transform if configured
            if request.date_source_format:
                mapped = ValidationService._apply_date_transform(mapped, request.date_source_format)
            mapped.pop('_row_number', None)
            mapped_records.append(mapped)

    logger.info(f"Auto-report from job {request.job_id}: {len(mapped_records)} valid records read")

    # Delegate to the auto-report logic
    auto_req = AutoReportRequest(
        business_class=request.business_class,
        report_name=request.report_name,
        fields=request.fields,
        group_by=request.group_by,
        aggregate_columns=request.aggregate_columns,
        aggregate_ops=request.aggregate_ops,
        date_granularity=request.date_granularity,
        records=mapped_records,
    )

    # Reuse the aggregation logic directly
    return create_auto_report(auto_req, account_id, db)


class AutoReportFromBatchRequest(BaseModel):
    job_ids: List[int]
    business_class: str
    report_name: str
    mapping: dict
    fields: List[str]
    group_by: List[str] = []
    aggregate_columns: List[str] = []
    aggregate_ops: dict = {}
    date_granularity: dict = {}
    date_source_format: Optional[str] = None


@router.post("/auto-report-from-batch")
def create_auto_report_from_batch(
    request: AutoReportFromBatchRequest,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """
    Auto-generate one consolidated Post Validation report from multiple jobs (batch upload).
    Reads all job CSV files, applies mapping, combines records, aggregates, and saves one report.
    """
    from app.models.job import ConversionJob, ValidationError as VE
    from app.services.streaming_engine import StreamingEngine
    from app.services.mapping_engine import MappingEngine
    from app.modules.upload.service import UploadService
    from app.modules.validation.service import ValidationService

    all_mapped_records = []

    for job_id in request.job_ids:
        job = db.query(ConversionJob).filter(
            ConversionJob.id == job_id,
            ConversionJob.account_id == account_id
        ).first()
        if not job:
            logger.warning(f"Auto-report batch: job {job_id} not found, skipping")
            continue

        file_path = UploadService.get_file_path(job_id)

        # Get invalid rows to skip
        invalid_rows = set(
            r[0] for r in db.query(VE.row_number)
            .filter(VE.conversion_job_id == job_id)
            .distinct().all()
        )

        # Read CSV, apply mapping, collect valid records
        for chunk in StreamingEngine.stream_csv(file_path, chunk_size=1000):
            for record in chunk:
                row_num = record.get('_row_number', 0)
                if row_num in invalid_rows:
                    continue
                mapped = MappingEngine.apply_mapping(record, request.mapping)
                if request.date_source_format:
                    mapped = ValidationService._apply_date_transform(mapped, request.date_source_format)
                mapped.pop('_row_number', None)
                all_mapped_records.append(mapped)

    logger.info(f"Auto-report from batch: {len(request.job_ids)} jobs, {len(all_mapped_records)} total records")

    # Delegate to the auto-report logic
    auto_req = AutoReportRequest(
        business_class=request.business_class,
        report_name=request.report_name,
        fields=request.fields,
        group_by=request.group_by,
        aggregate_columns=request.aggregate_columns,
        aggregate_ops=request.aggregate_ops,
        date_granularity=request.date_granularity,
        records=all_mapped_records,
    )

    return create_auto_report(auto_req, account_id, db)


class ExportDetailRequest(BaseModel):
    fields: List[str]


@router.post("/export-detail")
def export_detail_csv(
    request: ExportDetailRequest,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """
    Export all detail records from the temp table as a CSV file.
    Streams from the database — handles large datasets without browser memory issues.
    """
    from app.models.post_validation_data import PostValidationData
    from fastapi.responses import StreamingResponse
    import io

    rows = db.query(PostValidationData.row_data).filter(
        PostValidationData.account_id == account_id
    ).all()

    if not rows:
        raise HTTPException(status_code=404, detail="No report data found. Run a Detail View report first.")

    def generate():
        # Header
        yield ','.join(request.fields) + '\n'
        # Data rows
        for (row_json,) in rows:
            rec = json.loads(row_json)
            vals = []
            for f in request.fields:
                v = str(rec.get(f, '') or '')
                if ',' in v or '"' in v or '\n' in v:
                    v = '"' + v.replace('"', '""') + '"'
                vals.append(v)
            yield ','.join(vals) + '\n'

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=detail_export_{len(rows)}_records.csv"}
    )
