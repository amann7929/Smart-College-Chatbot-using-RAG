"""Generate the demonstration PDFs from app/scripts/sample_content.py.

Usage:  python -m app.scripts.generate_sample_pdfs [--out PATH]

Output layout (one folder per category, which is what the seed script expects):
    knowledge_base/sample_documents/<Category>/SAMPLE_<Name>.pdf
Every page carries a visible "SAMPLE DATA - FICTIONAL" header so nobody mistakes it for real information.
"""
import argparse
import html
import io
import sys
from pathlib import Path

import fitz  # PyMuPDF

from app.scripts.sample_content import DOCS

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_OUT = REPO_ROOT / "knowledge_base" / "sample_documents"
SAMPLE_BANNER = "SAMPLE DATA - FICTIONAL INSTITUTION - FOR DEMONSTRATION ONLY"

CSS = """
body { font-family: sans-serif; font-size: 10.5pt; line-height: 1.35; color: #111; }
h1 { font-size: 19pt; color: #1e2a5a; margin-bottom: 4pt; }
h2 { font-size: 13pt; color: #3b4fa8; margin-top: 14pt; margin-bottom: 3pt; page-break-after: avoid; }
p { margin-top: 2pt; margin-bottom: 5pt; }
li { margin-bottom: 3pt; }
"""


def _to_html(doc: dict) -> str:
    parts = [f"<h1>{html.escape(doc['title'])}</h1>"]
    for heading, items in doc["sections"]:
        parts.append(f"<h2>{html.escape(heading)}</h2>")
        for item in items:
            if isinstance(item, list):
                parts.append("<ul>" + "".join(f"<li>{html.escape(x)}</li>" for x in item) + "</ul>")
            else:
                parts.append(f"<p>{html.escape(item)}</p>")
    return "\n".join(parts)


def build_pdf_bytes(doc: dict) -> bytes:
    buffer = io.BytesIO()
    writer = fitz.DocumentWriter(buffer)
    story = fitz.Story(html=_to_html(doc), user_css=CSS)
    mediabox = fitz.paper_rect("a4")
    where = mediabox + (50, 60, -50, -55)
    more = True
    while more:
        device = writer.begin_page(mediabox)
        more, _ = story.place(where)
        story.draw(device)
        writer.end_page()
    writer.close()

    pdf = fitz.open("pdf", buffer.getvalue())
    total = pdf.page_count
    for i, page in enumerate(pdf, start=1):
        r = page.rect
        page.insert_textbox(fitz.Rect(40, 22, r.width - 40, 46), SAMPLE_BANNER, fontsize=8.5,
                            fontname="helv", color=(0.75, 0.1, 0.1), align=fitz.TEXT_ALIGN_CENTER)
        page.insert_textbox(fitz.Rect(40, r.height - 40, r.width - 40, r.height - 18),
                            f"Sample Institute of Engineering (fictional) - Page {i} of {total}", fontsize=8,
                            fontname="helv", color=(0.4, 0.4, 0.4), align=fitz.TEXT_ALIGN_CENTER)
    pdf.set_metadata({"title": doc["title"], "author": "Sample Institute of Engineering (FICTIONAL)",
                      "subject": "Demonstration data - not real information"})
    out = pdf.tobytes(garbage=3, deflate=True)
    pdf.close()
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help="output folder (default: knowledge_base/sample_documents)")
    args = ap.parse_args(argv)
    for doc in DOCS:
        folder = args.out / doc["category"]
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / f"SAMPLE_{doc['slug']}.pdf"
        path.write_bytes(build_pdf_bytes(doc))
        print(f"wrote {path.relative_to(args.out)}")
    print(f"{len(DOCS)} sample PDFs written to {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
