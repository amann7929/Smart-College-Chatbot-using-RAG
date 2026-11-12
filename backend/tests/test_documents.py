import os
import uuid
from pathlib import Path

from sqlalchemy import select

from app.core.config import get_settings
from app.models import Document
from app.rag import vectorstore
from app.rag.embeddings import EmbeddingError, set_embedder
from app.services.ingestion import recover_interrupted_documents
from tests.conftest import API
from tests.helpers import FEES, HOSTEL, FakeEmbedder, make_pdf


def upload(client, headers, data: bytes, filename="fees.pdf", category="Fee Structure", content_type="application/pdf"):
    return client.post(f"{API}/documents", headers=headers, data={"category": category},
                       files={"file": (filename, data, content_type)})


def stored_files() -> list[str]:
    d = Path(os.environ["UPLOAD_DIR"])
    return sorted(p.name for p in d.iterdir()) if d.exists() else []


def test_upload_requires_admin(client, student):
    pdf = make_pdf([FEES])
    assert upload(client, student["headers"], pdf).status_code == 403
    assert client.post(f"{API}/documents", data={"category": "Fee Structure"},
                       files={"file": ("a.pdf", pdf, "application/pdf")}).status_code == 401
    assert stored_files() == []


def test_upload_indexes_document_and_keeps_ids_consistent(client, admin, db):
    r = upload(client, admin["headers"], make_pdf([FEES, HOSTEL]))
    assert r.status_code == 202
    doc_id = r.json()["id"]
    assert r.json()["status"] == "pending"          # response is sent before processing finishes

    polled = client.get(f"{API}/documents/{doc_id}", headers=admin["headers"]).json()
    assert polled["status"] == "indexed" and polled["chunk_count"] >= 1 and polled["page_count"] == 2
    assert polled["error_message"] is None and polled["indexed_at"] is not None
    assert "stored_filename" not in polled and "file_hash" not in polled

    # vectors in ChromaDB carry the same document id as MySQL, and counts agree
    got = vectorstore.get_collection().get(where={"document_id": doc_id}, include=["metadatas"])
    assert len(got["ids"]) == polled["chunk_count"]
    assert all(i.startswith(f"{doc_id}:") for i in got["ids"])
    assert all(m["filename"] == "fees.pdf" and m["category"] == "Fee Structure" for m in got["metadatas"])
    assert len(stored_files()) == 1
    # admin stats (Phase 1) now reflect the indexed chunks
    stats = client.get(f"{API}/admin/stats", headers=admin["headers"]).json()
    assert stats["total_documents"] == 1 and stats["indexed_documents"] == 1 and stats["total_chunks"] == polled["chunk_count"]


def test_upload_validation(client, admin, monkeypatch):
    h = admin["headers"]
    assert upload(client, h, b"hello", filename="notes.txt").status_code == 415
    assert upload(client, h, b"this is not a pdf", filename="fake.pdf").status_code == 415
    assert upload(client, h, b"", filename="empty.pdf").status_code == 400
    assert upload(client, h, make_pdf([FEES]), category="Not A Category").status_code == 422

    monkeypatch.setattr(get_settings(), "max_upload_mb", 1)
    big = b"%PDF-1.4\n" + b"0" * int(1.5 * 1024 * 1024)
    assert upload(client, h, big).status_code == 413                    # caught by streaming limit
    huge = b"%PDF-1.4\n" + b"0" * (3 * 1024 * 1024)
    assert upload(client, h, huge).status_code == 413                   # caught early by Content-Length check
    assert stored_files() == []                                         # nothing left behind
    assert client.get(f"{API}/documents", headers=h).json()["total"] == 0


def test_path_traversal_filename_is_sanitised(client, admin):
    r = upload(client, admin["headers"], make_pdf([FEES]), filename="../../etc/passwd.pdf")
    assert r.status_code == 202 and r.json()["original_filename"] == "passwd.pdf"
    assert all(n.endswith(".pdf") and len(n) == 36 for n in stored_files())   # uuid hex + .pdf


def test_duplicate_detection_by_content_hash(client, admin):
    pdf = make_pdf([FEES])
    assert upload(client, admin["headers"], pdf, filename="one.pdf").status_code == 202
    dup = upload(client, admin["headers"], pdf, filename="renamed.pdf")
    assert dup.status_code == 409 and "one.pdf" in dup.json()["detail"]
    assert client.get(f"{API}/documents", headers=admin["headers"]).json()["total"] == 1
    assert len(stored_files()) == 1


def test_unreadable_pdf_ends_failed_with_message_and_no_vectors(client, admin):
    r = upload(client, admin["headers"], make_pdf(["", ""]), filename="scan.pdf")
    assert r.status_code == 202
    doc = client.get(f"{API}/documents/{r.json()['id']}", headers=admin["headers"]).json()
    assert doc["status"] == "failed" and "No extractable text" in doc["error_message"] and doc["chunk_count"] == 0
    assert vectorstore.total_count() == 0


def test_embedding_failure_then_successful_retry(client, admin, student):
    class Broken(FakeEmbedder):
        def embed_documents(self, texts):
            raise EmbeddingError("The embedding model could not be loaded.")

    set_embedder(Broken())
    doc_id = upload(client, admin["headers"], make_pdf([FEES])).json()["id"]
    failed = client.get(f"{API}/documents/{doc_id}", headers=student["headers"]).json()   # students see the error
    assert failed["status"] == "failed" and "embedding model" in failed["error_message"]
    assert vectorstore.total_count() == 0

    assert client.post(f"{API}/documents/{doc_id}/retry", headers=student["headers"]).status_code == 403
    set_embedder(FakeEmbedder())
    r = client.post(f"{API}/documents/{doc_id}/retry", headers=admin["headers"])
    assert r.status_code == 202
    ok = client.get(f"{API}/documents/{doc_id}", headers=admin["headers"]).json()
    assert ok["status"] == "indexed" and ok["error_message"] is None and ok["chunk_count"] > 0
    assert vectorstore.count_for_document(doc_id) == ok["chunk_count"]
    # only failed documents can be retried
    assert client.post(f"{API}/documents/{doc_id}/retry", headers=admin["headers"]).status_code == 409


def test_unexpected_error_hides_internals_and_cleans_partial_vectors(client, admin, monkeypatch):
    real_add = vectorstore.add_chunks

    def add_then_crash(doc, chunks, embeddings):
        real_add(doc, chunks, embeddings)
        raise RuntimeError("boom: secret internal detail")

    monkeypatch.setattr("app.services.ingestion.vectorstore.add_chunks", add_then_crash)
    doc_id = upload(client, admin["headers"], make_pdf([FEES])).json()["id"]
    doc = client.get(f"{API}/documents/{doc_id}", headers=admin["headers"]).json()
    assert doc["status"] == "failed" and "secret" not in doc["error_message"] and "boom" not in doc["error_message"]
    assert vectorstore.count_for_document(doc_id) == 0            # partial vectors were removed


def test_delete_removes_row_file_and_vectors(client, admin, student):
    doc_id = upload(client, admin["headers"], make_pdf([FEES])).json()["id"]
    assert vectorstore.count_for_document(doc_id) > 0
    assert client.delete(f"{API}/documents/{doc_id}", headers=student["headers"]).status_code == 403
    assert client.delete(f"{API}/documents/{doc_id}", headers=admin["headers"]).status_code == 204
    assert client.get(f"{API}/documents/{doc_id}", headers=admin["headers"]).status_code == 404
    assert vectorstore.count_for_document(doc_id) == 0 and vectorstore.total_count() == 0
    assert stored_files() == []
    # deleting then re-uploading the same file is allowed
    assert upload(client, admin["headers"], make_pdf([FEES])).status_code == 202


def test_delete_only_removes_that_documents_vectors(client, admin):
    a = upload(client, admin["headers"], make_pdf([FEES]), filename="a.pdf").json()["id"]
    b = upload(client, admin["headers"], make_pdf([HOSTEL]), filename="b.pdf", category="Hostel Facilities").json()["id"]
    n_b = vectorstore.count_for_document(b)
    client.delete(f"{API}/documents/{a}", headers=admin["headers"])
    assert vectorstore.count_for_document(a) == 0 and vectorstore.count_for_document(b) == n_b > 0


def test_cannot_delete_document_that_is_processing(client, admin, db):
    doc = Document(original_filename="x.pdf", stored_filename="x.pdf", category="Syllabus", file_hash="e" * 64,
                   file_size=1, status="processing")
    db.add(doc); db.commit()
    assert client.delete(f"{API}/documents/{doc.id}", headers=admin["headers"]).status_code == 409


def test_list_search_filter_pagination(client, admin, student):
    upload(client, admin["headers"], make_pdf([FEES]), filename="Fee_Structure_2025.pdf", category="Fee Structure")
    upload(client, admin["headers"], make_pdf([HOSTEL]), filename="Hostel_Guide.pdf", category="Hostel Facilities")
    upload(client, admin["headers"], make_pdf([""]), filename="scanned.pdf", category="Syllabus")
    h = student["headers"]                                       # any logged-in user can browse
    get = lambda **p: client.get(f"{API}/documents", headers=h, params=p).json()
    assert get()["total"] == 3
    assert [d["original_filename"] for d in get(search="hostel")["items"]] == ["Hostel_Guide.pdf"]
    assert get(category="Fee Structure")["total"] == 1
    assert [d["original_filename"] for d in get(status="failed")["items"]] == ["scanned.pdf"]
    assert get(status="indexed")["total"] == 2
    assert get(search="%")["total"] == 0                          # wildcard is literal
    assert len(get(page_size=2)["items"]) == 2 and len(get(page_size=2, page=2)["items"]) == 1
    assert client.get(f"{API}/documents", headers=h, params={"status": "bogus"}).status_code == 422
    assert client.get(f"{API}/documents").status_code == 401
    cats = client.get(f"{API}/documents/categories", headers=h).json()
    assert "Fee Structure" in cats and len(cats) == 16


def test_recover_interrupted_documents_after_restart(client, admin, db):
    ok_id = upload(client, admin["headers"], make_pdf([FEES]), filename="ok.pdf").json()["id"]
    stuck = []
    for i, st in enumerate(("pending", "processing")):
        d = Document(original_filename=f"s{i}.pdf", stored_filename=f"s{i}.pdf", category="Syllabus",
                     file_hash=str(i) * 64, file_size=1, status=st)
        db.add(d); stuck.append(d)
    db.commit()
    assert recover_interrupted_documents() == 2
    db.expire_all()
    for d in stuck:
        db.refresh(d)
        assert d.status == "failed" and "restart" in d.error_message
    assert db.get(Document, uuid.UUID(ok_id)).status == "indexed"        # healthy documents untouched
