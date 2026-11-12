"""Groq chat-completions client (OpenAI-compatible REST API) with explicit error mapping."""
import logging
import threading
import time

import httpx

from app.core.config import Settings, get_settings

logger = logging.getLogger("college_chatbot.llm")


class LLMError(Exception):
    """LLM call failed. `user_message` is safe to show; `code` is machine-readable."""

    def __init__(self, code: str, user_message: str, retry_after: int | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.user_message = user_message
        self.retry_after = retry_after


class GroqClient:
    MAX_ATTEMPTS = 2  # one retry for timeouts / connection errors / 5xx

    def __init__(self, settings: Settings | None = None, transport: httpx.BaseTransport | None = None) -> None:
        self._settings = settings
        self._transport = transport

    @property
    def settings(self) -> Settings:
        return self._settings or get_settings()

    def chat(self, messages: list[dict]) -> str:
        s = self.settings
        if not s.groq_api_key:
            raise LLMError("not_configured",
                           "The AI service is not configured yet. Please ask the administrator to set the Groq API key.")
        payload = {
            "model": s.groq_model,
            "messages": messages,
            "temperature": 0.1,
            "max_tokens": s.groq_max_tokens,
        }
        headers = {"Authorization": f"Bearer {s.groq_api_key}", "Content-Type": "application/json"}
        url = s.groq_base_url.rstrip("/") + "/chat/completions"

        last_error: LLMError | None = None
        for attempt in range(1, self.MAX_ATTEMPTS + 1):
            try:
                with httpx.Client(timeout=s.groq_timeout_seconds, transport=self._transport) as client:
                    resp = client.post(url, json=payload, headers=headers)
            except httpx.TimeoutException:
                last_error = LLMError("timeout", "The AI service took too long to respond. Please try again.")
            except httpx.HTTPError:
                last_error = LLMError("unavailable", "The AI service could not be reached. Please try again shortly.")
            else:
                if resp.status_code == 200:
                    return self._parse(resp)
                if resp.status_code == 429:
                    retry = _int_or_none(resp.headers.get("retry-after"))
                    raise LLMError("rate_limited",
                                   "The AI service is receiving too many requests right now. "
                                   + (f"Please try again in about {retry} seconds." if retry else "Please try again in a minute."),
                                   retry_after=retry)
                if resp.status_code in (401, 403):
                    logger.error("Groq rejected the API key (HTTP %s)", resp.status_code)
                    raise LLMError("auth_error",
                                   "The AI service is not configured correctly. Please contact the administrator.")
                if resp.status_code >= 500:
                    logger.warning("Groq server error HTTP %s", resp.status_code)
                    last_error = LLMError("unavailable", "The AI service is temporarily unavailable. Please try again shortly.")
                else:
                    logger.error("Groq request rejected HTTP %s: %s", resp.status_code, resp.text[:300])
                    raise LLMError("bad_request", "The AI service could not process this request.")
            if attempt < self.MAX_ATTEMPTS:
                time.sleep(0.4)
        assert last_error is not None
        raise last_error

    @staticmethod
    def _parse(resp: httpx.Response) -> str:
        try:
            content = resp.json()["choices"][0]["message"]["content"]
        except Exception:
            raise LLMError("bad_response", "The AI service returned an unexpected response. Please try again.")
        if not isinstance(content, str) or not content.strip():
            raise LLMError("bad_response", "The AI service returned an empty answer. Please try again.")
        return content.strip()


def _int_or_none(value: str | None) -> int | None:
    try:
        return max(1, int(float(value))) if value else None
    except ValueError:
        return None


_llm = None
_lock = threading.Lock()


def get_llm() -> GroqClient:
    global _llm
    with _lock:
        if _llm is None:
            _llm = GroqClient()
        return _llm


def set_llm(client: GroqClient | None) -> None:
    """Override the LLM client (tests)."""
    global _llm
    with _lock:
        _llm = client
