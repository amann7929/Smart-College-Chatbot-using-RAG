import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import exists, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import ChatMessage, ChatSession, MessageFeedback, User
from app.schemas.chat import (
    ChatCreate, ChatDetail, ChatOut, ChatRename, FeedbackIn, FeedbackOut, MessageOut,
    SendMessageRequest, SendMessageResponse,
)
from app.services import chat as chat_service
from app.services.audit import log_action

router = APIRouter(prefix="/chats", tags=["Chats"])
messages_router = APIRouter(prefix="/messages", tags=["Chats"])


def get_owned_chat(db: Session, chat_id: uuid.UUID, user: User) -> ChatSession:
    """Return the chat only if it belongs to `user`. 404 (not 403) so existence is never leaked."""
    chat = db.scalar(select(ChatSession).where(ChatSession.id == chat_id, ChatSession.user_id == user.id))
    if chat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")
    return chat


def _messages_out(db: Session, chat: ChatSession, user: User) -> list[MessageOut]:
    ratings = {
        fb.message_id: fb.rating
        for fb in db.scalars(
            select(MessageFeedback)
            .join(ChatMessage, ChatMessage.id == MessageFeedback.message_id)
            .where(ChatMessage.session_id == chat.id, MessageFeedback.user_id == user.id)
        )
    }
    out = []
    for m in chat.messages:
        item = MessageOut.model_validate(m)
        item.my_feedback = ratings.get(m.id)
        out.append(item)
    return out


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@router.post("", response_model=ChatOut, status_code=status.HTTP_201_CREATED)
def create_chat(body: ChatCreate | None = None, user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    title = (body.title.strip() if body and body.title else "") or "New chat"
    chat = ChatSession(user_id=user.id, title=title)
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return chat


@router.get("", response_model=list[ChatOut])
def list_chats(
    q: str | None = Query(default=None, max_length=100, description="Search titles and message text"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(ChatSession).where(ChatSession.user_id == user.id)
    if q and q.strip():
        pattern = f"%{_escape_like(q.strip())}%"
        stmt = stmt.where(
            or_(
                ChatSession.title.ilike(pattern, escape="\\"),
                exists().where(ChatMessage.session_id == ChatSession.id,
                               ChatMessage.content.ilike(pattern, escape="\\")),
            )
        )
    stmt = stmt.order_by(ChatSession.updated_at.desc()).limit(limit).offset(offset)
    return list(db.scalars(stmt))


@router.get("/{chat_id}", response_model=ChatDetail)
def get_chat(chat_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    chat = get_owned_chat(db, chat_id, user)
    return ChatDetail(
        id=chat.id, title=chat.title, created_at=chat.created_at, updated_at=chat.updated_at,
        messages=_messages_out(db, chat, user),
    )


@router.patch("/{chat_id}", response_model=ChatOut)
def rename_chat(chat_id: uuid.UUID, body: ChatRename, user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    chat = get_owned_chat(db, chat_id, user)
    chat.title = body.title
    db.commit()
    db.refresh(chat)
    return chat


@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat(chat_id: uuid.UUID, request: Request, user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    chat = get_owned_chat(db, chat_id, user)
    log_action(db, "chat.delete", user_id=user.id, entity_type="chat", entity_id=chat.id, request=request)
    db.delete(chat)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{chat_id}/messages", status_code=status.HTTP_204_NO_CONTENT)
def clear_chat(chat_id: uuid.UUID, request: Request, user: User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    """Clear all messages but keep the chat session itself."""
    chat = get_owned_chat(db, chat_id, user)
    for m in list(chat.messages):
        db.delete(m)
    log_action(db, "chat.clear", user_id=user.id, entity_type="chat", entity_id=chat.id, request=request)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ----------------------------- messages (RAG) -----------------------------

@router.post("/{chat_id}/messages", response_model=SendMessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(chat_id: uuid.UUID, body: SendMessageRequest, user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    """Ask a question. The answer is grounded in retrieved document chunks; a failed answer is returned
    (status="failed") rather than an HTTP error so the UI can offer Retry."""
    chat = get_owned_chat(db, chat_id, user)
    chat_service.enforce_chat_rate_limit(user)
    user_msg, assistant = chat_service.send_message(db, chat, body.content)
    return SendMessageResponse(chat=ChatOut.model_validate(chat), user_message=MessageOut.model_validate(user_msg),
                               assistant_message=MessageOut.model_validate(assistant))


@router.post("/{chat_id}/messages/{message_id}/retry", response_model=MessageOut)
def retry_message(chat_id: uuid.UUID, message_id: uuid.UUID, user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    chat = get_owned_chat(db, chat_id, user)
    msg = db.scalar(select(ChatMessage).where(ChatMessage.id == message_id, ChatMessage.session_id == chat.id))
    if msg is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found.")
    if msg.role != "assistant" or msg.status != "failed":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only failed answers can be retried.")
    chat_service.enforce_chat_rate_limit(user)
    return MessageOut.model_validate(chat_service.retry_answer(db, chat, msg))


# ----------------------------- feedback -----------------------------

def _get_owned_assistant_message(db: Session, message_id: uuid.UUID, user: User) -> ChatMessage:
    msg = db.scalar(
        select(ChatMessage)
        .join(ChatSession, ChatSession.id == ChatMessage.session_id)
        .where(ChatMessage.id == message_id, ChatSession.user_id == user.id)
    )
    if msg is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found.")
    if msg.role != "assistant":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Feedback can only be given on assistant answers.")
    return msg


@messages_router.put("/{message_id}/feedback", response_model=FeedbackOut)
def submit_feedback(message_id: uuid.UUID, body: FeedbackIn, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    msg = _get_owned_assistant_message(db, message_id, user)
    fb = db.scalar(select(MessageFeedback).where(MessageFeedback.message_id == msg.id,
                                                 MessageFeedback.user_id == user.id))
    if fb is None:
        fb = MessageFeedback(message_id=msg.id, user_id=user.id, rating=body.rating, comment=body.comment)
        db.add(fb)
    else:
        fb.rating, fb.comment = body.rating, body.comment
    db.commit()
    return FeedbackOut(message_id=msg.id, rating=fb.rating, comment=fb.comment)


@messages_router.delete("/{message_id}/feedback", status_code=status.HTTP_204_NO_CONTENT)
def remove_feedback(message_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msg = _get_owned_assistant_message(db, message_id, user)
    fb = db.scalar(select(MessageFeedback).where(MessageFeedback.message_id == msg.id,
                                                 MessageFeedback.user_id == user.id))
    if fb is not None:
        db.delete(fb)
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
