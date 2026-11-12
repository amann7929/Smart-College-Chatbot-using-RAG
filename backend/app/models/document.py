import uuid
from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.types import NOW6, UTCDateTime, utcnow

DOC_STATUSES = ("pending", "processing", "indexed", "failed")


class Document(Base):
    """Metadata for an uploaded PDF. The document `id` is also the identifier used in ChromaDB."""

    __tablename__ = "documents"
    __table_args__ = (CheckConstraint("status IN ('pending','processing','indexed','failed')", name="status_valid"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    original_filename: Mapped[str] = mapped_column(String(255))
    stored_filename: Mapped[str] = mapped_column(String(255), unique=True)
    category: Mapped[str] = mapped_column(String(80), index=True)
    file_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)  # SHA-256 -> duplicate detection
    file_size: Mapped[int] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(20), default="pending", server_default="pending", index=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    page_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    chunk_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, server_default=NOW6)
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=utcnow, server_default=NOW6, onupdate=utcnow
    )
    indexed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
