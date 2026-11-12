"""Load PDFs from a folder into the knowledge base (database + ChromaDB).

Folder layout: one sub-folder per category, named exactly like the category, e.g.
    knowledge_base/official/Fee Structure/fees_2026.pdf

Examples (run from the backend folder, virtual environment active):
    python -m app.scripts.seed_knowledge_base                         # load the demonstration documents
    python -m app.scripts.seed_knowledge_base --remove-samples        # delete the demonstration documents
    python -m app.scripts.seed_knowledge_base --dir ..\\knowledge_base\\official
    python -m app.scripts.seed_knowledge_base --dir C:\\pdfs --category "Syllabus"   # flat folder, single category
    python -m app.scripts.seed_knowledge_base --dry-run               # show what would happen
"""
import argparse
import sys
from pathlib import Path

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.rag.categories import CATEGORIES
from app.services.knowledge_base import SAMPLE_PREFIX, remove_sample_documents, seed_directory

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_DIR = REPO_ROOT / "knowledge_base" / "sample_documents"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Load PDFs into the College Chatbot knowledge base.",
                                 formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    ap.add_argument("--dir", type=Path, default=DEFAULT_DIR, help="folder with category sub-folders (default: sample documents)")
    ap.add_argument("--category", choices=CATEGORIES, help="put every PDF directly inside --dir into this category")
    ap.add_argument("--uploaded-by", default=None, help="admin e-mail recorded as uploader (default: FIRST_ADMIN_EMAIL)")
    ap.add_argument("--dry-run", action="store_true", help="validate and report only; change nothing")
    ap.add_argument("--remove-samples", action="store_true",
                    help=f"delete all documents whose file name starts with {SAMPLE_PREFIX}, then exit")
    args = ap.parse_args(argv)

    with SessionLocal() as db:
        if args.remove_samples:
            if args.dry_run:
                print("--dry-run: nothing removed.")
                return 0
            removed, failed = remove_sample_documents(db)
            print(f"Removed {removed} sample document(s); {failed} could not be removed.")
            return 1 if failed else 0

        try:
            report = seed_directory(db, args.dir, category=args.category,
                                    uploader_email=args.uploaded_by or get_settings().first_admin_email,
                                    dry_run=args.dry_run)
        except (FileNotFoundError, ValueError) as exc:
            print(f"Error: {exc}")
            return 2

    width = max((len(i.path) for i in report.items), default=10)
    for i in report.items:
        print(f"{i.outcome.upper():<12} {i.path:<{width}}  {i.detail}")
    print(f"\nimported={report.count('imported')} would_import={report.count('would_import')} "
          f"skipped={report.count('skipped')} failed={report.count('failed')}")
    if not report.items:
        print("No PDF files found. Expected: <folder>/<Category name>/<file>.pdf")
    return 1 if report.count("failed") else 0


if __name__ == "__main__":
    sys.exit(main())
