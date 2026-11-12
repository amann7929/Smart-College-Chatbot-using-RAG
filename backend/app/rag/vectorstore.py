"""Persistent ChromaDB wrapper. The `document_id` metadata equals documents.id in MySQL."""
import threading
from dataclasses import dataclass
from pathlib import Path

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.core.config import get_settings
from app.models import Document
from app.rag.chunking import Chunk

COLLECTION_NAME = "college_documents"
_client = None
_lock = threading.Lock()


@dataclass
class Hit:
    chunk_id: str
    document_id: str
    text: str
    filename: str
    category: str
    page_start: int
    page_end: int
    chunk_index: int
    similarity: float  # cosine similarity = 1 - cosine distance


def _get_client():
    global _client
    with _lock:
        if _client is None:
            path = Path(get_settings().chroma_dir)
            path.mkdir(parents=True, exist_ok=True)
            _client = chromadb.PersistentClient(path=str(path), settings=ChromaSettings(anonymized_telemetry=False))
        return _client


def get_collection():
    # embedding_function=None: we always supply our own embeddings (no hidden model downloads).
    return _get_client().get_or_create_collection(
        COLLECTION_NAME, metadata={"hnsw:space": "cosine"}, embedding_function=None
    )


def add_chunks(doc: Document, chunks: list[Chunk], embeddings: list[list[float]]) -> None:
    if len(chunks) != len(embeddings):
        raise ValueError("chunks and embeddings length mismatch")
    col = get_collection()
    for i in range(0, len(chunks), 500):
        batch = chunks[i:i + 500]
        col.add(
            ids=[f"{doc.id}:{c.index}" for c in batch],
            embeddings=embeddings[i:i + 500],
            documents=[c.text for c in batch],
            metadatas=[{
                "document_id": str(doc.id),
                "filename": doc.original_filename,
                "category": doc.category,
                "page_start": c.page_start,
                "page_end": c.page_end,
                "chunk_index": c.index,
            } for c in batch],
        )


def delete_document(document_id) -> None:
    get_collection().delete(where={"document_id": str(document_id)})


def count_for_document(document_id) -> int:
    got = get_collection().get(where={"document_id": str(document_id)}, include=[])
    return len(got["ids"])


def total_count() -> int:
    return get_collection().count()


def query(embedding: list[float], top_k: int, category: str | None = None) -> list[Hit]:
    col = get_collection()
    where = {"category": category} if category else None
    n = col.count()
    if n == 0:
        return []
    query_args = {
        "query_embeddings": [embedding],
        "n_results": min(top_k, n),
        "include": ["documents", "metadatas", "distances"],
    }
    if where:
        query_args["where"] = where
    res = col.query(**query_args)
    hits: list[Hit] = []
    for cid, text, meta, dist in zip(res["ids"][0], res["documents"][0], res["metadatas"][0], res["distances"][0]):
        hits.append(Hit(
            chunk_id=cid, document_id=meta["document_id"], text=text, filename=meta["filename"],
            category=meta["category"], page_start=int(meta["page_start"]), page_end=int(meta["page_end"]),
            chunk_index=int(meta["chunk_index"]), similarity=max(0.0, min(1.0, 1.0 - float(dist))),
        ))
    return hits


def reset_for_tests() -> None:
    """Delete the collection (tests only)."""
    client = _get_client()
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass
