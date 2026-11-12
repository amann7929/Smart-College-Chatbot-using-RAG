"""Create (or promote) the first administrator from FIRST_ADMIN_* environment variables.

Usage:  python -m app.scripts.create_admin
"""
import sys

from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import hash_password, validate_password_strength
from app.db.session import SessionLocal
from app.models import ROLE_ADMIN, User
from app.services.audit import log_action


def main() -> int:
    s = get_settings()
    email = s.first_admin_email.strip().lower()
    err = validate_password_strength(s.first_admin_password)
    if err:
        print(f"FIRST_ADMIN_PASSWORD is not acceptable: {err}")
        return 1
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user:
            user.role, user.is_active = ROLE_ADMIN, True
            log_action(db, "admin.promote_cli", user_id=user.id, entity_type="user", entity_id=user.id)
            db.commit()
            print(f"Existing user {email} promoted to admin (password unchanged).")
            return 0
        user = User(email=email, full_name=s.first_admin_name, role=ROLE_ADMIN,
                    password_hash=hash_password(s.first_admin_password), chat_preferences={})
        db.add(user)
        db.flush()
        log_action(db, "admin.create_cli", user_id=user.id, entity_type="user", entity_id=user.id)
        db.commit()
        print(f"Admin account created: {email}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
