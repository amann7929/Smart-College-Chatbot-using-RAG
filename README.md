# ClgBot - College Chatbot using Retrieval-Augmented Generation (RAG)

A complete, working college information chatbot for a B.Tech CSE-AI SSP project. Students ask questions in plain language;
the system retrieves the matching passages from **official college PDFs** (ChromaDB + Sentence Transformers), asks an LLM
(Groq) to answer **only from those passages**, and shows the **document, page and passage** behind every answer.
If the documents do not contain the answer, it says so instead of guessing.

![Landing page](docs/screenshots/01-landing-light.png)

| Chat with sources | Dark mode |
|---|---|
| ![Chat](docs/screenshots/05-chat-answer-sources.png) | ![Dark](docs/screenshots/07-chat-dark.png) |

| Admin dashboard | Knowledge base | Mobile |
|---|---|---|
| ![Admin](docs/screenshots/10-admin.png) | ![KB](docs/screenshots/13-kb-uploaded-indexed.png) | ![Mobile](docs/screenshots/16-mobile-chat.png) |

> Screenshots are real captures of the running app. The answer text in them was produced by a stand-in LLM used for testing
> (no internet in the build environment); with your Groq key the answers come from the real model.

## Contents
1. [Features](#features)  2. [Tech stack](#tech-stack)  3. [Project structure](#project-structure)
4. [Setup on Windows](#setup-on-windows-powershell)  5. [Using the app](#using-the-app)  6. [Replacing the sample documents](#replacing-the-sample-documents-with-official-pdfs)
7. [Tests](#running-the-tests)  8. [Configuration](#configuration)  9. [Security](#security)  10. [Troubleshooting](#troubleshooting)
11. [Known limitations](#known-limitations)  12. [Further reading](#further-reading)

## Features

**Students**
- Register / sign in (JWT), protected routes, profile and password change, light/dark theme saved to the account
- Chat with Markdown answers, copy button, timestamps, suggested questions, thumbs up/down feedback
- **Source citations under every answer** (document, page, real cosine similarity, passage; "cited in answer" marker)
- Chat history: new, rename, delete, clear (with confirmation), searchable (titles and message text)
- Retry a failed answer without retyping; clear messages for rate limits, timeouts and outages
- Honest "not in the documents" replies - and no LLM call at all when nothing relevant is found

**Administrators**
- Upload PDFs with category, validation (type, magic bytes, size), duplicate detection, background indexing with live status, retry, delete (vectors removed too)
- Dashboard: users, documents, indexed chunks, questions, daily usage chart, document-processing status, feedback overview, recent activity
- User management: change role, deactivate/reactivate (revokes sessions at once), delete; cannot lock themselves out or remove the last admin

**RAG pipeline** (all real, no mock logic in the app): PyMuPDF extraction -> overlapping chunks with page tracking -> `all-MiniLM-L6-v2` embeddings
-> persistent ChromaDB -> top-k + similarity threshold -> grounded prompt (document text treated as untrusted data) -> Groq -> answer + sources.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, JavaScript, Tailwind CSS, Framer Motion, Lucide icons, Recharts, Axios, React Router |
| Backend | Python 3.12, FastAPI, Uvicorn, SQLAlchemy 2, Alembic, Pydantic 2, PyJWT, Argon2 |
| RAG / AI | PyMuPDF, Sentence Transformers (`all-MiniLM-L6-v2`), ChromaDB (persistent), Groq API (`llama-3.3-70b-versatile` by default) |
| Database | MySQL 8 (users, chats, messages, documents, feedback, audit log) + ChromaDB (vectors) |

## Project structure

```
ClgBot/
  README.md                  <- you are here
  database/                  init.sql (create DB + user), schema.sql (reference DDL)
  docker-compose.yml         optional MySQL 8 + Adminer in Docker
  docs/                      ARCHITECTURE.md, API.md, DATABASE.md, TESTING.md, DEMO_GUIDE.md, screenshots/
  backend/
    app/
      main.py                FastAPI app, CORS, security headers, startup recovery + model warm-up
      core/                  config (env), security (Argon2, JWT), rate limiter
      models/  schemas/      SQLAlchemy models, Pydantic schemas
      api/routes/            auth, users, chats (+messages, feedback), documents, admin
      rag/                   pdf, chunking, embeddings, vectorstore (ChromaDB), prompts, llm (Groq), pipeline
      services/              ingestion (background indexing), chat flow, knowledge_base (bulk import), audit
      scripts/               create_admin, seed_knowledge_base, generate_sample_pdfs, sample_content
    alembic/                 database migrations
    tests/                   133 automated tests (real MySQL + ChromaDB)
    .env.example  requirements.txt
  frontend/
    src/                     pages, components, contexts, api client, 66 unit/integration tests
    package.json  vite.config.js  tailwind.config.js
  knowledge_base/
    sample_documents/        15 FICTIONAL demo PDFs (one per category), each page stamped "SAMPLE DATA"
    official/                empty category folders for your real PDFs
```

## Setup on Windows (PowerShell)

> The commands use standard tooling, but the project was built and tested on Linux; Windows steps have not been executed by the author.
> If anything fails, see [Troubleshooting](#troubleshooting).

### 0. Install prerequisites (once)

```powershell
winget install --id Python.Python.3.12 -e
winget install --id OpenJS.NodeJS.LTS -e          # Node 20 or 22 LTS
winget install --id Oracle.MySQL -e                # MySQL 8 - remember the root password you set during setup
```
Close and reopen PowerShell, then verify: `python --version` (3.12.x), `node --version`, `npm --version`.
Get a **free Groq API key** at https://console.groq.com (needed for answers; everything else works without it).

### 1. Unzip and open the folder

```powershell
Expand-Archive .\ClgBot.zip -DestinationPath .
cd .\ClgBot
```

### 2. Create the database

Use a DB password of letters and digits (special characters must be URL-encoded inside `DATABASE_URL`).
Edit the password in `database\init.sql` (it is `ChangeThisDbPass123` by default), then run it as MySQL root:
```powershell
$mysql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
Get-Content .\database\init.sql | & $mysql -u root -p
```
(You are asked for the MySQL `root` password once.) This creates the `college_chatbot` and `college_chatbot_test`
databases (utf8mb4) and the `college_user` account. No MySQL installed? Run `docker compose up -d` in the project root
instead (see `docker-compose.yml`; it also starts the Adminer web UI on http://localhost:8080) and skip this step.
More details: `docs/DATABASE.md`.

### 3. Backend

```powershell
cd .\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1           # if blocked: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
python -m pip install --upgrade pip
pip install -r requirements.txt        # includes PyTorch + sentence-transformers: several hundred MB, a few minutes

Copy-Item .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(64))"    # copy the output
notepad .env
```
In `.env` set: `DATABASE_URL` (user/password from step 2), `SECRET_KEY` (the generated value), `GROQ_API_KEY`,
and `FIRST_ADMIN_EMAIL` / `FIRST_ADMIN_PASSWORD` (8+ characters with upper, lower and a digit). The app refuses to start with a weak `SECRET_KEY`.

```powershell
alembic upgrade head                   # create the tables
python -m app.scripts.create_admin     # create the first administrator from .env
python -m app.scripts.seed_knowledge_base      # index the 15 sample PDFs (first run downloads the ~90 MB embedding model)
uvicorn app.main:app --port 8000
```
Leave this window open. Check http://127.0.0.1:8000/api/health -> `{"status":"ok","database":"up"}`. API docs: http://127.0.0.1:8000/docs.

### 4. Frontend (a second PowerShell window)

```powershell
cd <path-to>\ClgBot\frontend
npm install
npm run dev
```
Open **http://localhost:5173**. The dev server proxies `/api` to the backend on port 8000.

### 5. Production-style run (optional)

```powershell
npm run build                          # creates frontend\dist
npm run preview                        # serves dist on http://localhost:4173 with the same /api proxy
```
For real deployment serve `dist` from any web server/reverse proxy, forward `/api` to Uvicorn, use HTTPS, set `ENVIRONMENT=production`
and `CORS_ORIGINS` in the backend `.env`, and never expose the database or ChromaDB folder.

## Using the app

1. Sign in at `/login` with the admin account from `.env`, or register a student at `/register`.
2. **Chat**: click a suggested question or type your own. Open *Sources* under an answer to see the passages used.
3. **Knowledge Base** (everyone can browse; admins can upload): *Upload document*, choose a PDF and category. Status changes
   Queued -> Processing -> Indexed (or Failed with the reason; admins can *Retry*).
4. **Admin Dashboard** (admins only): usage, documents, feedback, activity and user management.
5. **Settings**: name, theme, chat preferences (show sources, compact, auto-scroll), password.

## Replacing the sample documents with official PDFs

The 15 demo PDFs describe a **fictional** college and are stamped *SAMPLE DATA*. To use real documents:
```powershell
cd backend
python -m app.scripts.seed_knowledge_base --remove-samples                    # delete demo documents (rows, files, vectors)
# copy your PDFs into ..\knowledge_base\official\<Category name>\  (folders already exist), then:
python -m app.scripts.seed_knowledge_base --dir ..\knowledge_base\official
```
Or upload through the admin Knowledge Base page. Use text-based PDFs (scanned images are not supported). After loading real documents,
try 10-20 real questions and tune `SIMILARITY_THRESHOLD` / `TOP_K` in `.env`. Details: [knowledge_base/README.md](knowledge_base/README.md).

## Running the tests

```powershell
# Backend (needs the college_chatbot_test database from step 2)
cd backend
.\.venv\Scripts\Activate.ps1
$env:TEST_DATABASE_URL = "mysql+pymysql://college_user:ChangeThisDbPass123@localhost:3306/college_chatbot_test"
python -m pytest                       # 133 tests; ~1 minute

# Frontend
cd ..\frontend
npm test                               # 66 tests
```
See [docs/TESTING.md](docs/TESTING.md) for exactly what is covered and what is not.

## Configuration

All backend settings live in `backend/.env` (see `.env.example`): database URL, `SECRET_KEY`, token lifetime, rate limits,
`TOP_K`, `SIMILARITY_THRESHOLD`, `CHUNK_SIZE`, `CHUNK_OVERLAP`, `MAX_UPLOAD_MB`, `GROQ_API_KEY`, `GROQ_MODEL`, `PRELOAD_EMBEDDING_MODEL`, CORS origins.
The frontend needs no configuration for local use (`frontend/.env.example` lists optional overrides).

## Security

Argon2id password hashing; JWT with expiry and server-side revocation (password change / deactivation); role-based access with ownership checks
(other users' chats return 404); rate limiting on sign-in and chat; strict CORS; security headers; upload validation and sanitised file names;
validation errors never echo passwords; audit log; secrets only in environment variables; document text is treated as untrusted data in the prompt and
delimiter-like tags inside it are neutralised. The sign-in token is kept in `localStorage` (simple, but readable by any script running on the page - serve over HTTPS with a strict
Content-Security-Policy in production).

## Troubleshooting

| Problem | Fix |
|---|---|
| `password authentication failed` | User/password in `DATABASE_URL` differ from step 2 |
| App exits: "SECRET_KEY ... shorter than 32 characters" | Generate one as shown in step 3 |
| `Activate.ps1 cannot be loaded` | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Frontend shows "Cannot reach the server" | Backend not running on port 8000, or started with another host/port |
| Answers say "AI service is not configured" | `GROQ_API_KEY` missing in `backend\.env` (restart the backend) |
| "The embedding model could not be loaded" | No internet on first run (model download), or `sentence-transformers` not installed |
| Document stays *Failed* | Read the error under it (scanned PDF, password-protected, corrupt); fix and press Retry |
| Everything is answered with "documents do not contain sufficient information" | Raise/lower `SIMILARITY_THRESHOLD`; check documents are *Indexed*; check the question matches document wording |
| `mysql` not found | Use the full path shown in step 2 or add `C:\Program Files\MySQL\MySQL Server 8.0\bin` to PATH |
| Port 3306 refused | `Get-Service MySQL*` then `Start-Service <name>` (or `docker compose up -d`) |
| `Access denied for user 'college_user'` | Password in `DATABASE_URL` differs from the one in `database\init.sql` |
| `Unknown database 'college_chatbot'` | Run `database\init.sql` (step 2) |
| Table doesn't exist | `alembic upgrade head`; check everything with `python -m app.scripts.check_db` |
| `cryptography package is required` | `pip install -r requirements.txt` again (MySQL 8 login needs it) |

## Known limitations

- No token streaming: the answer appears all at once after a loading indicator.
- No OCR: scanned/image-only PDFs fail with a clear message. Tables in PDFs may extract in confusing order.
- `all-MiniLM-L6-v2` is an English model; Hindi questions/documents retrieve poorly.
- Indexing runs as an in-process background task; a server restart interrupts it (such documents are marked Failed and can be retried).
- The rate limiter is in-memory (single server process).
- Real MiniLM retrieval quality and live Groq calls were not testable in the build environment - tune the threshold with your documents.

## Further reading

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - design and data flow | [docs/API.md](docs/API.md) - endpoint reference |
[docs/DATABASE.md](docs/DATABASE.md) - MySQL schema and notes | [docs/TESTING.md](docs/TESTING.md) - test report | [docs/DEMO_GUIDE.md](docs/DEMO_GUIDE.md) - demo script and viva questions
#   S m a r t - C o l l e g e - C h a t b o t - u s i n g - R A G  
 