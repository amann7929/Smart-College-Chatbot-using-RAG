# ClgBot - Backend (FastAPI + RAG)

> Full project setup (backend + frontend) is in the root `README.md`. This file covers backend details.

Phase 1: FastAPI + MySQL 8 + SQLAlchemy + Alembic + JWT auth (Argon2id).
Phase 2: RAG pipeline (PyMuPDF, chunking, MiniLM embeddings, ChromaDB, Groq) + document management + chat answers.
Phase 3: 15 fictional sample PDFs, a generator, and a seed/replace script (see ../knowledge_base/README.md).

Verified on Linux with MySQL 8.0 and Python 3.12: 133 automated tests + live server smoke tests.
NOT verified in the author's environment: real MiniLM embeddings and live Groq calls (network blocked there),
and the Windows commands (standard tooling, never executed on Windows). See "What was not tested" below.

## 1. Prerequisites (Windows 10/11, PowerShell)

```powershell
winget install --id Python.Python.3.12 -e
winget install --id Oracle.MySQL -e                # MySQL 8 - remember the root password you set during setup
```

Close and reopen PowerShell, then check:

```powershell
python --version
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" --version
```

## 2. Create the database

Use a DB password of letters and digits (special characters must be URL-encoded inside `DATABASE_URL`).
Edit the password in `database\init.sql` (it is `ChangeThisDbPass123` by default), then run it as MySQL root:
```powershell
$mysql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
Get-Content ..\database\init.sql | & $mysql -u root -p
```
(You are asked for the MySQL `root` password once.) This creates the `college_chatbot` and `college_chatbot_test`
databases (utf8mb4) and the `college_user` account. No MySQL installed? Run `docker compose up -d` in the project root
instead (see `docker-compose.yml`; it also starts the Adminer web UI on http://localhost:8080) and skip this step.
More details: `docs/DATABASE.md`.

## 3. Install the backend

```powershell
cd ClgBot\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
# If activation is blocked:  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
python -m pip install --upgrade pip
pip install -r requirements.txt     # downloads PyTorch + sentence-transformers: a few hundred MB, takes several minutes
```

## 4. Configure environment

```powershell
Copy-Item .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(64))"
notepad .env
```

Get a free Groq API key at https://console.groq.com and put it in `GROQ_API_KEY`.
In `.env` set `DATABASE_URL` (user/password from step 2), `SECRET_KEY` (the generated value) and
`FIRST_ADMIN_PASSWORD` (8+ chars with upper, lower, digit). The app refuses to start with a
placeholder or short SECRET_KEY.

(`GROQ_MODEL` defaults to `llama-3.3-70b-versatile`; `llama-3.1-8b-instant` is a faster alternative.)

## 5. Create tables and the first admin

```powershell
alembic upgrade head
python -m app.scripts.create_admin
python -m app.scripts.check_db      # optional: shows MySQL version, charset, time zone and row counts
```

## 6. Run

```powershell
uvicorn app.main:app --reload --port 8000
```

- Health: http://localhost:8000/api/health
- API docs: http://localhost:8000/docs (disabled when ENVIRONMENT=production)

## 6b. First run: embedding model download

The first indexed document (or first question) downloads `all-MiniLM-L6-v2` (~90 MB) from Hugging Face, so internet
access is needed once. To pre-download it:

```powershell
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"
```

## 6c. Try the RAG flow in Swagger (http://localhost:8000/docs)

1. `POST /api/v1/auth/login` as the admin, click **Authorize** (username = email).
2. `POST /api/v1/documents` - pick a PDF and a category. The response is `202` with status `pending`.
3. Poll `GET /api/v1/documents/{id}` until `status` is `indexed` (or `failed` with an `error_message`; fix and `POST .../retry`).
4. `POST /api/v1/chats`, then `POST /api/v1/chats/{chat_id}/messages` with `{"content": "your question"}`.
   The reply contains the answer plus `sources` (document, pages, similarity, snippet) taken from real retrieval results.

## 6d. Load the sample knowledge base (Phase 3)

```powershell
python -m app.scripts.seed_knowledge_base --dry-run
python -m app.scripts.seed_knowledge_base
```

This indexes the 15 fictional sample PDFs from `..\knowledge_base\sample_documents` (needs the embedding model, so the
first run downloads it). To switch to official PDFs see `..\knowledge_base\README.md`
(`--remove-samples`, then `--dir ..\knowledge_base\official`).

## 6e. Tuning retrieval (.env)

- `TOP_K` (default 8): how many relevant chunks are sent to the model. The search checks up to four times this many candidates before filtering.
- `SIMILARITY_THRESHOLD` (default 0.20): minimum cosine similarity (0-1). Chunks below it are discarded; if none remain, the
  bot answers "the uploaded documents do not contain sufficient information" **without calling the LLM**.
  Tune this with your real PDFs: raise it if answers use irrelevant text, lower it if relevant questions get no answer.
- `CHUNK_SIZE` / `CHUNK_OVERLAP` (characters, default 1000 / 150). After changing them, delete and re-upload documents.

## 7. Run the tests (real MySQL)

```powershell
$env:TEST_DATABASE_URL = "mysql+pymysql://college_user:ChangeThisDbPass123@localhost:3306/college_chatbot_test"
python -m pytest
```

The tests drop and recreate all tables in the TEST database only.

## Security summary (Phase 1)

- Argon2id hashing; timing-equalised login; generic "invalid email or password" errors
- Password policy (8-128 chars, upper/lower/digit); validation errors never echo submitted values
- JWT (HS256) with expiry; tokens carry a version so password change or deactivation revokes them
- Public registration creates students only; admins come from `app.scripts.create_admin` or another admin
- Role-based access; chat ownership enforced (404 on other users' data); last-admin and self-lockout guards
- Auth rate limiting (in-memory, single process; use Redis if you run multiple workers)
- Restricted CORS, security headers, generic 500 responses, docs off in production
- Audit log for register, login, failed login, logout, password change, chat deletion, admin actions
- No secrets in code; all configuration from environment variables

## RAG behaviour and safety (Phase 2)

- Only the top-k chunks above the similarity threshold are sent to Groq; entire PDFs are never sent.
- Document text is wrapped in a `<context>` block, delimiter-like tags inside it are neutralised, and the system prompt
  tells the model to treat it as untrusted data, answer only from it, cite `[S#]`, and never reveal configuration.
  (This reduces prompt-injection risk; no prompt-based defence is absolute.)
- Sources shown to users come from the retrieval step (document, pages, real cosine similarity), not from the model.
  `cited` tells you whether the model actually referenced that source.
- A document only counts as searchable once its status is `indexed`; vectors are removed if indexing fails or the document is deleted.
- Groq problems (rate limit, timeout, outage, bad key, missing key) are returned as a failed answer with a readable message and
  can be retried via `POST /api/v1/chats/{chat_id}/messages/{message_id}/retry`. The student's question is always saved.
- Documents left `pending`/`processing` by a server restart are marked `failed` at startup so they can be retried.

## What was not tested

- Real `all-MiniLM-L6-v2` embeddings (tests use a deterministic word-overlap stand-in because huggingface.co was unreachable).
  The `0.30` default threshold is therefore a reasonable starting point, not a tuned value. The test that checks each question
  retrieves the right sample document is a lexical smoke test; it does not measure real semantic retrieval quality.
- Live Groq API calls (tests use the real client code against a scripted fake server).
- Windows execution of the setup commands.

## Known limitations

- No OCR: scanned/image-only PDFs fail with a clear message.
- MiniLM is an English model; questions or documents in Hindi retrieve poorly.
- Answers are returned whole (no token streaming yet).
- Ingestion uses FastAPI background tasks (in-process). A restart interrupts running jobs; use Retry. For heavy use, move to a task queue.
- Upload size is checked from Content-Length and again while streaming; also set a body-size limit on any reverse proxy.

## Troubleshooting

- `password authentication failed`: user/password in DATABASE_URL do not match step 2.
- `SECRET_KEY ... shorter than 32 characters`: regenerate it as in step 4.
- `mysql` not found: use the full path shown, or add `C:\Program Files\MySQL\MySQL Server 8.0\bin` to PATH.
- `Access denied for user`: user/password in DATABASE_URL do not match `database/init.sql`.
- `Unknown database`: run `database/init.sql` first.
- `The embedding model could not be loaded`: no internet on first run, or `sentence-transformers` is not installed.
- Document stuck on `failed`: read `error_message` on the Knowledge Base entry; fix the PDF and use Retry.
- Connection refused on 3306: `Get-Service MySQL*`, then `Start-Service <service name>` (or `docker compose up -d` from the project root).
