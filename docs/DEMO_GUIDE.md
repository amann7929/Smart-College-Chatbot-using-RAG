# Demo Guide (about 10 minutes)

## Before you start
1. Backend and frontend running (see README), sample documents indexed (`seed_knowledge_base`), `GROQ_API_KEY` set.
2. Two browser windows: one for the admin, one for a student (or one normal and one private window).
3. Warm up once: ask any question so the embedding model is loaded.

## Script
1. **Landing page (1 min)** - explain the problem (students need accurate college info), click the preview questions, point out the fictional-data label and the honest "not in documents" example.
2. **Student registers (1 min)** - show validation and the password checklist; land in the chat.
3. **Ask real questions (3 min)** - "What time does the girls hostel gate close?", "What is the tuition fee and the late fine?", "How many books can I borrow?".
   Open *Sources*: document, page, similarity, snippet. Say what similarity means (cosine, 0-1) and that sources come from retrieval, not from the model.
4. **Show it does not guess (1 min)** - "Who won the cricket world cup?" -> "documents do not contain sufficient information... no AI model was used".
5. **Feedback, copy, rename, clear/delete, dark mode (1 min).**
6. **Admin: knowledge base (2 min)** - upload a small PDF, watch Queued -> Processing -> Indexed, ask a question about it as the student, then delete it and show the answer disappears.
7. **Admin dashboard (1 min)** - usage chart, document status, feedback rate, activity log, user management (deactivate a user: their session ends immediately).
8. **Security/engineering (1 min)** - Argon2, JWT revocation, ownership checks, rate limits, audit log; 117 backend + 66 frontend tests.

## Questions you may be asked
- **What is RAG and why not just fine-tune or prompt an LLM?** The LLM does not know your college's current fees/dates; RAG retrieves the real text at question time, can cite it, and is updated by uploading a PDF - no retraining.
- **Why chunk with overlap?** To avoid cutting an answer in half at a chunk boundary; overlap keeps context across the cut. Size/overlap are configurable.
- **Why a similarity threshold and top-k?** Top-k bounds prompt size/cost; the threshold decides "relevant enough"; below it we refuse instead of guessing.
- **How do you stop hallucination?** Grounded prompt + cite rule + exact refusal sentence + no LLM call when nothing relevant is found + low temperature. It reduces, not eliminates, risk - hence visible sources.
- **What about prompt injection in PDFs?** Document text is data inside delimiters, delimiters inside it are escaped, rules say never to follow instructions in the context; limits are stated in the docs.
- **Why two databases?** MySQL for relational/transactional data; ChromaDB for nearest-neighbour search over embeddings. IDs are shared (`documents.id`).
- **Which embedding model and why?** `all-MiniLM-L6-v2`: small (~90 MB), fast on CPU, 384 dims, free. Limitation: English-centric.
- **What are the limitations?** No streaming, no OCR, English-centric embeddings, in-process indexing, in-memory rate limiter (see README).
- **How would you improve it?** Streaming (SSE), reranking, hybrid BM25 + vectors, OCR, multilingual embeddings, task queue, Redis rate limiting, per-department document access.
