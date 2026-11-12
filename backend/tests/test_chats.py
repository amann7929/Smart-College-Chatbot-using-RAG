import uuid

from sqlalchemy import select

from app.models import ChatMessage, ChatSession, MessageFeedback
from tests.conftest import API


def make_chat(client, headers, title=None):
    r = client.post(f"{API}/chats", headers=headers, json={"title": title} if title else None)
    assert r.status_code == 201, r.text
    return r.json()


def add_messages(db, chat_id, pairs):
    ids = []
    for role, content in pairs:
        m = ChatMessage(session_id=uuid.UUID(chat_id), role=role, content=content)
        db.add(m)
        db.flush()
        ids.append(str(m.id))
    db.commit()
    return ids


def test_create_list_rename_delete(client, student):
    chat = make_chat(client, student["headers"])
    assert chat["title"] == "New chat"
    named = make_chat(client, student["headers"], "Fees question")
    assert named["title"] == "Fees question"
    listing = client.get(f"{API}/chats", headers=student["headers"]).json()
    assert {c["id"] for c in listing} == {chat["id"], named["id"]}

    r = client.patch(f"{API}/chats/{chat['id']}", headers=student["headers"], json={"title": "  Hostel info  "})
    assert r.status_code == 200 and r.json()["title"] == "Hostel info"
    assert client.patch(f"{API}/chats/{chat['id']}", headers=student["headers"], json={"title": "   "}).status_code == 422

    assert client.delete(f"{API}/chats/{chat['id']}", headers=student["headers"]).status_code == 204
    assert client.get(f"{API}/chats/{chat['id']}", headers=student["headers"]).status_code == 404


def test_create_chat_without_body(client, student):
    r = client.post(f"{API}/chats", headers=student["headers"])
    assert r.status_code == 201 and r.json()["title"] == "New chat"


def test_chat_ownership_isolation(client, student, other_student):
    chat = make_chat(client, student["headers"], "Private")
    h = other_student["headers"]
    assert client.get(f"{API}/chats/{chat['id']}", headers=h).status_code == 404
    assert client.patch(f"{API}/chats/{chat['id']}", headers=h, json={"title": "hack"}).status_code == 404
    assert client.delete(f"{API}/chats/{chat['id']}", headers=h).status_code == 404
    assert client.delete(f"{API}/chats/{chat['id']}/messages", headers=h).status_code == 404
    assert client.get(f"{API}/chats", headers=h).json() == []
    # still intact for the owner
    assert client.get(f"{API}/chats/{chat['id']}", headers=student["headers"]).status_code == 200


def test_unknown_chat_id_is_404_and_bad_uuid_is_422(client, student):
    assert client.get(f"{API}/chats/{uuid.uuid4()}", headers=student["headers"]).status_code == 404
    assert client.get(f"{API}/chats/not-a-uuid", headers=student["headers"]).status_code == 422


def test_chat_detail_returns_ordered_messages(client, student, db):
    chat = make_chat(client, student["headers"])
    add_messages(db, chat["id"], [("user", "What are the fees?"), ("assistant", "Not in documents.")])
    r = client.get(f"{API}/chats/{chat['id']}", headers=student["headers"]).json()
    assert [m["role"] for m in r["messages"]] == ["user", "assistant"]
    assert r["messages"][1]["sources"] is None  # never fabricated


def test_search_by_title_and_message_content_with_wildcard_escaping(client, student, db):
    a = make_chat(client, student["headers"], "Hostel rules")
    b = make_chat(client, student["headers"], "Untitled")
    c = make_chat(client, student["headers"], "Other")
    add_messages(db, b["id"], [("user", "When does the library open?")])
    add_messages(db, c["id"], [("user", "100% attendance needed?")])
    h = student["headers"]
    ids = lambda q: {x["id"] for x in client.get(f"{API}/chats", headers=h, params={"q": q}).json()}
    assert ids("hostel") == {a["id"]}
    assert ids("LIBRARY") == {b["id"]}
    assert ids("100%") == {c["id"]}
    assert ids("%") == {c["id"]}      # '%' is literal, not "match everything"
    assert ids("_") == set()          # '_' is literal too
    assert ids("zzz-nothing") == set()


def test_clear_chat_keeps_session_but_removes_messages(client, student, db):
    chat = make_chat(client, student["headers"])
    add_messages(db, chat["id"], [("user", "hi"), ("assistant", "hello")])
    assert client.delete(f"{API}/chats/{chat['id']}/messages", headers=student["headers"]).status_code == 204
    detail = client.get(f"{API}/chats/{chat['id']}", headers=student["headers"]).json()
    assert detail["messages"] == []


def test_delete_chat_cascades_messages_and_feedback(client, student, db):
    chat = make_chat(client, student["headers"])
    q, a = add_messages(db, chat["id"], [("user", "q"), ("assistant", "a")])
    client.put(f"{API}/messages/{a}/feedback", headers=student["headers"], json={"rating": 1})
    client.delete(f"{API}/chats/{chat['id']}", headers=student["headers"])
    db.expire_all()
    assert db.scalar(select(ChatMessage).where(ChatMessage.session_id == uuid.UUID(chat["id"]))) is None
    assert db.scalar(select(MessageFeedback)) is None


def test_feedback_upsert_and_listing(client, student, db):
    chat = make_chat(client, student["headers"])
    q, a = add_messages(db, chat["id"], [("user", "q"), ("assistant", "a")])
    h = student["headers"]
    assert client.put(f"{API}/messages/{a}/feedback", headers=h, json={"rating": 1}).json()["rating"] == 1
    r = client.put(f"{API}/messages/{a}/feedback", headers=h, json={"rating": -1, "comment": "Wrong"})
    assert r.json()["rating"] == -1
    db.expire_all()
    assert len(list(db.scalars(select(MessageFeedback)))) == 1  # upsert, not duplicate
    detail = client.get(f"{API}/chats/{chat['id']}", headers=h).json()
    assert detail["messages"][1]["my_feedback"] == -1 and detail["messages"][0]["my_feedback"] is None
    assert client.delete(f"{API}/messages/{a}/feedback", headers=h).status_code == 204
    assert client.get(f"{API}/chats/{chat['id']}", headers=h).json()["messages"][1]["my_feedback"] is None


def test_feedback_validation_and_ownership(client, student, other_student, db):
    chat = make_chat(client, student["headers"])
    q, a = add_messages(db, chat["id"], [("user", "q"), ("assistant", "a")])
    assert client.put(f"{API}/messages/{q}/feedback", headers=student["headers"], json={"rating": 1}).status_code == 400
    assert client.put(f"{API}/messages/{a}/feedback", headers=student["headers"], json={"rating": 5}).status_code == 422
    assert client.put(f"{API}/messages/{a}/feedback", headers=other_student["headers"], json={"rating": 1}).status_code == 404
    assert client.put(f"{API}/messages/{uuid.uuid4()}/feedback", headers=student["headers"], json={"rating": 1}).status_code == 404
