"""Background document ingestion: PDF -> text -> chunks -> embeddings -> ChromaDB -> status 'indexed'.

A document only becomes 'indexed' after every vector is stored. Any failure removes partial vectors.
"""
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models import Document
from app.rag import vectorstore
from app.rag.chunking import chunk_pages
from app.rag.embeddings import EmbeddingError, get_embedder
from app.rag.pdf import IngestionError, extract_pdf_text

logger = logging.getLogger("college_chatbot.ingestion")


def upload_path(stored_filename: str) -> Path:
    return Path(get_settings().upload_dir) / stored_filename


def _fail(db: Session, document_id: uuid.UUID, message: str) -> None:
    db.rollback()
    try:
        vectorstore.delete_document(document_id)   # never leave partial vectors behind
    except Exception:
        logger.exception("Could not clean up vectors for failed document %s", document_id)
    doc = db.get(Document, document_id)
    if doc is not None:
        doc.status = "failed"
        doc.error_message = message[:500]
        doc.chunk_count = 0
        doc.indexed_at = None
        db.commit()


def ingest_document(document_id: uuid.UUID) -> None:
    """Process one document. Safe to call from a background task; opens its own DB session."""
    s = get_settings()
    with SessionLocal() as db:
        doc = db.get(Document, document_id)
        if doc is None or doc.status != "pending":
            return
        doc.status = "processing"
        doc.error_message = None
        db.commit()
        try:
            path = upload_path(doc.stored_filename)
            if not path.exists():
                raise IngestionError("The stored file is missing. Please delete this entry and upload the PDF again.")
            extracted = extract_pdf_text(str(path), s.max_pdf_pages)
            chunks = chunk_pages(extracted.pages, s.chunk_size, s.chunk_overlap)
            if not chunks:
                raise IngestionError("No usable text could be extracted from this PDF.")
            embeddings = get_embedder().embed_documents([c.text for c in chunks])
            vectorstore.delete_document(doc.id)         # idempotent: makes retries safe
            vectorstore.add_chunks(doc, chunks, embeddings)
            doc.status = "indexed"
            doc.chunk_count = len(chunks)
            doc.page_count = extracted.page_count
            doc.indexed_at = datetime.now(timezone.utc)
            doc.error_message = None
            db.commit()
        except (IngestionError, EmbeddingError) as exc:
            _fail(db, document_id, str(exc))
        except Exception:
            logger.exception("Unexpected error while indexing document %s", document_id)
            _fail(db, document_id, "Unexpected error while indexing. Please check the server logs and retry.")


def recover_interrupted_documents() -> int:
    """After a crash/restart, documents left 'pending'/'processing' would be stuck forever. Mark them failed."""
    with SessionLocal() as db:
        ids = list(db.scalars(select(Document.id).where(Document.status.in_(("pending", "processing")))))
        for doc_id in ids:
            try:
                vectorstore.delete_document(doc_id)
            except Exception:
                logger.exception("Cleanup failed for interrupted document %s", doc_id)
        if ids:
            db.execute(update(Document).where(Document.id.in_(ids)).values(
                status="failed", chunk_count=0,
                error_message="Processing was interrupted by a server restart. Use Retry to index it again."))
            db.commit()
        return len(ids)


def remove_stored_file(stored_filename: str) -> None:
    try:
        os.remove(upload_path(stored_filename))
    except FileNotFoundError:
        pass
    except OSError:
        logger.exception("Could not delete stored file %s", stored_filename)
