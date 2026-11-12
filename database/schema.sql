-- ClgBot MySQL schema - GENERATED from backend/alembic/versions by: alembic upgrade head --sql
-- Reference / manual import only. Normal setup uses: alembic upgrade head

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 0001

CREATE TABLE users (
    id CHAR(32) NOT NULL, 
    email VARCHAR(255) NOT NULL, 
    full_name VARCHAR(120) NOT NULL, 
    password_hash VARCHAR(255) NOT NULL, 
    `role` VARCHAR(20) NOT NULL DEFAULT 'student', 
    is_active BOOL NOT NULL DEFAULT true, 
    token_version INTEGER NOT NULL DEFAULT '0', 
    theme_preference VARCHAR(10) NOT NULL DEFAULT 'light', 
    chat_preferences JSON NOT NULL, 
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), 
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), 
    last_login_at DATETIME(6), 
    CONSTRAINT pk_users PRIMARY KEY (id), 
    CONSTRAINT ck_users_role_valid CHECK (role IN ('student','admin'))
)CHARSET=utf8mb4 ENGINE=InnoDB COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE TABLE audit_logs (
    id CHAR(32) NOT NULL, 
    user_id CHAR(32), 
    action VARCHAR(80) NOT NULL, 
    entity_type VARCHAR(50), 
    entity_id VARCHAR(64), 
    details JSON, 
    ip_address VARCHAR(64), 
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), 
    CONSTRAINT pk_audit_logs PRIMARY KEY (id), 
    CONSTRAINT fk_audit_logs_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
)CHARSET=utf8mb4 ENGINE=InnoDB COLLATE utf8mb4_unicode_ci;

CREATE INDEX ix_audit_logs_action ON audit_logs (action);

CREATE INDEX ix_audit_logs_created_at ON audit_logs (created_at);

CREATE INDEX ix_audit_logs_user_id ON audit_logs (user_id);

CREATE TABLE chat_sessions (
    id CHAR(32) NOT NULL, 
    user_id CHAR(32) NOT NULL, 
    title VARCHAR(200) NOT NULL DEFAULT 'New chat', 
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), 
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), 
    CONSTRAINT pk_chat_sessions PRIMARY KEY (id), 
    CONSTRAINT fk_chat_sessions_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)CHARSET=utf8mb4 ENGINE=InnoDB COLLATE utf8mb4_unicode_ci;

CREATE INDEX ix_chat_sessions_user_id ON chat_sessions (user_id);

CREATE INDEX ix_chat_sessions_user_updated ON chat_sessions (user_id, updated_at);

CREATE TABLE documents (
    id CHAR(32) NOT NULL, 
    original_filename VARCHAR(255) NOT NULL, 
    stored_filename VARCHAR(255) NOT NULL, 
    category VARCHAR(80) NOT NULL, 
    file_hash VARCHAR(64) NOT NULL, 
    file_size BIGINT NOT NULL, 
    status VARCHAR(20) NOT NULL DEFAULT 'pending', 
    error_message TEXT, 
    page_count INTEGER NOT NULL DEFAULT '0', 
    chunk_count INTEGER NOT NULL DEFAULT '0', 
    uploaded_by CHAR(32), 
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), 
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), 
    indexed_at DATETIME(6), 
    CONSTRAINT pk_documents PRIMARY KEY (id), 
    CONSTRAINT ck_documents_status_valid CHECK (status IN ('pending','processing','indexed','failed')), 
    CONSTRAINT fk_documents_uploaded_by_users FOREIGN KEY(uploaded_by) REFERENCES users (id) ON DELETE SET NULL, 
    CONSTRAINT uq_documents_stored_filename UNIQUE (stored_filename)
)CHARSET=utf8mb4 ENGINE=InnoDB COLLATE utf8mb4_unicode_ci;

CREATE INDEX ix_documents_category ON documents (category);

CREATE UNIQUE INDEX ix_documents_file_hash ON documents (file_hash);

CREATE INDEX ix_documents_status ON documents (status);

CREATE TABLE chat_messages (
    id CHAR(32) NOT NULL, 
    session_id CHAR(32) NOT NULL, 
    `role` VARCHAR(20) NOT NULL, 
    content MEDIUMTEXT NOT NULL, 
    status VARCHAR(20) NOT NULL DEFAULT 'completed', 
    sources JSON, 
    retrieval_meta JSON, 
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), 
    CONSTRAINT pk_chat_messages PRIMARY KEY (id), 
    CONSTRAINT ck_chat_messages_role_valid CHECK (role IN ('user','assistant')), 
    CONSTRAINT ck_chat_messages_status_valid CHECK (status IN ('completed','failed')), 
    CONSTRAINT fk_chat_messages_session_id_chat_sessions FOREIGN KEY(session_id) REFERENCES chat_sessions (id) ON DELETE CASCADE
)CHARSET=utf8mb4 ENGINE=InnoDB COLLATE utf8mb4_unicode_ci;

CREATE INDEX ix_chat_messages_session_created ON chat_messages (session_id, created_at);

CREATE INDEX ix_chat_messages_session_id ON chat_messages (session_id);

CREATE TABLE message_feedback (
    id CHAR(32) NOT NULL, 
    message_id CHAR(32) NOT NULL, 
    user_id CHAR(32) NOT NULL, 
    rating SMALLINT NOT NULL, 
    comment VARCHAR(500), 
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), 
    CONSTRAINT pk_message_feedback PRIMARY KEY (id), 
    CONSTRAINT ck_message_feedback_rating_valid CHECK (rating IN (-1, 1)), 
    CONSTRAINT fk_message_feedback_message_id_chat_messages FOREIGN KEY(message_id) REFERENCES chat_messages (id) ON DELETE CASCADE, 
    CONSTRAINT fk_message_feedback_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_message_feedback_message_user UNIQUE (message_id, user_id)
)CHARSET=utf8mb4 ENGINE=InnoDB COLLATE utf8mb4_unicode_ci;

CREATE INDEX ix_message_feedback_message_id ON message_feedback (message_id);

CREATE INDEX ix_message_feedback_user_id ON message_feedback (user_id);

INSERT INTO alembic_version (version_num) VALUES ('0001');

