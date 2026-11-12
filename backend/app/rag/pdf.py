"""PDF text extraction with PyMuPDF and user-friendly failure reasons."""
import re
import unicodedata
from dataclasses import dataclass

import fitz  # PyMuPDF


class IngestionError(Exception):
    """A problem with the document itself. The message is safe to show to users."""


@dataclass
class ExtractedPdf:
    pages: list[str]   # one entry per page (may be empty strings for blank pages)
    page_count: int


def _clean(text: str) -> str:
    # NFKC folds ligatures (e.g. U+FB01 "fi" -> "fi") and other compatibility forms that PDFs often contain,
    # so keywords like "figures" match the way users type them.
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("\x00", "")
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r" ?\n ?", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_pdf_text(path: str, max_pages: int) -> ExtractedPdf:
    try:
        doc = fitz.open(path)
    except Exception:
        raise IngestionError("The file could not be opened as a PDF. It may be corrupted.")
    try:
        if doc.needs_pass or doc.is_encrypted:
            raise IngestionError("The PDF is password-protected. Remove the password and upload it again.")
        if doc.page_count == 0:
            raise IngestionError("The PDF has no pages.")
        if doc.page_count > max_pages:
            raise IngestionError(f"The PDF has {doc.page_count} pages; the limit is {max_pages}.")
        try:
            pages = [_clean(page.get_text("text")) for page in doc]
        except Exception:
            raise IngestionError("Text could not be read from this PDF. It may be damaged.")
        count = doc.page_count
    finally:
        doc.close()
    if not any(pages):
        raise IngestionError(
            "No extractable text was found. The PDF may be scanned or image-only (OCR is not supported)."
        )
    return ExtractedPdf(pages=pages, page_count=count)
