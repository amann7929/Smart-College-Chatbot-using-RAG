"""Test fixtures. Tests run against a REAL MySQL 8 database named by TEST_DATABASE_URL.

The schema is created by running the Alembic migrations, so migrations are exercised too.
"""
import os
import shutil

TEST_DB = os.environ.get("TEST_DATABASE_URL")
if not TEST_DB:
    raise RuntimeError(
        "TEST_DATABASE_URL is not set. The tests wipe the database they run against, so point it at a separate TEST database, e.g.\n"
        '  PowerShell: $env:TEST_DATABASE_URL = "mysql+pymysql://college_user:<password>@localhost:3306/college_chatbot_test"'
    )
# Must be set BEFORE the app is imported so settings/engine point at the test database.
import tempfile  # noqa: E402

_STORAGE = tempfile.mkdtemp(prefix="college_test_")
os.environ["UPLOAD_DIR"] = os.path.join(_STORAGE, "uploads")
os.environ["CHROMA_DIR"] = os.path.join(_STORAGE, "chroma")
os.environ["GROQ_API_KEY"] = ""
os.environ["PRELOAD_EMBEDDING_MODEL"] = "false"
os.environ["DATABASE_URL"] = TEST_DB
os.environ.setdefault("SECRET_KEY", "test-secret-key-test-secret-key-test-secret-key-1234")
os.environ["AUTH_RATE_LIMIT"] = "10"
os.environ["AUTH_RATE_WINDOW_SECONDS"] = "60"

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select, text  # noqa: E402

import httpx  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.rate_limit import limiter  # noqa: E402
from app.rag import vectorstore  # noqa: E402
from app.rag.embeddings import set_embedder  # noqa: E402
from app.rag.llm import GroqClient, set_llm  # noqa: E402
from tests.helpers import FakeEmbedder, GroqRecorder  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import ROLE_ADMIN, User  # noqa: E402

PASSWORD = "StrongPass1"
API = "/api/v1"


def _alembic_cfg() -> Config:
    return Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))


@pytest.fixture(scope="session", autouse=True)
def _migrated_database():
    cfg = _alembic_cfg()
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    yield


@pytest.fixture(autouse=True)
def _clean_state(monkeypatch):
    limiter.reset()
    shutil.rmtree(os.environ["UPLOAD_DIR"], ignore_errors=True)
    vectorstore.reset_for_tests()
    set_embedder(FakeEmbedder())
    set_llm(None)
    settings = get_settings()
    monkeypatch.setattr(settings, "similarity_threshold", 0.2)  # tuned for the offline FakeEmbedder
    monkeypatch.setattr(settings, "groq_api_key", "")
    monkeypatch.setattr("app.rag.llm.time.sleep", lambda *_: None)
    with engine.connect() as conn:
        # MySQL cannot TRUNCATE tables that are referenced by foreign keys unless the checks are switched off.
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        for table in ("audit_logs", "message_feedback", "chat_messages", "chat_sessions", "documents", "users"):
            conn.execute(text(f"TRUNCATE TABLE {table}"))
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


def register(client: TestClient, email: str = "student@example.com", name: str = "Test Student",
             password: str = PASSWORD) -> dict:
    r = client.post(f"{API}/auth/register", json={"email": email, "full_name": name, "password": password})
    assert r.status_code == 201, r.text
    return r.json()


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def student(client):
    data = register(client)
    return {"headers": auth_headers(data["access_token"]), "user": data["user"], "token": data["access_token"]}


@pytest.fixture
def other_student(client):
    data = register(client, "other@example.com", "Other Student")
    return {"headers": auth_headers(data["access_token"]), "user": data["user"], "token": data["access_token"]}


@pytest.fixture
def admin(client, db):
    data = register(client, "admin@example.com", "Admin User")
    user = db.scalar(select(User).where(User.email == "admin@example.com"))
    user.role = ROLE_ADMIN
    db.commit()
    return {"headers": auth_headers(data["access_token"]), "user": data["user"]}


@pytest.fixture
def groq(monkeypatch):
    """Install a real GroqClient wired to a scriptable fake server. Returns the recorder."""
    rec = GroqRecorder()
    monkeypatch.setattr(get_settings(), "groq_api_key", "gsk_test_key_123")
    set_llm(GroqClient(transport=httpx.MockTransport(rec.handler)))
    yield rec
    set_llm(None)
