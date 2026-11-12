from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.routes.auth import _token_response
from app.core.security import hash_password, verify_password
from app.db.session import get_db
from app.models import User
from app.schemas.auth import TokenResponse
from app.schemas.user import ChangePasswordRequest, UserOut, UserUpdate
from app.services.audit import log_action

router = APIRouter(prefix="/users", tags=["Profile & Settings"])


@router.get("/me", response_model=UserOut)
def get_profile(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_profile(body: UserUpdate, request: Request, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    data = body.model_dump(exclude_unset=True)
    if "full_name" in data and data["full_name"] is not None:
        user.full_name = data["full_name"]
    if "theme_preference" in data and data["theme_preference"] is not None:
        user.theme_preference = data["theme_preference"]
    if "chat_preferences" in data and data["chat_preferences"] is not None:
        merged = {**(user.chat_preferences or {}), **data["chat_preferences"]}
        user.chat_preferences = merged
    log_action(db, "user.update_profile", user_id=user.id, entity_type="user", entity_id=user.id,
               details={"fields": sorted(data.keys())}, request=request)
    db.commit()
    db.refresh(user)
    return user


@router.post("/me/change-password", response_model=TokenResponse)
def change_password(body: ChangePasswordRequest, request: Request, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    """Changes the password and invalidates every previously issued token. Returns a fresh token."""
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    if verify_password(body.new_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="New password must be different from the current password.")
    user.password_hash = hash_password(body.new_password)
    user.token_version += 1
    log_action(db, "user.change_password", user_id=user.id, entity_type="user", entity_id=user.id, request=request)
    db.commit()
    return _token_response(user)
