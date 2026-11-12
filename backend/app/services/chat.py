"""Chat message flow: save question -> RAG answer -> save answer (with real sources)."""
import re
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.rate_limit import limiter
from app.models import ChatMessage, ChatSession, User
from app.rag.pipeline import RagResult, answer_question


def enforce_chat_rate_limit(user: User) -> None:
    s = get_settings()
    retry = limiter.check(f"chat:{user.id}", s.chat_rate_limit, s.chat_rate_window_seconds)
    if retry is not None:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "You are sending messages too quickly. Please wait a moment.",
                            headers={"Retry-After": str(retry)})


def _history(db: Session, chat_id, before: datetime) -> list[dict]:
    limit = get_settings().chat_history_messages
    rows = list(db.scalars(
        select(ChatMessage)
        .where(ChatMessage.session_id == chat_id, ChatMessage.status == "completed", ChatMessage.created_at < before)
        .order_by(ChatMessage.created_at.desc()).limit(limit)
    ))
    rows.reverse()
    return [{"role": m.role, "content": m.content[:1500]} for m in rows]


def _title_from(question: str) -> str:
    t = re.sub(r"\s+", " ", question).strip()
    return t if len(t) <= 60 else t[:57].rstrip() + "..."


def _apply(msg: ChatMessage, result: RagResult) -> None:
    msg.content = result.answer
    msg.status = result.status
    msg.sources = result.sources or None
    msg.retrieval_meta = result.meta


def send_message(db: Session, chat: ChatSession, content: str):
    user_msg = ChatMessage(session_id=chat.id, role="user", content=content, status="completed")
    db.add(user_msg)
    if chat.title == "New chat":
        chat.title = _title_from(content)
    chat.updated_at = datetime.now(timezone.utc)
    db.commit()                              # question is saved even if answering fails
    db.refresh(user_msg)

    result = answer_question(db, content, _history(db, chat.id, user_msg.created_at))
    assistant = ChatMessage(session_id=chat.id, role="assistant", content="")
    _apply(assistant, result)
    db.add(assistant)
    chat.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(assistant)
    db.refresh(chat)
    return user_msg, assistant


def retry_answer(db: Session, chat: ChatSession, assistant: ChatMessage) -> ChatMessage:
    user_msg = db.scalar(
        select(ChatMessage)
        .where(ChatMessage.session_id == chat.id, ChatMessage.role == "user", ChatMessage.created_at < assistant.created_at)
        .order_by(ChatMessage.created_at.desc()).limit(1)
    )
    if user_msg is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The original question for this answer was not found.")
    result = answer_question(db, user_msg.content, _history(db, chat.id, user_msg.created_at))
    _apply(assistant, result)
    chat.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(assistant)
    return assistant
