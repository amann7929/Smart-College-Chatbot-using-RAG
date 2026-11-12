import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.user import UserOut


class AdminUserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["student", "admin"] | None = None
    is_active: bool | None = None


class UserListOut(BaseModel):
    items: list[UserOut]
    total: int
    page: int
    page_size: int


class StatsOut(BaseModel):
    total_users: int
    active_users: int
    total_documents: int
    indexed_documents: int
    failed_documents: int
    pending_documents: int
    processing_documents: int
    total_chunks: int
    total_questions: int
    total_chats: int


class DailyUsage(BaseModel):
    day: date
    questions: int
    new_users: int


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: uuid.UUID | None
    user_email: str | None = None
    action: str
    entity_type: str | None
    entity_id: str | None
    details: dict | None
    created_at: datetime


class FeedbackSummary(BaseModel):
    total: int
    positive: int
    negative: int
    positive_rate: float | None  # None when there is no feedback yet
