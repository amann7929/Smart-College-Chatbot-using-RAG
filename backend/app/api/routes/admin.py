import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import Date, func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models import (
    ROLE_ADMIN, AuditLog, ChatMessage, ChatSession, Document, MessageFeedback, User,
)
from app.schemas.admin import (
    ActivityOut, AdminUserUpdate, DailyUsage, FeedbackSummary, StatsOut, UserListOut,
)
from app.schemas.user import UserOut
from app.services.audit import log_action

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_admin)])


def _would_remove_last_admin(db: Session, target: User, new_role: str, new_active: bool) -> bool:
    """True if applying the change would leave the system with no active admin."""
    if not (target.role == ROLE_ADMIN and target.is_active):
        return False
    if new_role == ROLE_ADMIN and new_active:
        return False
    others = db.scalar(
        select(func.count()).select_from(User).where(User.role == ROLE_ADMIN, User.is_active.is_(True),
                                                     User.id != target.id)
    )
    return others == 0


def _get_user_or_404(db: Session, user_id: uuid.UUID) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return user


@router.get("/users", response_model=UserListOut)
def list_users(
    search: str | None = Query(default=None, max_length=100),
    role: str | None = Query(default=None, pattern="^(student|admin)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    stmt = select(User)
    if search and search.strip():
        term = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{term}%"
        stmt = stmt.where(or_(User.email.ilike(pattern, escape="\\"), User.full_name.ilike(pattern, escape="\\")))
    if role:
        stmt = stmt.where(User.role == role)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    items = db.scalars(stmt.order_by(User.created_at.desc()).limit(page_size).offset((page - 1) * page_size))
    return UserListOut(items=[UserOut.model_validate(u) for u in items], total=total, page=page, page_size=page_size)


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: uuid.UUID, body: AdminUserUpdate, request: Request,
                admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = _get_user_or_404(db, user_id)
    new_role = body.role if body.role is not None else user.role
    new_active = body.is_active if body.is_active is not None else user.is_active
    if user.id == admin.id and (new_role != user.role or new_active != user.is_active):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="You cannot change your own role or active status.")
    if _would_remove_last_admin(db, user, new_role, new_active):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="This would leave the system without an active administrator.")
    changes = {}
    if new_role != user.role:
        changes["role"] = {"from": user.role, "to": new_role}
        user.role = new_role
    if new_active != user.is_active:
        changes["is_active"] = {"from": user.is_active, "to": new_active}
        user.is_active = new_active
        if not new_active:
            user.token_version += 1  # revoke existing sessions immediately
    if changes:
        log_action(db, "admin.update_user", user_id=admin.id, entity_type="user", entity_id=user.id,
                   details=changes, request=request)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: uuid.UUID, request: Request, admin: User = Depends(require_admin),
                db: Session = Depends(get_db)):
    user = _get_user_or_404(db, user_id)
    if user.id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot delete your own account.")
    if _would_remove_last_admin(db, user, "student", False):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="This would leave the system without an active administrator.")
    log_action(db, "admin.delete_user", user_id=admin.id, entity_type="user", entity_id=user.id,
               details={"email": user.email}, request=request)
    db.delete(user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/stats", response_model=StatsOut)
def stats(db: Session = Depends(get_db)):
    def count(stmt):
        return db.scalar(stmt) or 0

    return StatsOut(
        total_users=count(select(func.count()).select_from(User)),
        active_users=count(select(func.count()).select_from(User).where(User.is_active.is_(True))),
        total_documents=count(select(func.count()).select_from(Document)),
        indexed_documents=count(select(func.count()).select_from(Document).where(Document.status == "indexed")),
        failed_documents=count(select(func.count()).select_from(Document).where(Document.status == "failed")),
        pending_documents=count(select(func.count()).select_from(Document).where(Document.status == "pending")),
        processing_documents=count(select(func.count()).select_from(Document).where(Document.status == "processing")),
        total_chunks=count(select(func.coalesce(func.sum(Document.chunk_count), 0)).where(Document.status == "indexed")),
        total_questions=count(select(func.count()).select_from(ChatMessage).where(ChatMessage.role == "user")),
        total_chats=count(select(func.count()).select_from(ChatSession)),
    )


@router.get("/usage", response_model=list[DailyUsage])
def usage(days: int = Query(default=14, ge=1, le=90), db: Session = Depends(get_db)):
    """Questions asked and users registered per day (zero-filled), oldest first."""
    today = datetime.now(timezone.utc).date()
    start_day = today - timedelta(days=days - 1)
    start = datetime.combine(start_day, datetime.min.time(), tzinfo=timezone.utc)

    # created_at is stored in UTC, so DATE() already gives the UTC day.
    q_day = func.date(ChatMessage.created_at, type_=Date)
    questions = dict(db.execute(
        select(q_day, func.count()).where(ChatMessage.role == "user", ChatMessage.created_at >= start).group_by(q_day)
    ).all())
    u_day = func.date(User.created_at, type_=Date)
    new_users = dict(db.execute(
        select(u_day, func.count()).where(User.created_at >= start).group_by(u_day)
    ).all())

    out: list[DailyUsage] = []
    for i in range(days):
        d: date = start_day + timedelta(days=i)
        out.append(DailyUsage(day=d, questions=questions.get(d, 0), new_users=new_users.get(d, 0)))
    return out


@router.get("/activity", response_model=list[ActivityOut])
def activity(limit: int = Query(default=20, ge=1, le=100), action: str | None = Query(default=None, max_length=80),
             db: Session = Depends(get_db)):
    stmt = select(AuditLog, User.email).outerjoin(User, User.id == AuditLog.user_id)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    rows = db.execute(stmt.order_by(AuditLog.created_at.desc()).limit(limit)).all()
    out = []
    for log, email in rows:
        item = ActivityOut.model_validate(log)
        item.user_email = email
        out.append(item)
    return out


@router.get("/feedback-summary", response_model=FeedbackSummary)
def feedback_summary(db: Session = Depends(get_db)):
    pos = db.scalar(select(func.count()).select_from(MessageFeedback).where(MessageFeedback.rating == 1)) or 0
    neg = db.scalar(select(func.count()).select_from(MessageFeedback).where(MessageFeedback.rating == -1)) or 0
    total = pos + neg
    return FeedbackSummary(total=total, positive=pos, negative=neg,
                           positive_rate=round(pos / total, 4) if total else None)
