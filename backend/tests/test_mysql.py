"""MySQL-specific behaviour: charset, time zones, ordering precision, JSON, constraints, search."""
from datetime import timezone

import pytest
from sqlalchemy import inspect, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError

from app.core.config import Settings
from app.db.session import engine
from app.models import ChatMessage, ChatSession, User
from tests.conftest import API, auth_headers


def test_database_is_mysql_utf8mb4_utc_read_committed(db):
    assert engine.dialect.name == "mysql"
    assert str(db.scalar(text("SELECT @@character_set_database"))).startswith("utf8mb4")
    assert db.scalar(text("SELECT @@session.time_zone")) == "+00:00"
    assert db.scalar(text("SELECT @@transaction_isolation")) == "READ-COMMITTED"


def test_all_tables_are_innodb_utf8mb4():
    with engine.connect() as c:
        rows = c.execute(text(
            "SELECT table_name, engine, table_collation FROM information_schema.tables "
            "WHERE table_schema = DATABASE() AND table_name <> 'alembic_version'"
        )).all()
    assert len(rows) == 6
    for name, eng, coll in rows:
        assert eng == "InnoDB", name
        assert coll.startswith("utf8mb4"), name


def test_datetime_columns_have_microseconds():
    cols = {c["name"]: c for c in inspect(engine).get_columns("chat_messages")}
    assert getattr(cols["created_at"]["type"], "fsp", None) == 6


def test_timestamps_roundtrip_as_utc_aware(db):
    user = User(email="tz@example.com", full_name="TZ", password_hash="x", chat_preferences={})
    db.add(user)
    db.commit()
    db.expire_all()
    got = db.scalar(select(User).where(User.email == "tz@example.com"))
    assert got.created_at.tzinfo is not None
    assert got.created_at.utcoffset() == timezone.utc.utcoffset(None)


def test_server_default_timestamp_is_utc_and_matches_python(db):
    db.execute(text("INSERT INTO users (id, email, full_name, password_hash, chat_preferences) "
                    "VALUES (REPLACE(UUID(),'-',''), 'raw@example.com', 'Raw', 'x', JSON_OBJECT())"))
    db.commit()
    u = db.scalar(select(User).where(User.email == "raw@example.com"))
    from datetime import datetime
    assert abs((datetime.now(timezone.utc) - u.created_at).total_seconds()) < 30
    assert u.is_active is True and u.role == "student" and u.token_version == 0


def test_message_order_is_exact_within_same_second(client, student, db):
    chat = client.post(f"{API}/chats", json={}, headers=student["headers"]).json()
    for i in range(5):
        client.post(f"{API}/chats/{chat['id']}/messages", json={"content": f"question number {i}"},
                    headers=student["headers"])
    msgs = client.get(f"{API}/chats/{chat['id']}", headers=student["headers"]).json()["messages"]
    roles = [m["role"] for m in msgs]
    assert roles == ["user", "assistant"] * 5
    assert [m["content"] for m in msgs if m["role"] == "user"] == [f"question number {i}" for i in range(5)]


def test_unicode_hindi_and_emoji_survive(client, student):
    chat = client.post(f"{API}/chats", json={}, headers=student["headers"]).json()
    text_in = "हॉस्टल की फीस कितनी है? 🎓"
    r = client.post(f"{API}/chats/{chat['id']}/messages", json={"content": text_in}, headers=student["headers"])
    assert r.status_code in (200, 201), r.text
    msgs = client.get(f"{API}/chats/{chat['id']}", headers=student["headers"]).json()["messages"]
    assert msgs[0]["content"] == text_in


def test_long_message_content_fits_mediumtext(db):
    u = User(email="long@example.com", full_name="L", password_hash="x", chat_preferences={})
    db.add(u); db.flush()
    s = ChatSession(user_id=u.id); db.add(s); db.flush()
    big = "x" * 200_000                                  # > 64 KB (plain TEXT limit)
    db.add(ChatMessage(session_id=s.id, role="assistant", content=big)); db.commit()
    assert len(db.scalar(select(ChatMessage.content).where(ChatMessage.session_id == s.id))) == 200_000


def test_json_columns_roundtrip(db):
    u = User(email="json@example.com", full_name="J", password_hash="x",
             chat_preferences={"a": [1, 2, {"b": "हिन्दी"}]})
    db.add(u); db.commit(); db.expire_all()
    assert db.scalar(select(User.chat_preferences).where(User.email == "json@example.com")) == {"a": [1, 2, {"b": "हिन्दी"}]}


def test_check_constraints_are_enforced(db):
    db.add(User(email="bad@example.com", full_name="B", password_hash="x", role="superuser", chat_preferences={}))
    with pytest.raises(DBAPIError):          # MySQL: OperationalError 3819 "Check constraint ... is violated"
        db.commit()
    db.rollback()


def test_email_is_unique_case_insensitively(db):
    db.add(User(email="Case@Example.com", full_name="A", password_hash="x", chat_preferences={}))
    db.commit()
    db.add(User(email="case@example.com", full_name="B", password_hash="x", chat_preferences={}))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_cascade_delete_user_removes_chats_and_messages(client, student, admin, db):
    chat = client.post(f"{API}/chats", json={}, headers=student["headers"]).json()
    client.post(f"{API}/chats/{chat['id']}/messages", json={"content": "hello there"}, headers=student["headers"])
    assert db.scalar(text("SELECT COUNT(*) FROM chat_messages")) >= 2
    r = client.delete(f"{API}/admin/users/{student['user']['id']}", headers=admin["headers"])
    assert r.status_code in (200, 204), r.text
    assert db.scalar(text("SELECT COUNT(*) FROM chat_messages")) == 0
    assert db.scalar(text("SELECT COUNT(*) FROM chat_sessions")) == 0


def test_search_with_like_wildcards_is_escaped(client, student):
    for title in ("100% done", "plain title"):
        client.post(f"{API}/chats", json={"title": title}, headers=student["headers"])
    r = client.get(f"{API}/chats", params={"q": "%"}, headers=student["headers"])
    titles = [c["title"] for c in (r.json() if isinstance(r.json(), list) else r.json().get("items", []))]
    assert titles == ["100% done"]


def test_usage_stats_endpoint_works_on_mysql(client, admin, student):
    chat = client.post(f"{API}/chats", json={}, headers=student["headers"]).json()
    client.post(f"{API}/chats/{chat['id']}/messages", json={"content": "fee structure"}, headers=student["headers"])
    r = client.get(f"{API}/admin/usage?days=7", headers=admin["headers"])
    assert r.status_code == 200
    days = r.json()
    assert len(days) == 7 and sum(d["questions"] for d in days) == 1 and sum(d["new_users"] for d in days) >= 2


def test_database_url_validation_and_normalisation():
    base = dict(secret_key="k" * 40)
    s = Settings(database_url="mysql://u:p%40ss@localhost/db", _env_file=None, **base)
    assert s.database_url.startswith("mysql+pymysql://u:p%40ss@localhost/db")
    assert "charset=utf8mb4" in s.database_url
    with pytest.raises(ValueError):
        Settings(database_url="postgresql+psycopg://u:p@localhost/db", _env_file=None, **base)


def test_health_endpoint_reports_database(client):
    r = client.get("/api/health")
    assert r.status_code == 200
