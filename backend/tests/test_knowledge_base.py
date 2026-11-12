import os
import re
from pathlib import Path

import fitz
import pytest
from sqlalchemy import func, select

from app.core.config import get_settings
from app.models import AuditLog, Document
from app.rag import vectorstore
from app.rag.categories import CATEGORIES
from app.rag.pdf import extract_pdf_text
from app.rag.pipeline import retrieve
from app.scripts.seed_knowledge_base import DEFAULT_DIR, main as seed_cli
from app.services.knowledge_base import remove_sample_documents, seed_directory
from tests.conftest import API
from tests.helpers import FEES, make_pdf
from tests.test_chats import make_chat
from tests.test_documents import stored_files, upload

SAMPLE_PDFS = sorted(DEFAULT_DIR.glob("*/*.pdf"))


def text_of(folder: str) -> str:
    pdf = next(DEFAULT_DIR.glob(f"{folder}/*.pdf"))
    return "\n".join(extract_pdf_text(str(pdf), 100).pages)


# ------------------------------------------------------------------ the sample PDFs themselves

def test_one_sample_pdf_for_every_category_in_matching_folder():
    assert len(SAMPLE_PDFS) == 15
    folders = {p.parent.name for p in SAMPLE_PDFS}
    assert folders == set(CATEGORIES) - {"Other"}
    assert all(p.name.startswith("SAMPLE_") for p in SAMPLE_PDFS)


def test_every_sample_page_is_visibly_labelled_as_fictional():
    for pdf in SAMPLE_PDFS:
        doc = fitz.open(pdf)
        for page in doc:
            assert "SAMPLE DATA - FICTIONAL" in page.get_text("text"), f"{pdf.name} page {page.number + 1}"
        assert "FICTIONAL" in extract_pdf_text(str(pdf), 100).pages[0]       # also in the body text


def test_sample_pdfs_extract_cleanly():
    for pdf in SAMPLE_PDFS:
        out = extract_pdf_text(str(pdf), 100)
        joined = "\n".join(out.pages)
        assert len(joined) > 1200, pdf.name
        assert not re.search("[\ufb00-\ufb06]", joined)           # no ligatures after cleaning


def test_sample_pdfs_contain_no_real_looking_contact_data():
    alltext = "\n".join(text_of(p.parent.name) for p in SAMPLE_PDFS)
    emails = {e.rstrip(".") for e in re.findall(r"[\w.+-]+@[\w.-]+", alltext)}
    assert emails and all(e.endswith("@sie.example") for e in emails), emails
    phones = re.findall(r"\+\d[\d ]{7,}\d", alltext)
    assert phones and all(p.startswith("+00 000 000 ") for p in phones), phones


def test_facts_are_consistent_across_documents():
    fees, hostel, transport = text_of("Fee Structure"), text_of("Hostel Facilities"), text_of("Transport Facilities")
    library, calendar, adm = text_of("Library Information"), text_of("Academic Calendar"), text_of("Admission Process")
    assert "Rs. 60,000" in fees and "Rs. 60,000" in hostel and "Rs. 5,000" in fees and "Rs. 5,000" in hostel
    assert all(x in transport for x in ("15,000", "18,000", "22,000")) and "15,000" in fees and "22,000" in fees
    assert "Rs. 3,000" in fees and "Rs. 3,000" in library
    assert "31 August 2026" in text_of("Scholarships") and "31 August 2026" in calendar
    assert "3 August 2026" in adm and "3 August 2026" in calendar
    assert "75 percent" in text_of("Examination Rules") and "100 percent" in text_of("Scholarships")


# ------------------------------------------------------------------ seeding

@pytest.fixture
def seeded(db, admin):
    report = seed_directory(db, DEFAULT_DIR, uploader_email="admin@example.com")
    assert report.count("imported") == 15, [i for i in report.items if i.outcome != "imported"]
    return report


def test_seed_imports_all_samples_consistently(db, admin, seeded):
    docs = list(db.scalars(select(Document)))
    assert len(docs) == 15 and all(d.status == "indexed" and d.chunk_count > 0 for d in docs)
    assert {d.category for d in docs} == set(CATEGORIES) - {"Other"}
    assert vectorstore.total_count() == sum(d.chunk_count for d in docs)
    for d in docs:
        assert vectorstore.count_for_document(d.id) == d.chunk_count          # MySQL <-> ChromaDB agree
        assert d.uploaded_by is not None
    assert len(stored_files()) == 15
    assert db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == "document.seed")) == 15


def test_seed_is_idempotent(db, admin, seeded):
    again = seed_directory(db, DEFAULT_DIR)
    assert again.count("imported") == 0 and again.count("skipped") == 15
    assert "already in knowledge base" in again.items[0].detail
    assert db.scalar(select(func.count()).select_from(Document)) == 15
    assert len(stored_files()) == 15 and vectorstore.total_count() == sum(d.chunk_count for d in db.scalars(select(Document)))


def test_dry_run_changes_nothing(db):
    report = seed_directory(db, DEFAULT_DIR, dry_run=True)
    assert report.count("would_import") == 15
    assert db.scalar(select(func.count()).select_from(Document)) == 0 and stored_files() == [] and vectorstore.total_count() == 0


def test_remove_samples_keeps_official_documents(client, db, admin, seeded):
    official = upload(client, admin["headers"], make_pdf([FEES]), filename="Official_Fees_2026.pdf").json()["id"]
    n_official = vectorstore.count_for_document(official)
    assert n_official > 0
    assert remove_sample_documents(db) == (15, 0)
    db.expire_all()
    remaining = list(db.scalars(select(Document)))
    assert [d.original_filename for d in remaining] == ["Official_Fees_2026.pdf"]
    assert vectorstore.total_count() == n_official                             # sample vectors gone, official intact
    assert len(stored_files()) == 1


def test_official_folder_validation_and_reporting(db, tmp_path, capsys):
    (tmp_path / "Fee Structure").mkdir()
    (tmp_path / "Fee Structure" / "Official_Fees.pdf").write_bytes(make_pdf([FEES]))
    (tmp_path / "Bogus Category").mkdir()
    (tmp_path / "Bogus Category" / "x.pdf").write_bytes(make_pdf([FEES + " different"]))
    (tmp_path / "Syllabus").mkdir()
    (tmp_path / "Syllabus" / "fake.pdf").write_bytes(b"not a pdf")
    (tmp_path / "Syllabus" / "empty.pdf").write_bytes(b"")
    (tmp_path / "Syllabus" / "scan.pdf").write_bytes(make_pdf(["", ""]))
    (tmp_path / "Syllabus" / "notes.txt").write_text("ignored")
    (tmp_path / "loose.pdf").write_bytes(make_pdf(["loose file text here"]))

    rep = seed_directory(db, tmp_path)
    by = {i.path.replace(os.sep, "/"): i for i in rep.items}
    assert by["Fee Structure/Official_Fees.pdf"].outcome == "imported"
    assert by["Bogus Category/x.pdf"].outcome == "skipped" and "not a valid category" in by["Bogus Category/x.pdf"].detail
    assert by["Syllabus/fake.pdf"].outcome == "skipped" and "not a valid PDF" in by["Syllabus/fake.pdf"].detail
    assert by["Syllabus/empty.pdf"].outcome == "skipped" and "empty" in by["Syllabus/empty.pdf"].detail
    assert by["loose.pdf"].outcome == "skipped" and "category folder" in by["loose.pdf"].detail
    assert by["Syllabus/scan.pdf"].outcome == "failed" and "No extractable text" in by["Syllabus/scan.pdf"].detail
    assert "Syllabus/notes.txt" not in by
    scan = db.get(Document, __import__("uuid").UUID(by["Syllabus/scan.pdf"].document_id))
    assert scan.status == "failed" and vectorstore.count_for_document(scan.id) == 0

    # Re-running: everything already in the DB is skipped (the failed scan points to Retry); nothing new fails -> exit 0
    capsys.readouterr()
    assert seed_cli(["--dir", str(tmp_path)]) == 0
    out = capsys.readouterr().out
    assert "already in knowledge base" in out and "Retry" in out and "failed=0" in out

    # A fresh folder whose only file cannot be indexed -> non-zero exit code
    fresh = tmp_path.parent / (tmp_path.name + "_fresh")
    (fresh / "Syllabus").mkdir(parents=True)
    (fresh / "Syllabus" / "blank2.pdf").write_bytes(make_pdf(["", "", ""]))
    assert seed_cli(["--dir", str(fresh)]) == 1
    assert "FAILED" in capsys.readouterr().out


def test_flat_folder_with_category_option(db, tmp_path):
    (tmp_path / "a.pdf").write_bytes(make_pdf([FEES]))
    rep = seed_directory(db, tmp_path, category="Scholarships")
    assert rep.count("imported") == 1 and db.scalar(select(Document)).category == "Scholarships"
    with pytest.raises(ValueError):
        seed_directory(db, tmp_path, category="Nope")


def test_cli_missing_folder_and_remove_samples(db, admin, tmp_path, capsys, seeded):
    assert seed_cli(["--dir", str(tmp_path / "missing")]) == 2
    assert "Folder not found" in capsys.readouterr().out
    assert seed_cli(["--remove-samples", "--dry-run"]) == 0
    assert db.scalar(select(func.count()).select_from(Document)) == 15
    assert seed_cli(["--remove-samples"]) == 0
    assert "Removed 15" in capsys.readouterr().out
    db.expire_all()
    assert db.scalar(select(func.count()).select_from(Document)) == 0 and vectorstore.total_count() == 0


# ------------------------------------------------------------------ retrieval over the seeded knowledge base

QUESTIONS = [
    ("Who is the principal and what are the vision and mission of the institute?", "College Profile"),
    ("How many seats are there in the B.Tech Mechanical Engineering programme?", "Courses and Departments"),
    ("What is the SIE-CET entrance test and the counselling schedule for admission?", "Admission Process"),
    ("What is the annual tuition fee and the late fine for fee payment?", "Fee Structure"),
    ("What are the faculty office hours and how can I contact faculty by email?", "Faculty Information"),
    ("What does the Machine Learning course cover: regression, classification and clustering?", "Syllabus"),
    ("What is the minimum attendance to appear for the end-semester examination?", "Examination Rules"),
    ("What are the autumn festival break dates and the last day of classes?", "Academic Calendar"),
    ("What time does the girls hostel gate close and what are the mess timings?", "Hostel Facilities"),
    ("How many books can an undergraduate student borrow from the library and what is the late return fine?", "Library Information"),
    ("Which bus route goes to the railway station and what is the bus fee for zone B?", "Transport Facilities"),
    ("What was the highest package and average package in the placement statistics?", "Placement Information"),
    ("Which rank gets a 100 percent tuition fee waiver scholarship?", "Scholarships"),
    ("What is the anti-ragging policy and the dress code?", "Rules and Regulations"),
    ("What is the campus security phone number and the main office address?", "Contact Information"),
]


@pytest.mark.parametrize("question,expected", QUESTIONS)
def test_top_retrieved_chunk_comes_from_the_right_document(db, seeded, monkeypatch, question, expected):
    """Lexical smoke test using the offline stand-in embedder (NOT a measure of MiniLM quality)."""
    monkeypatch.setattr(get_settings(), "similarity_threshold", 0.0)
    hits, _ = retrieve(db, question)
    assert hits and hits[0].category == expected, [(h.category, round(h.similarity, 3)) for h in hits]


def test_chat_over_seeded_knowledge_base_cites_the_sample_document(client, student, seeded, groq):
    chat = make_chat(client, student["headers"])
    groq.default_text = "The girls hostel gate closes at 9:30 pm on weekdays. [S1]"
    r = client.post(f"{API}/chats/{chat['id']}/messages", headers=student["headers"],
                    json={"content": "What time does the girls hostel gate close on weekdays?"})
    a = r.json()["assistant_message"]
    assert a["status"] == "completed"
    assert a["sources"][0]["filename"] == "SAMPLE_Hostel_Facilities.pdf"
    context = groq.requests[0]["messages"][-1]["content"]
    assert "9:30 pm on weekdays" in context and "FICTIONAL" in context       # the model is shown the sample label too
