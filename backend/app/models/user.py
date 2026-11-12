import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, Integer, String, Uuid, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, JSONType
from app.db.types import NOW6, UTCDateTime, utcnow

ROLE_STUDENT = "student"
ROLE_ADMIN = "admin"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('student','admin')", name="role_valid"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default=ROLE_STUDENT, server_default=ROLE_STUDENT)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    # Incremented on password change -> invalidates all previously issued JWTs.
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    theme_preference: Mapped[str] = mapped_column(String(10), default="light", server_default="light")
    chat_preferences: Mapped[dict] = mapped_column(JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, server_default=NOW6)
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=utcnow, server_default=NOW6, onupdate=utcnow
    )
    last_login_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan", passive_deletes=True)
