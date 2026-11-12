from sqlalchemy import select

from app.models import AuditLog, User
from tests.conftest import API, PASSWORD, auth_headers, register


def test_register_creates_student_and_returns_token(client):
    data = register(client)
    assert data["token_type"] == "bearer"
    assert data["user"]["role"] == "student"
    assert data["user"]["email"] == "student@example.com"
    assert "password" not in str(data).lower().replace("password_hash", "")


def test_register_cannot_self_assign_admin(client, db):
    r = client.post(f"{API}/auth/register", json={
        "email": "evil@example.com", "full_name": "Evil User", "password": PASSWORD, "role": "admin"})
    assert r.status_code == 201
    assert r.json()["user"]["role"] == "student"


def test_password_is_stored_as_argon2_hash(client, db):
    register(client)
    user = db.scalar(select(User).where(User.email == "student@example.com"))
    assert user.password_hash.startswith("$argon2id$")
    assert PASSWORD not in user.password_hash


def test_weak_password_rejected_and_not_echoed(client):
    r = client.post(f"{API}/auth/register", json={"email": "a@example.com", "full_name": "Abc", "password": "weakpw"})
    assert r.status_code == 422
    assert "weakpw" not in r.text
    assert any("Password" in e["message"] for e in r.json()["errors"])


def test_invalid_email_rejected(client):
    r = client.post(f"{API}/auth/register", json={"email": "not-an-email", "full_name": "Abc", "password": PASSWORD})
    assert r.status_code == 422


def test_duplicate_email_conflict_case_insensitive(client):
    register(client, "dup@example.com")
    r = client.post(f"{API}/auth/register", json={"email": "DUP@Example.com", "full_name": "Dup Two", "password": PASSWORD})
    assert r.status_code == 409


def test_login_success_and_me(client):
    register(client)
    r = client.post(f"{API}/auth/login", json={"email": "STUDENT@example.com", "password": PASSWORD})
    assert r.status_code == 200
    token = r.json()["access_token"]
    me = client.get(f"{API}/auth/me", headers=auth_headers(token))
    assert me.status_code == 200 and me.json()["email"] == "student@example.com"
    assert me.json()["last_login_at"] is not None


def test_login_failure_messages_do_not_reveal_account_existence(client):
    register(client)
    wrong_pw = client.post(f"{API}/auth/login", json={"email": "student@example.com", "password": "WrongPass1"})
    no_user = client.post(f"{API}/auth/login", json={"email": "ghost@example.com", "password": "WrongPass1"})
    assert wrong_pw.status_code == no_user.status_code == 401
    assert wrong_pw.json() == no_user.json()


def test_failed_login_is_audited(client, db):
    register(client)
    client.post(f"{API}/auth/login", json={"email": "student@example.com", "password": "WrongPass1"})
    assert db.scalar(select(AuditLog).where(AuditLog.action == "auth.login_failed")) is not None


def test_protected_routes_require_valid_token(client):
    assert client.get(f"{API}/auth/me").status_code == 401
    assert client.get(f"{API}/chats").status_code == 401
    assert client.get(f"{API}/auth/me", headers=auth_headers("garbage.token.value")).status_code == 401


def test_swagger_form_login(client):
    register(client)
    r = client.post(f"{API}/auth/token", data={"username": "student@example.com", "password": PASSWORD})
    assert r.status_code == 200 and r.json()["access_token"]


def test_logout_is_audited(client, student, db):
    r = client.post(f"{API}/auth/logout", headers=student["headers"])
    assert r.status_code == 204
    assert db.scalar(select(AuditLog).where(AuditLog.action == "auth.logout")) is not None


def test_auth_rate_limit_returns_429(client):
    codes = [client.post(f"{API}/auth/login", json={"email": "x@example.com", "password": "Whatever1"}).status_code
             for _ in range(12)]
    assert codes[:10] == [401] * 10
    assert 429 in codes[10:]


def test_security_headers_present(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["database"] == "up"
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"


def test_cors_allows_configured_origin_only(client):
    ok = client.options(f"{API}/auth/login", headers={
        "Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    bad = client.options(f"{API}/auth/login", headers={
        "Origin": "http://evil.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in bad.headers
