"""initial schema (MySQL 8, InnoDB, utf8mb4)

Revision ID: 0001
Revises:
Create Date: 2026-10-26 13:52:52.870525
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Every table: InnoDB (transactions + foreign keys), full Unicode (emoji, Hindi) and case-insensitive matching.
TABLE_OPTS = dict(mysql_engine="InnoDB", mysql_charset="utf8mb4", mysql_collate="utf8mb4_unicode_ci")


def _now6() -> sa.TextClause:
    return sa.text("CURRENT_TIMESTAMP(6)")


def _ts(name: str, nullable: bool = False, default: bool = True) -> sa.Column:
    """UTC timestamp with microseconds (DATETIME(6))."""
    return sa.Column(name, mysql.DATETIME(fsp=6), nullable=nullable, server_default=_now6() if default else None)


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=120), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), server_default="student", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("token_version", sa.Integer(), server_default="0", nullable=False),
        sa.Column("theme_preference", sa.String(length=10), server_default="light", nullable=False),
        sa.Column("chat_preferences", sa.JSON(), nullable=False),
        _ts("created_at"),
        _ts("updated_at"),
        _ts("last_login_at", nullable=True, default=False),
        sa.CheckConstraint("role IN ('student','admin')", name=op.f("ck_users_role_valid")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        **TABLE_OPTS,
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=True),
        sa.Column("entity_id", sa.String(length=64), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        _ts("created_at"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_audit_logs_user_id_users"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_logs")),
        **TABLE_OPTS,
    )
    op.create_index(op.f("ix_audit_logs_action"), "audit_logs", ["action"], unique=False)
    op.create_index(op.f("ix_audit_logs_created_at"), "audit_logs", ["created_at"], unique=False)
    op.create_index(op.f("ix_audit_logs_user_id"), "audit_logs", ["user_id"], unique=False)

    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), server_default="New chat", nullable=False),
        _ts("created_at"),
        _ts("updated_at"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_chat_sessions_user_id_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_chat_sessions")),
        **TABLE_OPTS,
    )
    op.create_index(op.f("ix_chat_sessions_user_id"), "chat_sessions", ["user_id"], unique=False)
    op.create_index("ix_chat_sessions_user_updated", "chat_sessions", ["user_id", "updated_at"], unique=False)

    op.create_table(
        "documents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("stored_filename", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("file_hash", sa.String(length=64), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("page_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("chunk_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("uploaded_by", sa.Uuid(), nullable=True),
        _ts("created_at"),
        _ts("updated_at"),
        _ts("indexed_at", nullable=True, default=False),
        sa.CheckConstraint("status IN ('pending','processing','indexed','failed')", name=op.f("ck_documents_status_valid")),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], name=op.f("fk_documents_uploaded_by_users"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_documents")),
        sa.UniqueConstraint("stored_filename", name=op.f("uq_documents_stored_filename")),
        **TABLE_OPTS,
    )
    op.create_index(op.f("ix_documents_category"), "documents", ["category"], unique=False)
    op.create_index(op.f("ix_documents_file_hash"), "documents", ["file_hash"], unique=True)
    op.create_index(op.f("ix_documents_status"), "documents", ["status"], unique=False)

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text().with_variant(mysql.MEDIUMTEXT(), "mysql"), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="completed", nullable=False),
        sa.Column("sources", sa.JSON(), nullable=True),
        sa.Column("retrieval_meta", sa.JSON(), nullable=True),
        _ts("created_at"),
        sa.CheckConstraint("role IN ('user','assistant')", name=op.f("ck_chat_messages_role_valid")),
        sa.CheckConstraint("status IN ('completed','failed')", name=op.f("ck_chat_messages_status_valid")),
        sa.ForeignKeyConstraint(["session_id"], ["chat_sessions.id"], name=op.f("fk_chat_messages_session_id_chat_sessions"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_chat_messages")),
        **TABLE_OPTS,
    )
    op.create_index("ix_chat_messages_session_created", "chat_messages", ["session_id", "created_at"], unique=False)
    op.create_index(op.f("ix_chat_messages_session_id"), "chat_messages", ["session_id"], unique=False)

    op.create_table(
        "message_feedback",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("message_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("rating", sa.SmallInteger(), nullable=False),
        sa.Column("comment", sa.String(length=500), nullable=True),
        _ts("created_at"),
        sa.CheckConstraint("rating IN (-1, 1)", name=op.f("ck_message_feedback_rating_valid")),
        sa.ForeignKeyConstraint(["message_id"], ["chat_messages.id"], name=op.f("fk_message_feedback_message_id_chat_messages"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_message_feedback_user_id_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_message_feedback")),
        sa.UniqueConstraint("message_id", "user_id", name="uq_message_feedback_message_user"),
        **TABLE_OPTS,
    )
    op.create_index(op.f("ix_message_feedback_message_id"), "message_feedback", ["message_id"], unique=False)
    op.create_index(op.f("ix_message_feedback_user_id"), "message_feedback", ["user_id"], unique=False)


def downgrade() -> None:
    # Dropping a table drops its indexes and foreign keys; children first (MySQL refuses to drop indexes
    # that a foreign key still depends on, so we do not drop them one by one).
    for table in ("message_feedback", "chat_messages", "documents", "chat_sessions", "audit_logs", "users"):
        op.drop_table(table)
