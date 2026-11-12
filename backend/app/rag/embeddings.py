"""Embedding backends. Production uses Sentence Transformers (all-MiniLM-L6-v2, 384 dims, normalised).

If the package is not available in a lightweight deployment, the app falls back to a local
bag-of-words hash embedder so retrieval still works without raising a server-side error to the user.
"""
import hashlib
import logging
import math
import re
import threading
from typing import Protocol

from app.core.config import get_settings

logger = logging.getLogger("college_chatbot.embeddings")


class EmbeddingError(Exception):
    """Embedding model unavailable or failed. The message is safe to show to users."""


class Embedder(Protocol):
    def embed_documents(self, texts: list[str]) -> list[list[float]]: ...
    def embed_query(self, text: str) -> list[float]: ...


class LocalHashEmbedder:
    """Small deterministic fallback used when sentence-transformers is unavailable."""
    _DIM = 4096
    _STOP_WORDS = {
        "a", "an", "the", "is", "are", "was", "were", "of", "to", "in", "on", "at", "for",
        "and", "or", "what", "who", "when", "where", "how", "do", "does", "i", "my", "me",
        "it", "be", "can", "will", "by", "with", "this", "that", "as", "from", "there", "you",
        "your", "which"
    }

    def _vector(self, text: str) -> list[float]:
        vec = [0.0] * self._DIM
        for token in re.findall(r"[a-z0-9]+", text.lower()):
            if token in self._STOP_WORDS or len(token) < 2:
                continue
            token = token[:-1] if token.endswith("s") and len(token) > 3 else token
            idx = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16) % self._DIM
            vec[idx] += 1.0
        norm = math.sqrt(sum(x * x for x in vec))
        if norm == 0:
            vec[0], norm = 1.0, 1.0
        return [x / norm for x in vec]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._vector(text) for text in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._vector(text)


class SentenceTransformerEmbedder:
    def __init__(self, model_name: str) -> None:
        self.model_name = model_name
        self._model = None
        self._lock = threading.Lock()  # model load + encode are serialised for thread safety

    def _load(self):
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
            except ImportError as exc:
                raise EmbeddingError("The sentence-transformers package is not installed on the server.") from exc
            try:
                logger.info("Loading embedding model %s (first run downloads it)", self.model_name)
                self._model = SentenceTransformer(self.model_name)
            except Exception as exc:
                logger.exception("Could not load embedding model")
                raise EmbeddingError(
                    "The embedding model could not be loaded. The first run needs internet access to download it."
                ) from exc
        return self._model

    def _encode(self, texts: list[str]) -> list[list[float]]:
        with self._lock:
            model = self._load()
            try:
                vectors = model.encode(texts, batch_size=32, normalize_embeddings=True,
                                       show_progress_bar=False, convert_to_numpy=True)
            except Exception as exc:
                logger.exception("Embedding failed")
                raise EmbeddingError("Embedding generation failed.") from exc
        return vectors.tolist()

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._encode(texts) if texts else []

    def embed_query(self, text: str) -> list[float]:
        return self._encode([text])[0]


_embedder: Embedder | None = None
_embedder_lock = threading.Lock()


def get_embedder() -> Embedder:
    global _embedder
    with _embedder_lock:
        if _embedder is None:
            try:
                import sentence_transformers  # noqa: F401
            except ImportError:
                logger.warning("sentence-transformers is not installed; using the local hash fallback embedder.")
                _embedder = LocalHashEmbedder()
            else:
                _embedder = SentenceTransformerEmbedder(get_settings().embedding_model)
        return _embedder


def set_embedder(embedder: Embedder | None) -> None:
    """Override the embedder (used by tests). Pass None to restore the default."""
    global _embedder
    with _embedder_lock:
        _embedder = embedder


def warm_up() -> bool:
    """Load the embedding model now (used at startup). Never raises; returns True on success."""
    try:
        get_embedder().embed_query("warm up")
        return True
    except Exception:
        logger.warning("Embedding model warm-up failed; it will be retried on first use.", exc_info=True)
        return False
