# API Reference

Base URL (development): `http://127.0.0.1:8000/api/v1` (the frontend calls it through its `/api` proxy).
Interactive docs: `http://127.0.0.1:8000/docs` (disabled when `ENVIRONMENT=production`).
Authentication: `Authorization: Bearer <JWT>` obtained from `/auth/login` or `/auth/register`.

## Endpoints

"Access" is enforced by the server: `public` needs no token, `signed-in` needs a valid token, `admin` needs an administrator.
`GET /documents*` is available to every signed-in user; changing documents is admin-only. The table is generated from the app's OpenAPI schema.

| Method | Path | Access | Group |
|---|---|---|---|
| POST | `/auth/register` | public | Authentication |
| POST | `/auth/login` | public | Authentication |
| POST | `/auth/token` | public | Authentication |
| POST | `/auth/logout` | signed-in | Authentication |
| GET | `/auth/me` | signed-in | Authentication |
| GET | `/users/me` | signed-in | Profile & Settings |
| PATCH | `/users/me` | signed-in | Profile & Settings |
| POST | `/users/me/change-password` | signed-in | Profile & Settings |
| POST | `/chats` | signed-in | Chats |
| GET | `/chats` | signed-in | Chats |
| GET | `/chats/{chat_id}` | signed-in | Chats |
| PATCH | `/chats/{chat_id}` | signed-in | Chats |
| DELETE | `/chats/{chat_id}` | signed-in | Chats |
| DELETE | `/chats/{chat_id}/messages` | signed-in | Chats |
| POST | `/chats/{chat_id}/messages` | signed-in | Chats |
| POST | `/chats/{chat_id}/messages/{message_id}/retry` | signed-in | Chats |
| PUT | `/messages/{message_id}/feedback` | signed-in | Chats |
| DELETE | `/messages/{message_id}/feedback` | signed-in | Chats |
| GET | `/documents/categories` | signed-in | Knowledge Base |
| GET | `/documents` | signed-in | Knowledge Base |
| POST | `/documents` | admin | Knowledge Base |
| GET | `/documents/{document_id}` | signed-in | Knowledge Base |
| DELETE | `/documents/{document_id}` | admin | Knowledge Base |
| POST | `/documents/{document_id}/retry` | admin | Knowledge Base |
| GET | `/admin/users` | admin | Admin |
| PATCH | `/admin/users/{user_id}` | admin | Admin |
| DELETE | `/admin/users/{user_id}` | admin | Admin |
| GET | `/admin/stats` | admin | Admin |
| GET | `/admin/usage` | admin | Admin |
| GET | `/admin/activity` | admin | Admin |
| GET | `/admin/feedback-summary` | admin | Admin |
| GET | `/api/health` | public | Health |

(`GET /api/health` is the only path outside `/api/v1`.)

## Conventions

- **Errors**: `{"detail": "readable message"}`; validation errors (422) are `{"detail": "Validation failed.", "errors": [{"field", "message"}]}` and never echo submitted values.
- **Status codes used**: 201 created, 202 accepted (document indexing started), 204 no content, 400 bad request, 401 not signed in / token revoked,
  403 forbidden or deactivated, 404 not found (also returned for other users' chats), 409 conflict (duplicate email/file, wrong state),
  413 file too large, 415 not a PDF, 422 validation, 429 rate limited (`Retry-After` header), 502 vector store failure.
- **Pagination**: `page`, `page_size` on `/admin/users` and `/documents`; `limit`, `offset` on `/chats`.

## Asking a question

`POST /chats/{chat_id}/messages` with `{"content": "..."}` (1-2000 characters) returns `201`:

```json
{
  "chat": {"id": "...", "title": "What time does the hostel gate close?", "created_at": "...", "updated_at": "..."},
  "user_message": {"id": "...", "role": "user", "content": "...", "status": "completed", "created_at": "..."},
  "assistant_message": {
    "id": "...", "role": "assistant", "status": "completed",
    "content": "The girls hostel gate closes at **9:30 pm** on weekdays. [S1]",
    "sources": [{"id": "S1", "document_id": "...", "filename": "SAMPLE_Hostel_Facilities.pdf", "category": "Hostel Facilities",
                 "page_start": 1, "page_end": 1, "chunk_index": 2, "similarity": 0.6123, "snippet": "...", "cited": true}],
    "retrieval_meta": {"top_k": 5, "similarity_threshold": 0.3, "model": "llama-3.3-70b-versatile", "candidates": 5, "used": 2, "llm_called": true}
  }
}
```

- `sources` come from the retrieval step (never from the model); `similarity` is the real cosine similarity; `cited` says whether the answer referenced that source.
- If nothing is above the threshold: `status: "completed"`, `sources: null`, `retrieval_meta.llm_called: false`, and the answer says the documents lack the information.
- If embedding/search/LLM fails: HTTP 201 with `assistant_message.status = "failed"`, a readable `content`, and `retrieval_meta.error_code`
  (`rate_limited`, `timeout`, `unavailable`, `auth_error`, `not_configured`, `bad_response`, `embedding_unavailable`, `search_unavailable`).
  The question is saved; retry with `POST /chats/{chat_id}/messages/{message_id}/retry`.

## Document indexing

`POST /documents` (multipart: `file`, `category`) returns `202` with `status: "pending"`. Poll `GET /documents/{id}` until `status` is `indexed` or `failed`
(`error_message` explains why). Valid categories: `GET /documents/categories`.
