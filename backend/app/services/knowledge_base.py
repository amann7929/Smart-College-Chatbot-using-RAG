"""Bulk-load PDFs into the knowledge base from a folder, and remove the demonstration documents.

Folder convention: one sub-folder per category, e.g.
    knowledge_base/official/Fee Structure/fees_2026.pdf
Files are validated, de-duplicated by SHA-256, indexed synchronously, and reported one by one.
"""
import hashlib
import logging
import re
import shutil
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Document, User
from app.rag import vectorstore
from app.rag.categories import CATEGORIES
from app.services.audit import log_action
from app.services.ingestion import ingest_document, remove_stored_file, upload_path

logger = logging.getLogger("college_chatbot.knowledge_base")

SAMPLE_PREFIX = "SAMPLE_"      # file-name prefix that marks demonstration documents


@dataclass
class SeedItem:
    path: str
    category: str | None
    outcome: str               # imported | failed | skipped | would_import
    detail: str = ""
    document_id: str | None = None


@dataclass
class SeedReport:
    items: list[SeedItem] = field(default_factory=list)

    def count(self, outcome: str) -> int:
        return sum(1 for i in self.items if i.outcome == outcome)


def _collect(directory: Path, category: str | None) -> list[tuple[Path, str | None, str]]:
    """Return (file, category, problem). `problem` is non-empty when the file cannot be imported."""
    found: list[tuple[Path, str | None, str]] = []
    if category is not None:
        if category not in CATEGORIES:
            raise ValueError(f"Unknown category '{category}'. Valid: {', '.join(CATEGORIES)}")
        for f in sorted(directory.glob("*.pdf")):
            found.append((f, category, ""))
        return found
    # Official PDFs in this repository use names such as
    # ``01_Admission_Process.pdf``. Recognise a category prefix for flat folders
    # while retaining the explicit category-folder convention for other PDFs.
    category_by_stem = {re.sub(r"[^a-z0-9]", "", name.lower()): name for name in CATEGORIES}
    for f in sorted(directory.glob("*.pdf")):
        stem = re.sub(r"^\d+[_ .-]*", "", f.stem)
        normalized = re.sub(r"[^a-z0-9]", "", stem.lower())
        inferred = category_by_stem.get(normalized)
        found.append((f, inferred, "" if inferred else
                      "PDF is not inside a category folder (use a folder named after the category, or --category)"))
    for sub in sorted(p for p in directory.iterdir() if p.is_dir() and not p.name.startswith(".")):
        problem = "" if sub.name in CATEGORIES else f"Folder name '{sub.name}' is not a valid category"
        for f in sorted(sub.glob("*.pdf")):
            found.append((f, sub.name, problem))
    return found


def seed_directory(db: Session, directory: Path, *, category: str | None = None,
                   uploader_email: str | None = None, dry_run: bool = False) -> SeedReport:
    if not directory.is_dir():
        raise FileNotFoundError(f"Folder not found: {directory}")
    s = get_settings()
    limit = s.max_upload_mb * 1024 * 1024
    uploader = None
    if uploader_email:
        uploader = db.scalar(select(User).where(User.email == uploader_email.strip().lower()))
    report = SeedReport()

    for path, cat, problem in _collect(directory, category):
        rel = str(path.relative_to(directory))
        if problem:
            report.items.append(SeedItem(rel, cat, "skipped", problem))
            continue
        data = path.read_bytes()
        if not data:
            report.items.append(SeedItem(rel, cat, "skipped", "file is empty"))
            continue
        if len(data) > limit:
            report.items.append(SeedItem(rel, cat, "skipped", f"larger than {s.max_upload_mb} MB"))
            continue
        if not data.startswith(b"%PDF-"):
            report.items.append(SeedItem(rel, cat, "skipped", "not a valid PDF"))
            continue
        digest = hashlib.sha256(data).hexdigest()
        existing = db.scalar(select(Document).where(Document.file_hash == digest))
        if existing is not None:
            note = " - use Retry in the Knowledge Base page" if existing.status == "failed" else ""
            report.items.append(SeedItem(rel, cat, "skipped",
                                         f"already in knowledge base as '{existing.original_filename}' ({existing.status}){note}",
                                         str(existing.id)))
            continue
        if dry_run:
            report.items.append(SeedItem(rel, cat, "would_import"))
            continue

        stored = f"{uuid.uuid4().hex}.pdf"
        dest = upload_path(stored)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, dest)
        doc = Document(original_filename=path.name[:255], stored_filename=stored, category=cat, file_hash=digest,
                       file_size=len(data), status="pending", uploaded_by=uploader.id if uploader else None)
        db.add(doc)
        log_action(db, "document.seed", user_id=uploader.id if uploader else None, entity_type="document",
                   entity_id=doc.id, details={"filename": path.name, "category": cat})
        db.commit()
        ingest_document(doc.id)                      # synchronous: the CLI waits for indexing
        db.refresh(doc)
        if doc.status == "indexed":
            report.items.append(SeedItem(rel, cat, "imported", f"{doc.chunk_count} chunks, {doc.page_count} pages", str(doc.id)))
        else:
            report.items.append(SeedItem(rel, cat, "failed", doc.error_message or doc.status, str(doc.id)))
    return report


def remove_sample_documents(db: Session) -> tuple[int, int]:
    """Delete every document whose file name starts with SAMPLE_ (vectors, stored file, DB row).

    Returns (removed, failed). A document that cannot be cleaned from ChromaDB is left untouched.
    """
    pattern = SAMPLE_PREFIX.replace("_", "\\_") + "%"
    docs = list(db.scalars(select(Document).where(Document.original_filename.ilike(pattern, escape="\\"))))
    removed = failed = 0
    for doc in docs:
        try:
            vectorstore.delete_document(doc.id)
        except Exception:
            logger.exception("Could not remove vectors for %s", doc.id)
            failed += 1
            continue
        log_action(db, "document.delete_sample", entity_type="document", entity_id=doc.id,
                   details={"filename": doc.original_filename})
        stored = doc.stored_filename
        db.delete(doc)
        db.commit()
        remove_stored_file(stored)
        removed += 1
    return removed, failed
