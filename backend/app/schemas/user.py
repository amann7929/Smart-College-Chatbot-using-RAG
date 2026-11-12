import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.security import validate_password_strength


class ChatPreferences(BaseModel):
    model_config = ConfigDict(extra="forbid")
    show_sources: bool = True
    compact_mode: bool = False
    auto_scroll: bool = True
    stream_responses: bool = True


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: str
    is_active: bool
    theme_preference: str
    chat_preferences: dict
    created_at: datetime
    last_login_at: datetime | None = None


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    theme_preference: Literal["light", "dark"] | None = None
    chat_preferences: ChatPreferences | None = None

    @field_validator("full_name")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        return v.strip() if v else v


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(max_length=128)

    @field_validator("new_password")
    @classmethod
    def _strong(cls, v: str) -> str:
        err = validate_password_strength(v)
        if err:
            raise ValueError(err)
        return v
