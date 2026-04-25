from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict
from app.core.database import get_db
from app.modules.accounts.router import get_current_account_id
from app.modules.accounts.service import AccountService
from app.core.logging import logger
import httpx

router = APIRouter()


class GenAiChatRequest(BaseModel):
    prompt: str
    session: Optional[str] = None
    tools: Optional[list] = None
    focusMode: Optional[str] = None
    context: Optional[Dict] = None  # DataBridge context from frontend
    injectContext: bool = True  # Toggle context injection


def _build_databridge_context(db: Session, account_id: int, ctx: Optional[Dict]) -> str:
    """Build DataBridge context string to prepend to user prompts."""
    parts = []
    parts.append("[DataBridge Context — FSM Data Conversion Platform]")

    # Account info
    account = AccountService.get_account_by_id(db, account_id)
    if account:
        parts.append(f"Account: {account.account_name} | Tenant: {account.tenant_id}")

    # Current page context from frontend
    if ctx:
        page = ctx.get("page", "")
        if page:
            parts.append(f"Current page: {page}")

        # Job context
        job_id = ctx.get("jobId")
        if job_id:
            from app.models.job import ConversionJob
            job = db.query(ConversionJob).filter(
                ConversionJob.id == job_id,
                ConversionJob.account_id == account_id
            ).first()
            if job:
                parts.append(f"Active job: #{job.id} | File: {job.filename} | Business class: {job.business_class}")
                parts.append(f"Status: {job.status} | Records: {job.total_records} | Valid: {job.valid_records} | Invalid: {job.invalid_records}")

        # Validation errors summary
        if ctx.get("hasErrors") and job_id:
            from app.models.job import ValidationError as VE
            top_errors = db.query(VE.field_name, VE.error_message).filter(
                VE.conversion_job_id == job_id
            ).limit(10).all()
            if top_errors:
                error_summary = "; ".join(set(f"{e.field_name}: {e.error_message}" for e in top_errors[:5]))
                parts.append(f"Top validation errors: {error_summary}")

        # Business class
        bc = ctx.get("businessClass")
        if bc:
            parts.append(f"Business class: {bc}")

        # Mapping info
        mapped = ctx.get("mappedFields")
        if mapped:
            parts.append(f"Mapped fields: {mapped}")

        # Batch info
        batch_files = ctx.get("batchFiles")
        if batch_files:
            parts.append(f"Batch upload: {batch_files} files")

    # Synced reference data summary
    from app.models.snapshot import SnapshotRegistry
    registries = db.query(SnapshotRegistry).filter(
        SnapshotRegistry.account_id == account_id
    ).all()
    if registries:
        synced = ", ".join(f"{r.business_class}({r.record_count})" for r in registries[:8])
        parts.append(f"Synced reference data: {synced}")

    parts.append("[End DataBridge Context]")
    parts.append("")
    return "\n".join(parts)


@router.post("/chat")
async def proxy_genai_chat(
    request: GenAiChatRequest,
    account_id: int = Depends(get_current_account_id),
    db: Session = Depends(get_db)
):
    """
    Proxy chat requests to Infor GenAI service.
    Injects DataBridge context into prompts for context-aware responses.
    """
    account = AccountService.get_account_by_id(db, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    credentials = AccountService.get_decrypted_credentials(account)
    base_url = credentials.get("base_url", "").rstrip("/")
    tenant_id = credentials.get("tenant_id", "")

    # Build context-augmented prompt
    user_prompt = request.prompt
    if request.injectContext:
        context_str = _build_databridge_context(db, account_id, request.context)
        augmented_prompt = f"{context_str}{user_prompt}"
        # Respect the 5000 char limit
        if len(augmented_prompt) > 4900:
            # Trim context if too long
            max_ctx = 4900 - len(user_prompt) - 50
            context_str = context_str[:max_ctx] + "\n[Context truncated]\n\n"
            augmented_prompt = f"{context_str}{user_prompt}"
    else:
        augmented_prompt = user_prompt

    # Get OAuth token
    from app.services.fsm_client import FSMClient
    fsm_client = FSMClient(
        base_url=credentials["base_url"],
        oauth_url=credentials["oauth_url"],
        tenant_id=credentials["tenant_id"],
        client_id=credentials["client_id"],
        client_secret=credentials["client_secret"],
        saak=credentials["saak"],
        sask=credentials["sask"]
    )
    await fsm_client._ensure_authenticated()

    genai_url = f"{base_url}/{tenant_id}/GENAI/chatsvc/api/v1/chat/sync"

    payload = {
        "prompt": augmented_prompt,
        "session": request.session,
        "tools": request.tools,
        "focusMode": request.focusMode
    }
    payload = {k: v for k, v in payload.items() if v is not None}

    logger.info(f"GenAI request: context={'injected' if request.injectContext else 'off'}, prompt_len={len(augmented_prompt)}")

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                genai_url,
                json=payload,
                headers={"Authorization": f"Bearer {fsm_client.access_token}"}
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        logger.error(f"GenAI API error: {e.response.status_code} - {e.response.text[:500]}")
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"GenAI service error: {e.response.text[:200]}"
        )
    except Exception as e:
        logger.error(f"GenAI proxy error: {e}")
        raise HTTPException(status_code=500, detail=f"GenAI service unavailable: {str(e)}")
