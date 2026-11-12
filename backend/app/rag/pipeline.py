"""Retrieve relevant chunks and generate a grounded answer."""
import logging
import re
import uuid
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Document
from app.rag import vectorstore
from app.rag.embeddings import EmbeddingError, get_embedder
from app.rag.llm import LLMError, get_llm
from app.rag.prompts import INSUFFICIENT, build_messages

logger = logging.getLogger("college_chatbot.rag")

NO_RELEVANT_DOCS = (
    f"{INSUFFICIENT} Try rephrasing your question, or contact the college office for details."
)

_SMALL_TALK = {
    "hi": "Hello! How can I help you?",
    "hii": "Hello! How can I help you?",
    "hey": "Hello! How can I help you?",
    "hello": "Hello! How can I help you?",
    "hi there": "Hello! How can I help you?",
    "hey there": "Hello! How can I help you?",
    "good morning": "Good morning! How can I help you?",
    "good afternoon": "Good afternoon! How can I help you?",
    "good evening": "Good evening! How can I help you?",
    "how are you": "I am good, and how are you?",
    "how are you doing": "I am good, and how are you?",
    "how are u": "I am good, and how are you?",
    "how r you": "I am good, and how are you?",
    "whats up": "Not much! How can I help you?",
    "how is it going": "It's going well, thank you! How can I help you?",
    "hows it going": "It's going well, thank you! How can I help you?",
    "how is your day": "It's going well, thank you! How can I help you?",
    "hows your day": "It's going well, thank you! How can I help you?",
    "what is your name": "I'm ClgBot, your college information assistant.",
    "whats your name": "I'm ClgBot, your college information assistant.",
    "who are you": "I'm ClgBot, your college information assistant.",
    "what can you do": "I can answer questions about the college and help with general conversation.",
    "are you a bot": "Yes, I'm ClgBot, your college information assistant.",
    "thanks": "You're welcome! Is there anything else I can help you with?",
    "thank you": "You're welcome! Is there anything else I can help you with?",
    "bye": "Goodbye! Feel free to ask if you need any help.",
    "goodbye": "Goodbye! Feel free to ask if you need any help.",
}


_WELLBEING_REPLIES = {"fine", "im fine", "i am fine", "good", "im good", "i am good",
                      "great", "im great", "i am great", "doing well", "im doing well",
                      "i am doing well", "im okay", "i am okay", "not bad"}


def _small_talk_reply(question: str, history: list[dict]) -> str | None:
    normalized = re.sub(r"[^a-z0-9 ]", "", question.lower())
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if normalized in _WELLBEING_REPLIES:
        if history and history[-1].get("role") == "assistant":
            previous_reply = history[-1].get("content", "").lower()
            if "how are you" in previous_reply or "how are u" in previous_reply:
                return "It's good to see you well, how can I help you?"
        return "I'm glad to hear that! How can I help you?"
    return _SMALL_TALK.get(normalized)


def _category_filter(question: str) -> str | None:
    normalized = re.sub(r"[^a-z0-9 ]", " ", question.lower())
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if any(term in normalized.split() for term in ("contact", "phone", "telephone", "email", "address")):
        return "Contact Information"
    return None


@dataclass
class RagResult:
    answer: str
    status: str = "completed"                 # "completed" | "failed"
    sources: list[dict] = field(default_factory=list)
    meta: dict = field(default_factory=dict)


def retrieve(db: Session, question: str):
    """Embed the question, search ChromaDB, apply the similarity threshold and keep only INDEXED documents."""
    s = get_settings()
    category = _category_filter(question)
    retrieval_query = question
    if category == "Contact Information":
        retrieval_query += " contact information phone telephone email address office"
    embedding = get_embedder().embed_query(retrieval_query)
    candidates = vectorstore.query(embedding, s.top_k * 4, category=category)
    above = [h for h in candidates if h.similarity >= s.similarity_threshold]
    if above:
        ids = {uuid.UUID(h.document_id) for h in above}
        indexed = set(db.scalars(select(Document.id).where(Document.id.in_(ids), Document.status == "indexed")))
        above = [h for h in above if uuid.UUID(h.document_id) in indexed]
        indexed_documents = db.execute(
            select(Document.category, Document.original_filename).where(Document.status == "indexed")
        ).all()
        categories_with_real_documents = {
            doc_category for doc_category, filename in indexed_documents
            if not filename.upper().startswith("SAMPLE_")
        }
        above = [
            hit for hit in above
            if not (
                hit.filename.upper().startswith("SAMPLE_")
                and hit.category in categories_with_real_documents
            )
        ]
    return above[:s.top_k], len(candidates)


def answer_question(db: Session, question: str, history: list[dict]) -> RagResult:
    s = get_settings()
    meta = {"top_k": s.top_k, "similarity_threshold": s.similarity_threshold, "model": s.groq_model,
            "candidates": 0, "used": 0, "llm_called": False}
    small_talk = _small_talk_reply(question, history)
    if small_talk:
        return RagResult(answer=small_talk, meta=meta)
    try:
        hits, n_candidates = retrieve(db, question)
    except EmbeddingError as exc:
        meta["error_code"] = "embedding_unavailable"
        return RagResult(answer=str(exc), status="failed", meta=meta)
    except Exception:
        logger.exception("Vector search failed")
        meta["error_code"] = "search_unavailable"
        return RagResult(answer="The knowledge base search is temporarily unavailable. Please try again.",
                         status="failed", meta=meta)

    meta["candidates"], meta["used"] = n_candidates, len(hits)
    if not hits:
        return RagResult(answer=NO_RELEVANT_DOCS, meta=meta)   # no LLM call -> nothing to hallucinate from

    try:
        meta["llm_called"] = True
        answer = get_llm().chat(build_messages(question, hits, history))
    except LLMError as exc:
        meta["error_code"] = exc.code
        if exc.retry_after:
            meta["retry_after"] = exc.retry_after
        return RagResult(answer=exc.user_message, status="failed", meta=meta)

    cited = set(re.findall(r"\[S(\d+)\]", answer))
    sources = [{
        "id": f"S{i}",
        "document_id": h.document_id,
        "filename": h.filename,
        "category": h.category,
        "page_start": h.page_start,
        "page_end": h.page_end,
        "chunk_index": h.chunk_index,
        "similarity": round(h.similarity, 4),   # real cosine similarity from ChromaDB
        "snippet": h.text[:300],
        "cited": str(i) in cited,
    } for i, h in enumerate(hits, start=1)]
    return RagResult(answer=answer, sources=sources, meta=meta)
