import uuid

from sqlalchemy import select

from app.models import ChatSession, Document, User
from tests.conftest import API, register, auth_headers
from tests.test_chats import add_messages, make_chat


def test_admin_endpoints_forbidden_for_students_and_anonymous(client, student):
    for path in ("/admin/users", "/admin/stats", "/admin/usage", "/admin/activity", "/admin/feedback-summary"):
        assert client.get(f"{API}{path}", headers=student["headers"]).status_code == 403, path
        assert client.get(f"{API}{path}").status_code == 401, path


def test_list_and_search_users(client, admin, student, other_student):
    r = client.get(f"{API}/admin/users", headers=admin["headers"]).json()
    assert r["total"] == 3 and len(r["items"]) == 3
    assert "password_hash" not in str(r)
    assert client.get(f"{API}/admin/users", headers=admin["headers"], params={"search": "other"}).json()["total"] == 1
    assert client.get(f"{API}/admin/users", headers=admin["headers"], params={"role": "admin"}).json()["total"] == 1
    page = client.get(f"{API}/admin/users", headers=admin["headers"], params={"page_size": 2, "page": 2}).json()
    assert len(page["items"]) == 1 and page["total"] == 3


def test_change_role_and_audit(client, admin, student):
    uid = student["user"]["id"]
    r = client.patch(f"{API}/admin/users/{uid}", headers=admin["headers"], json={"role": "admin"})
    assert r.status_code == 200 and r.json()["role"] == "admin"
    act = client.get(f"{API}/admin/activity", headers=admin["headers"], params={"action": "admin.update_user"}).json()
    assert act and act[0]["user_email"] == "admin@example.com"


def test_admin_cannot_modify_or_delete_self(client, admin):
    uid = admin["user"]["id"]
    assert client.patch(f"{API}/admin/users/{uid}", headers=admin["headers"], json={"role": "student"}).status_code == 400
    assert client.patch(f"{API}/admin/users/{uid}", headers=admin["headers"], json={"is_active": False}).status_code == 400
    assert client.delete(f"{API}/admin/users/{uid}", headers=admin["headers"]).status_code == 400


def test_cannot_remove_last_active_admin(client, admin, student, db):
    # promote student -> two admins; then deactivating one is fine, the other is then protected
    sid = student["user"]["id"]
    client.patch(f"{API}/admin/users/{sid}", headers=admin["headers"], json={"role": "admin"})
    r = client.patch(f"{API}/admin/users/{admin['user']['id']}", headers=student["headers"], json={"is_active": False})
    assert r.status_code == 200
    # `student` is now the only active admin; the deactivated admin can't act, and student can't demote self
    assert client.patch(f"{API}/admin/users/{sid}", headers=student["headers"], json={"role": "student"}).status_code == 400


def test_last_admin_guard_blocks_demotion_by_another_admin(client, admin, db):
    # A second admin exists but is the *target*; make sure the guard allows it while another admin remains.
    data = register(client, "second@example.com", "Second Admin")
    db.execute(User.__table__.update().where(User.email == "second@example.com").values(role="admin"))
    db.commit()
    sec_id = data["user"]["id"]
    ok = client.patch(f"{API}/admin/users/{sec_id}", headers=admin["headers"], json={"role": "student"})
    assert ok.status_code == 200


def test_deactivating_user_revokes_token_and_blocks_login(client, admin, student):
    uid = student["user"]["id"]
    assert client.patch(f"{API}/admin/users/{uid}", headers=admin["headers"], json={"is_active": False}).status_code == 200
    assert client.get(f"{API}/auth/me", headers=student["headers"]).status_code == 401  # token revoked
    r = client.post(f"{API}/auth/login", json={"email": "student@example.com", "password": "StrongPass1"})
    assert r.status_code == 403
    client.patch(f"{API}/admin/users/{uid}", headers=admin["headers"], json={"is_active": True})
    assert client.post(f"{API}/auth/login", json={"email": "student@example.com", "password": "StrongPass1"}).status_code == 200


def test_delete_user_cascades_chats(client, admin, student, db):
    chat = make_chat(client, student["headers"])
    add_messages(db, chat["id"], [("user", "q")])
    assert client.delete(f"{API}/admin/users/{student['user']['id']}", headers=admin["headers"]).status_code == 204
    db.expire_all()
    assert db.scalar(select(ChatSession).where(ChatSession.id == uuid.UUID(chat["id"]))) is None
    assert client.delete(f"{API}/admin/users/{uuid.uuid4()}", headers=admin["headers"]).status_code == 404


def test_stats_usage_feedback(client, admin, student, db):
    chat = make_chat(client, student["headers"])
    q, a = add_messages(db, chat["id"], [("user", "q1"), ("assistant", "a1")])
    db.add_all([
        Document(original_filename="a.pdf", stored_filename="a1.pdf", category="Fee Structure", file_hash="a" * 64,
                 file_size=10, status="indexed", chunk_count=7),
        Document(original_filename="b.pdf", stored_filename="b1.pdf", category="Syllabus", file_hash="b" * 64,
                 file_size=10, status="failed", chunk_count=0),
        Document(original_filename="c.pdf", stored_filename="c1.pdf", category="Syllabus", file_hash="c" * 64,
                 file_size=10, status="pending", chunk_count=99),  # must not be counted as indexed chunks
    ])
    db.commit()
    fb0 = client.get(f"{API}/admin/feedback-summary", headers=admin["headers"]).json()
    assert fb0 == {"total": 0, "positive": 0, "negative": 0, "positive_rate": None}
    client.put(f"{API}/messages/{a}/feedback", headers=student["headers"], json={"rating": 1})

    s = client.get(f"{API}/admin/stats", headers=admin["headers"]).json()
    assert s == {"total_users": 2, "active_users": 2, "total_documents": 3, "indexed_documents": 1,
                 "failed_documents": 1, "pending_documents": 1, "processing_documents": 0, "total_chunks": 7, "total_questions": 1, "total_chats": 1}

    u = client.get(f"{API}/admin/usage", headers=admin["headers"], params={"days": 7}).json()
    assert len(u) == 7 and u == sorted(u, key=lambda x: x["day"])
    assert u[-1]["questions"] == 1 and u[-1]["new_users"] == 2
    assert sum(d["questions"] for d in u[:-1]) == 0  # zero-filled earlier days

    fb = client.get(f"{API}/admin/feedback-summary", headers=admin["headers"]).json()
    assert fb == {"total": 1, "positive": 1, "negative": 0, "positive_rate": 1.0}
