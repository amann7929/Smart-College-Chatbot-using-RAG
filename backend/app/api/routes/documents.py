"""Knowledge-base documents: upload (admin), list/search (all users), retry/delete (admin)."""
import hashlib
import logging
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.config import get_settings
from app.db.session import get_db
from app.models import Document, User
from app.rag import vectorstore
from app.rag.categories import CATEGORIES
from app.schemas.document import DocumentListOut, DocumentOut
from app.services.audit import log_action
from app.services.ingestion import ingest_document, remove_stored_file, upload_path

logger = logging.getLogger("college_chatbot.documents")
router = APIRouter(prefix="/documents", tags=["Knowledge Base"])

_CHUNK = 1024 * 1024


def _clean_filename(name: str | None) -> str:
    name = (name or "").replace("\\", "/").split("/")[-1]
    name = re.sub(r"[\x00-\x1f\x7f]", "", name).strip()
    return name[:255]


def _get_or_404(db: Session, document_id: uuid.UUID) -> Document:
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found.")
    return doc


@router.get("/categories", response_model=list[str])
def categories(user: User = Depends(get_current_user)):
    return CATEGORIES


@router.get("", response_model=DocumentListOut)
def list_documents(
    search: str | None = Query(default=None, max_length=100),
    category: str | None = Query(default=None, max_length=80),
    doc_status: str | None = Query(default=None, alias="status", pattern="^(pending|processing|indexed|failed)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(Document)
    if search and search.strip():
        term = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        stmt = stmt.where(Document.original_filename.ilike(f"%{term}%", escape="\\"))
    if category:
        stmt = stmt.where(Document.category == category)
    if doc_status:
        stmt = stmt.where(Document.status == doc_status)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(Document.created_at.desc()).limit(page_size).offset((page - 1) * page_size))
    return DocumentListOut(items=[DocumentOut.model_validate(d) for d in rows], total=total, page=page, page_size=page_size)


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(document_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Poll this endpoint to follow processing status (pending -> processing -> indexed | failed)."""
    return _get_or_404(db, document_id)


@router.post("", response_model=DocumentOut, status_code=status.HTTP_202_ACCEPTED)
def upload_document(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    category: str = Form(...),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    s = get_settings()
    if category not in CATEGORIES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown category.")
    original = _clean_filename(file.filename)
    if not original.lower().endswith(".pdf"):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Only PDF files are accepted.")

    upload_dir = Path(s.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored = f"{uuid.uuid4().hex}.pdf"
    final_path = upload_path(stored)
    temp_path = final_path.with_suffix(".part")
    limit = s.max_upload_mb * 1024 * 1024
    sha, size, first = hashlib.sha256(), 0, True
    try:
        with open(temp_path, "wb") as out:
            while chunk := file.file.read(_CHUNK):
                if first:
                    if not chunk.startswith(b"%PDF-"):
                        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "The file is not a valid PDF.")
                    first = False
                size += len(chunk)
                if size > limit:
                    raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                                        f"File is too large. The limit is {s.max_upload_mb} MB.")
                sha.update(chunk)
                out.write(chunk)
        if size == 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "The uploaded file is empty.")

        digest = sha.hexdigest()
        existing = db.scalar(select(Document).where(Document.file_hash == digest))
        if existing is not None:
            raise HTTPException(status.HTTP_409_CONFLICT,
                                f"This file was already uploaded as '{existing.original_filename}' "
                                f"(status: {existing.status}).")
        temp_path.replace(final_path)
    except BaseException:
        temp_path.unlink(missing_ok=True)
        raise

    doc = Document(original_filename=original, stored_filename=stored, category=category, file_hash=digest,
                   file_size=size, status="pending", uploaded_by=admin.id)
    db.add(doc)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        final_path.unlink(missing_ok=True)
        raise HTTPException(status.HTTP_409_CONFLICT, "This file was already uploaded.")
    log_action(db, "document.upload", user_id=admin.id, entity_type="document", entity_id=doc.id,
               details={"filename": original, "category": category, "size": size}, request=request)
    db.commit()
    db.refresh(doc)
    background_tasks.add_task(ingest_document, doc.id)
    return doc


@router.post("/{document_id}/retry", response_model=DocumentOut, status_code=status.HTTP_202_ACCEPTED)
def retry_document(document_id: uuid.UUID, request: Request, background_tasks: BackgroundTasks,
                   admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    doc = _get_or_404(db, document_id)
    if doc.status != "failed":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only failed documents can be retried.")
    doc.status = "pending"
    doc.error_message = None
    log_action(db, "document.retry", user_id=admin.id, entity_type="document", entity_id=doc.id, request=request)
    db.commit()
    db.refresh(doc)
    background_tasks.add_task(ingest_document, doc.id)
    return doc


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: uuid.UUID, request: Request, admin: User = Depends(require_admin),
                    db: Session = Depends(get_db)):
    doc = _get_or_404(db, document_id)
    if doc.status in ("pending", "processing"):
        raise HTTPException(status.HTTP_409_CONFLICT, "This document is still being processed. Try again when it finishes.")
    try:
        vectorstore.delete_document(doc.id)       # vectors first: if this fails, nothing else is removed
    except Exception:
        logger.exception("Vector deletion failed for %s", doc.id)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY,
                            "Could not remove the document's search data. Nothing was deleted; please retry.")
    log_action(db, "document.delete", user_id=admin.id, entity_type="document", entity_id=doc.id,
               details={"filename": doc.original_filename}, request=request)
    stored = doc.stored_filename
    db.delete(doc)
    db.commit()
    remove_stored_file(stored)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
