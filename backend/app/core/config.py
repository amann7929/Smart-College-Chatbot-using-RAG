"""Application settings loaded from environment variables / .env file."""
from functools import lru_cache

from pydantic import field_validator, model_validator
from sqlalchemy.engine import make_url
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_KEYS = {"", "CHANGE_ME_TO_A_LONG_RANDOM_STRING", "secret", "changeme"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "College Chatbot API"
    environment: str = "development"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    database_url: str
    secret_key: str
    access_token_expire_minutes: int = 60
    jwt_algorithm: str = "HS256"

    auth_rate_limit: int = 10
    auth_rate_window_seconds: int = 60

    # ---- RAG ----
    upload_dir: str = "storage/uploads"
    chroma_dir: str = "storage/chroma"
    max_upload_mb: int = 20
    max_pdf_pages: int = 500
    chunk_size: int = 1000          # characters
    chunk_overlap: int = 150        # characters
    top_k: int = 8
    similarity_threshold: float = 0.20   # cosine similarity (0..1); chunks below it are discarded
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    preload_embedding_model: bool = True   # load the model in the background at startup so the first question is fast

    # ---- Groq (LLM) ----
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_timeout_seconds: float = 30.0
    groq_max_tokens: int = 800

    # ---- Chat ----
    chat_rate_limit: int = 20
    chat_rate_window_seconds: int = 60
    chat_history_messages: int = 6

    first_admin_email: str = "admin@example.com"
    first_admin_password: str = ""
    first_admin_name: str = "System Administrator"

    @field_validator("database_url")
    @classmethod
    def _validate_database_url(cls, v: str) -> str:
        """Only MySQL is supported. Accepts mysql://, normalises to the PyMySQL driver and utf8mb4."""
        try:
            url = make_url(v)
        except Exception as exc:  # noqa: BLE001
            raise ValueError("DATABASE_URL is not a valid database URL.") from exc
        if url.get_backend_name() != "mysql":
            raise ValueError(
                "DATABASE_URL must be a MySQL URL, e.g. "
                "mysql+pymysql://college_user:<password>@localhost:3306/college_chatbot"
            )
        url = url.set(drivername="mysql+pymysql")
        if "charset" not in url.query:
            url = url.update_query_dict({"charset": "utf8mb4"})
        return url.render_as_string(hide_password=False)

    @field_validator("secret_key")
    @classmethod
    def _validate_secret(cls, v: str) -> str:
        if v in _INSECURE_KEYS or len(v) < 32:
            raise ValueError(
                "SECRET_KEY is missing, a placeholder, or shorter than 32 characters. "
                "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
            )
        return v

    @model_validator(mode="after")
    def _validate_rag(self) -> "Settings":
        if self.chunk_size < 200:
            raise ValueError("CHUNK_SIZE must be at least 200 characters.")
        if not 0 <= self.chunk_overlap < self.chunk_size // 2:
            raise ValueError("CHUNK_OVERLAP must be >= 0 and less than half of CHUNK_SIZE.")
        if self.top_k < 1 or self.top_k > 20:
            raise ValueError("TOP_K must be between 1 and 20.")
        if not 0.0 <= self.similarity_threshold <= 1.0:
            raise ValueError("SIMILARITY_THRESHOLD must be between 0 and 1.")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
