"""Overlapping text chunking that preserves character offsets so every chunk knows its PDF page(s)."""
import re
from bisect import bisect_right
from dataclasses import dataclass

PAGE_SEPARATOR = "\n\n"


@dataclass(frozen=True)
class Chunk:
    index: int
    text: str
    start: int       # character offset in the joined document text
    end: int
    page_start: int  # 1-based
    page_end: int


def _find_break(text: str, lo: int, hi: int) -> int | None:
    """Best place to end a chunk inside text[lo:hi]: paragraph > line > sentence > word."""
    i = text.rfind("\n\n", lo, hi)
    if i != -1:
        return i
    i = text.rfind("\n", lo, hi)
    if i != -1:
        return i
    i = max(text.rfind(". ", lo, hi), text.rfind("? ", lo, hi), text.rfind("! ", lo, hi))
    if i != -1:
        return i + 1
    i = text.rfind(" ", lo, hi)
    if i != -1:
        return i
    return None


def _split_spans(text: str, size: int, overlap: int) -> list[tuple[int, int]]:
    n = len(text)
    spans: list[tuple[int, int]] = []
    start = 0
    while start < n:
        while start < n and text[start].isspace():
            start += 1
        if start >= n:
            break
        end = min(start + size, n)
        if end < n:
            cut = _find_break(text, start + int(size * 0.6), end)
            if cut is not None and cut > start:
                end = cut
        spans.append((start, end))
        if end >= n:
            break
        nxt = end - overlap
        if nxt <= start:          # guarantee forward progress
            nxt = end
        if nxt < end and not text[nxt - 1].isspace():
            m = re.compile(r"\s").search(text, nxt, end)   # don't start mid-word
            nxt = m.start() if m else end
        start = nxt
    return spans


def chunk_pages(pages: list[str], chunk_size: int, chunk_overlap: int) -> list[Chunk]:
    """Split per-page texts into overlapping chunks; each chunk records its first and last page (1-based)."""
    if chunk_size < 1 or chunk_overlap < 0 or chunk_overlap >= chunk_size:
        raise ValueError("chunk_overlap must be >= 0 and smaller than chunk_size")
    offsets: list[int] = []
    parts: list[str] = []
    pos = 0
    for page in pages:
        offsets.append(pos)
        parts.append(page)
        pos += len(page) + len(PAGE_SEPARATOR)
    full = PAGE_SEPARATOR.join(parts)

    chunks: list[Chunk] = []
    for start, end in _split_spans(full, chunk_size, chunk_overlap):
        text = full[start:end].strip()
        if not text:
            continue
        page_start = bisect_right(offsets, start) or 1
        page_end = bisect_right(offsets, max(start, end - 1)) or 1
        chunks.append(Chunk(len(chunks), text, start, end, page_start, page_end))
    return chunks
