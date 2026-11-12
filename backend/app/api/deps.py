"""Shared FastAPI dependencies: DB session, authentication, role checks."""
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import ROLE_ADMIN, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)

_CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials.",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    if not token:
        raise _CREDENTIALS_ERROR
    payload = decode_access_token(token)
    if payload is None:
        raise _CREDENTIALS_ERROR
    try:
        user_id = uuid.UUID(payload["sub"])
    except (ValueError, KeyError):
        raise _CREDENTIALS_ERROR
    user = db.get(User, user_id)
    if user is None or payload.get("ver") != user.token_version:
        raise _CREDENTIALS_ERROR
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been deactivated.")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != ROLE_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator access required.")
    return user
