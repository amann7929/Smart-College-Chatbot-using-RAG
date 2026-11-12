from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.rate_limit import rate_limit
from app.core.security import (
    DUMMY_HASH,
    create_access_token,
    hash_password,
    password_needs_rehash,
    verify_password,
)
from app.db.session import get_db
from app.models import ROLE_STUDENT, User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserOut
from app.services.audit import log_action

router = APIRouter(prefix="/auth", tags=["Authentication"])
_settings = get_settings()
auth_limit = rate_limit("auth", _settings.auth_rate_limit, _settings.auth_rate_window_seconds)


def _token_response(user: User) -> TokenResponse:
    token, expires_in = create_access_token(user.id, user.token_version)
    return TokenResponse(access_token=token, expires_in=expires_in, user=UserOut.model_validate(user))


def _authenticate(db: Session, email: str, password: str, request: Request) -> User:
    email = email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    # Always run a hash verification so response time doesn't reveal whether the account exists.
    valid = verify_password(password, user.password_hash if user else DUMMY_HASH)
    if user is None or not valid:
        log_action(db, "auth.login_failed", user_id=user.id if user else None,
                   details={"email": email}, request=request)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been deactivated.")
    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
    user.last_login_at = datetime.now(timezone.utc)
    log_action(db, "auth.login", user_id=user.id, entity_type="user", entity_id=user.id, request=request)
    db.commit()
    return user


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(auth_limit)])
def register(body: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    """Public registration always creates a *student* account. Admins are created via the CLI script."""
    if db.scalar(select(User.id).where(User.email == body.email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")
    user = User(
        email=body.email,
        full_name=body.full_name,
        password_hash=hash_password(body.password),
        role=ROLE_STUDENT,
        chat_preferences={},
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:  # race: same email registered concurrently
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")
    log_action(db, "auth.register", user_id=user.id, entity_type="user", entity_id=user.id, request=request)
    db.commit()
    return _token_response(user)


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(auth_limit)])
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    return _token_response(_authenticate(db, body.email, body.password, request))


@router.post("/token", response_model=TokenResponse, dependencies=[Depends(auth_limit)], include_in_schema=True)
def login_form(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """OAuth2 form login (used by the Swagger 'Authorize' button; `username` is the email)."""
    return _token_response(_authenticate(db, form.username, form.password, request))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Tokens are stateless; the client discards its token. This records the event in the audit log."""
    log_action(db, "auth.logout", user_id=user.id, entity_type="user", entity_id=user.id, request=request)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
