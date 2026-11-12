# Testing Report

Everything below was actually executed in the build environment (Linux, Python 3.12, Node 22, MySQL 8.0, headless Chromium).
Section 4 lists what could **not** be tested there.

## 1. Backend - 133 automated tests (`cd backend; python -m pytest`)

Run against a **real MySQL 8** database (schema created by running the Alembic migrations, including downgrade/upgrade) and a **real ChromaDB**.

| File | Tests | What it covers |
|---|---|---|
| `test_auth.py` | 15 | registration, no self-assigned admin, Argon2 hashes, weak passwords (not echoed), duplicate emails, login, timing-safe generic errors, failed-login audit, protected routes, form login, logout, rate limit (429), security headers, CORS allow-list |
| `test_users.py` | 4 | profile update, preference merge, invalid fields, password change revokes old tokens |
| `test_chats.py` | 10 | create/rename/delete/clear, ownership isolation (404), search incl. `%`/`_` escaping, cascade deletes, feedback upsert/ownership |
| `test_admin.py` | 9 | role protection, user list/search, role change, no self-lockout, last-admin guard, deactivation revokes tokens, delete cascades, stats/usage/feedback endpoints |
| `test_migrations.py` | 1 | tables, indexes, foreign keys, unique file hash |
| `test_rag_units.py` | 13 | chunk size/overlap/offsets/page mapping, edge cases, PDF extraction (blank, corrupt, encrypted, too many pages), prompt delimiter neutralisation, ligature folding, model warm-up never crashes startup |
| `test_mysql.py` | 16 | MySQL specifics: utf8mb4/UTC/READ COMMITTED session, InnoDB tables, `DATETIME(6)`, UTC round-trip, exact message order within one second, Hindi + emoji, MEDIUMTEXT (200 KB), JSON, CHECK + unique (case-insensitive) constraints, cascade deletes, LIKE-wildcard escaping, admin usage stats, `DATABASE_URL` validation |
| `test_documents.py` | 13 | admin-only upload, validation (type, magic bytes, size, empty, category), path-traversal file names, duplicate detection, failure cleanup, retry, unexpected errors hide internals, delete removes row/file/vectors, list/search/filter, restart recovery, MySQL <-> ChromaDB id consistency |
| `test_rag_chat.py` | 24 | grounded answers with real sources, persistence, citation flag, threshold and top-k configurable, "no relevant chunk -> no LLM call", empty KB, deleted/unfinished documents never used, history for follow-ups, prompt-injection containment, Groq 429/5xx/timeout/401/missing key/malformed replies, retry flow, embedding failure, ownership, rate limit |
| `test_knowledge_base.py` | 28 | sample PDFs (15 categories, banner on every page, no real-looking contact data, cross-document consistency), seeding, idempotency, dry-run, removal of samples only, official-folder validation, CLI exit codes, retrieval smoke test for 15 questions, chat over the seeded knowledge base |

**Mutation checks** (deliberately breaking the code to prove the tests can fail): disabling prompt-delimiter neutralisation, removing the "indexed documents only" filter,
ignoring the similarity threshold, and echoing the API key in an error message each made the matching tests fail; restoring the code made them pass.

## 2. Frontend - 66 automated tests (`cd frontend; npm test`)

Vitest + Testing Library; the API module is mocked so UI behaviour is verified in isolation.

| File | Tests | What it covers |
|---|---|---|
| `lib.test.js` | 6 | formatting helpers, validation rules (mirror the backend), API error mapping |
| `Auth.test.jsx` | 12 | login/register validation and success/error paths, route guards (anonymous, student vs admin, signed-in users bounced from login, invalid stored token) |
| `Chat.test.jsx` | 18 | welcome + suggestions, send (button/Enter/Shift+Enter), markdown + citations + sources + timestamps, copy, feedback (set/switch/remove/revert), failed answer + retry, "no passage matched" note, failed send + resend, source preference, load error + retry, clear/rename/delete with confirmation, modal focus regression, auto-scroll behaviour |
| `KnowledgeBase.test.jsx` | 10 | listing, student vs admin controls, error display + retry, confirm-before-delete, processing state, polling start/stop, filters, upload validation + success + duplicate error |
| `SettingsTheme.test.jsx` | 12 | profile save, read-only email, preference switches, password validation/success/wrong current, sign-out, theme apply/persist/sync, landing page and interactive preview |
| `Admin.test.jsx` | 8 | stats, document status, feedback, activity, period change, empty and error states, self-protection, confirmed role change/deactivate/delete, server refusal shown, search/filter |

## 3. Real-browser end-to-end - 18 steps, run twice, 18/18 both times

Headless Chromium drove the **built** frontend against the **real backend** (real MySQL, real ChromaDB, 15 sample documents indexed).
Steps: landing page and preview, register through the UI, suggested question with cited answer and expanded sources, out-of-scope question ("no AI model was used"),
feedback, history search, dark theme saved to the account, knowledge base as student (no admin actions), settings, student blocked from admin, sign-out, admin sign-in with
saved theme restored, admin dashboard (stats, Recharts chart, documents, feedback, activity, users), **upload a PDF -> watch it become Indexed -> ask about it in chat -> delete it**,
and a 390x844 mobile layout check (drawer sidebar, greeting visible, no horizontal overflow). Browser console and network logs were checked: no errors or failed requests.
The screenshots in `docs/screenshots` come from this run.

## 4. What was NOT tested

- **Real `all-MiniLM-L6-v2` embeddings** - the model host was unreachable, so tests/E2E use a deterministic word-overlap stand-in. The default `SIMILARITY_THRESHOLD=0.30`
  is therefore a sensible starting point, **not a tuned value**; retrieval-quality conclusions cannot be drawn from these tests.
- **Live Groq calls** - the real client code (request building, retries, error mapping) is exercised against a scripted fake server; the actual service was not contacted.
  The answer text in screenshots comes from that stand-in.
- **Windows** - all commands in the README are standard, but nothing was executed on Windows.
- **Other browsers/devices** - only headless Chromium (desktop and a 390 px mobile viewport).
- **Load, security penetration and accessibility audits** - not performed. Accessibility features exist (labels, roles, focus handling, keyboard use) but were not audited with a screen reader or automated checker.
- **Streaming responses, OCR, multilingual retrieval** - not implemented.

## 5. Problems found by testing (and fixed)

| Found by | Problem | Fix |
|---|---|---|
| Sample-PDF review | PDF text contained ligature characters ("fi" as one glyph) that break keyword matching | NFKC normalisation in the extractor + test |
| Consistency test | Fee document listed a library deposit that the Library document never mentioned | Library document updated |
| Frontend test | Dialogs re-ran their focus logic on every parent render, stealing focus while typing (rename dialog lost characters) | `onClose` kept in a ref; regression test (verified to fail without the fix) |
| Mobile screenshot | Welcome screen auto-scrolled to the bottom, hiding the greeting on phones | Auto-scroll only when messages exist; test added |
| Desktop screenshot | Toast notifications covered the send button / upload button | Toasts moved to top-centre |
| Review | Vite proxy to `localhost` can resolve to IPv6 and fail on some Windows/Node setups | Default proxy target `127.0.0.1` |
| Earlier phases | Admin stats lacked pending/processing counts needed by the dashboard; first question was slow while the model loaded | Added counts; model pre-loads in the background at startup |
