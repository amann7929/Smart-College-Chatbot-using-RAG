"""FastAPI application entry point."""
import logging
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.routes import admin, auth, chats, documents, users
from app.core.config import get_settings
from app.db.session import engine
from app.db.session import SessionLocal
from app.rag.embeddings import warm_up
from app.services.ingestion import recover_interrupted_documents
from app.services.knowledge_base import seed_directory

logger = logging.getLogger("college_chatbot")
settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.chroma_dir).mkdir(parents=True, exist_ok=True)
    recovered = recover_interrupted_documents()
    if recovered:
        logger.warning("Marked %d interrupted document(s) as failed", recovered)
    official_dir = Path(__file__).resolve().parents[2] / "knowledge_base" / "official"
    if official_dir.is_dir() and any(official_dir.rglob("*.pdf")):
        try:
            with SessionLocal() as db:
                report = seed_directory(db, official_dir, uploader_email=settings.first_admin_email)
            logger.info("Official knowledge base ready: imported=%d skipped=%d failed=%d",
                        report.count("imported"), report.count("skipped"), report.count("failed"))
        except Exception:
            # Keep the API available if the database, PDF, or embedding service is temporarily unavailable.
            logger.exception("Could not load PDFs from %s", official_dir)
    if settings.preload_embedding_model:
        threading.Thread(target=warm_up, name="embedding-warmup", daemon=True).start()
    yield


app = FastAPI(
    lifespan=lifespan,
    title=settings.app_name,
    version="0.1.0",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,  # bearer tokens, no cookies
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def reject_oversized_uploads(request: Request, call_next):
    """Cheap early rejection using Content-Length. (Streaming limit is enforced again in the route.)"""
    if request.method == "POST" and request.url.path == "/api/v1/documents":
        try:
            length = int(request.headers.get("content-length", "0"))
        except ValueError:
            length = 0
        if length > (settings.max_upload_mb + 1) * 1024 * 1024:
            return JSONResponse(status_code=413, content={"detail": f"File is too large. The limit is {settings.max_upload_mb} MB."})
    return await call_next(request)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Cache-Control", "no-store")
    if settings.is_production:
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    """Return readable errors WITHOUT echoing submitted values (which may contain passwords)."""
    errors = []
    for err in exc.errors():
        msg = str(err.get("msg", "Invalid value"))
        if msg.startswith("Value error, "):
            msg = msg[len("Value error, "):]
        errors.append({"field": ".".join(str(p) for p in err.get("loc", []) if p != "body"), "message": msg})
    return JSONResponse(status_code=422, content={"detail": "Validation failed.", "errors": errors})


@app.exception_handler(Exception)
async def unhandled_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(chats.router, prefix=API_PREFIX)
app.include_router(chats.messages_router, prefix=API_PREFIX)
app.include_router(documents.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)


@app.get("/api/health", tags=["Health"])
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "up"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "degraded", "database": "down"})
