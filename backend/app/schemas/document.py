import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    original_filename: str
    category: str
    file_size: int
    status: str
    error_message: str | None = None
    page_count: int
    chunk_count: int
    created_at: datetime
    indexed_at: datetime | None = None


class DocumentListOut(BaseModel):
    items: list[DocumentOut]
    total: int
    page: int
    page_size: int
