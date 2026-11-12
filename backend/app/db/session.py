"""Engine and session factory (MySQL 8 via PyMySQL)."""
from collections.abc import Generator

from sqlalchemy import create_engine, pool
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


def build_engine(url: str, **overrides) -> Engine:
    """Create an engine whose every connection runs in UTC (NOW()/CURRENT_TIMESTAMP are then UTC too)."""
    kwargs: dict = {
        "pool_pre_ping": True,
        # Fresh-read semantics: every statement sees the latest committed data (MySQL defaults to
        # REPEATABLE READ, which makes long-lived sessions read stale snapshots and takes more gap locks).
        "isolation_level": "READ COMMITTED",
        "pool_recycle": 1800,          # MySQL closes idle connections (wait_timeout); recycle before that
        "pool_size": 10,
        "max_overflow": 20,
        "connect_args": {"init_command": "SET time_zone = '+00:00'"},
    }
    kwargs.update(overrides)
    if kwargs.get("poolclass") is pool.NullPool:      # NullPool does not accept sizing arguments
        kwargs.pop("pool_size", None)
        kwargs.pop("max_overflow", None)
    return create_engine(url, **kwargs)


engine = build_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
