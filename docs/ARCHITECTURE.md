# Architecture

## System overview

```mermaid
flowchart LR
  subgraph Browser
    UI[React + Vite SPA]
  end
  subgraph Server
    API[FastAPI]
    BG[Background ingestion]
    PG[(MySQL)]
    CH[(ChromaDB<br/>persistent)]
    EMB[Sentence Transformers<br/>all-MiniLM-L6-v2]
  end
  GROQ[[Groq API]]
  UI -- "JSON / JWT (Axios)" --> API
  API --> PG
  API -- "embed query" --> EMB
  API -- "top-k search" --> CH
  API -- "grounded prompt" --> GROQ
  API -- "202 + status polling" --> BG
  BG --> EMB
  BG --> CH
  BG --> PG
```

MySQL holds relational data (users, chats, messages, document metadata, feedback, audit). ChromaDB holds only vectors plus metadata
(`document_id`, filename, category, pages). `documents.id` in MySQL is the `document_id` stored with every vector, so the two stores stay consistent.

## Ingestion (admin uploads a PDF)

```mermaid
sequenceDiagram
  participant A as Admin UI
  participant S as FastAPI
  participant B as Background task
  participant C as ChromaDB
  A->>S: POST /documents (PDF, category)
  S->>S: validate type, %PDF magic bytes, size; SHA-256 duplicate check
  S->>S: store file under a random name; row status=pending
  S-->>A: 202 Accepted
  S->>B: ingest_document(id)
  B->>B: status=processing; PyMuPDF text per page (NFKC-normalised)
  B->>B: overlapping chunks, each mapped to its page range
  B->>B: MiniLM embeddings (normalised)
  B->>C: add vectors (id = documentId:chunk)
  B->>S: status=indexed, chunk_count (only now)
  A->>S: GET /documents/{id} (polling every 2.5 s)
  Note over B,C: on any error: delete partial vectors, status=failed + readable reason
```

Safety properties: a document is `indexed` only after all vectors are stored; retrieval additionally ignores vectors whose document is not `indexed`;
deleting removes vectors first (if that fails nothing else is deleted); on restart, `pending`/`processing` rows become `failed` so they can be retried.

## Answering a question

```mermaid
sequenceDiagram
  participant U as Student UI
  participant S as FastAPI
  participant C as ChromaDB
  participant G as Groq
  U->>S: POST /chats/{id}/messages
  S->>S: ownership check, rate limit, save question
  S->>S: embed question
  S->>C: query top_k
  S->>S: keep hits >= SIMILARITY_THRESHOLD and from indexed documents
  alt no relevant chunk
    S-->>U: "documents do not contain sufficient information" (no LLM call)
  else relevant chunks
    S->>G: system rules + history + <context> passages + question
    G-->>S: answer with [S#] markers
    S-->>U: answer + sources from retrieval + retrieval_meta
  end
  S->>S: save assistant message (sources, meta) in MySQL
```

Prompt-injection stance: passages are wrapped in a `<context>` block; tag-like text inside them is escaped so a document cannot close the block or fake a role;
the system prompt says the context is untrusted data, forbids following instructions inside it, forbids revealing configuration, and requires citations and
the exact "insufficient information" reply. This reduces risk but no prompt-based defence is absolute.

## Data model

```mermaid
erDiagram
  USERS ||--o{ CHAT_SESSIONS : owns
  CHAT_SESSIONS ||--o{ CHAT_MESSAGES : contains
  CHAT_MESSAGES ||--o{ MESSAGE_FEEDBACK : rated_by
  USERS ||--o{ MESSAGE_FEEDBACK : gives
  USERS ||--o{ DOCUMENTS : uploads
  USERS ||--o{ AUDIT_LOGS : performs
  USERS { uuid id PK
    string email UK
    string role "student|admin"
    bool is_active
    int token_version
    string theme_preference
    json chat_preferences }
  CHAT_SESSIONS { uuid id PK
    uuid user_id FK
    string title
    datetime updated_at }
  CHAT_MESSAGES { uuid id PK
    uuid session_id FK
    string role "user|assistant"
    text content
    string status "completed|failed"
    json sources
    json retrieval_meta }
  DOCUMENTS { uuid id PK
    string original_filename
    string category
    string file_hash UK "SHA-256"
    string status "pending|processing|indexed|failed"
    text error_message
    int chunk_count
    uuid uploaded_by FK }
  MESSAGE_FEEDBACK { uuid id PK
    uuid message_id FK
    uuid user_id FK
    int rating "1|-1" }
  AUDIT_LOGS { uuid id PK
    uuid user_id FK
    string action
    json details
    string ip_address }
```

## Frontend structure

- `src/api` - one Axios instance (token header, 401 -> automatic sign-out) and endpoint modules; `errorMessage()` turns any failure into friendly text.
- `src/context` - Auth (session restore, login, logout, password change), Theme (class-based dark mode, synced to the account), Toast, Confirm (promise-based dialog), Chat (history, search, rename/delete).
- `src/pages` - Landing, Login, Register, Chat, KnowledgeBase, Admin (lazy-loaded with Recharts), Settings, NotFound.
- `src/components` - UI primitives (Button, Modal with focus trap, Form fields, badges, skeletons, empty/error states), chat widgets, layout (sidebar, route guards).
- Accessibility: labelled controls, `aria-live` regions for toasts and results, keyboard-operable dialogs and menus, visible focus rings, reduced-motion support, skip link.

## Key design decisions

| Decision | Reason |
|---|---|
| Similarity threshold + "no LLM call" when nothing matches | The cheapest and safest way to stop hallucinated college facts |
| Sources taken from retrieval, not from the model | The user can trust the citation list even if the model misbehaves |
| Failed answers stored as messages with `status=failed` | The UI can offer Retry; the question is never lost |
| Token version in the JWT | Password change / deactivation revoke sessions without a token blacklist |
| `ChromaDB` embeddings supplied explicitly | No hidden model downloads; one embedding model for documents and queries |
| Background task instead of a queue | Simple for a single-server project; restart recovery marks interrupted jobs failed |
