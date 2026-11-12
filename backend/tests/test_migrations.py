from sqlalchemy import inspect

from app.db.session import engine


def test_all_expected_tables_and_key_indexes_exist():
    insp = inspect(engine)
    assert {"users", "chat_sessions", "chat_messages", "documents", "message_feedback", "audit_logs"} <= set(insp.get_table_names())
    user_idx = {i["name"] for i in insp.get_indexes("users")}
    assert "ix_users_email" in user_idx
    fks = {fk["referred_table"] for fk in insp.get_foreign_keys("chat_messages")}
    assert fks == {"chat_sessions"}
    doc_unique = [i for i in insp.get_indexes("documents") if i["name"] == "ix_documents_file_hash"]
    assert doc_unique and doc_unique[0]["unique"]
