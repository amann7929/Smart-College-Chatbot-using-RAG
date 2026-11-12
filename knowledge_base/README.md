# Knowledge Base Documents

```
knowledge_base/
  sample_documents/   15 FICTIONAL demonstration PDFs (one per category) - safe to demo, never real information
  official/           empty category folders - put your college's real PDFs here
```

## The sample documents

"Sample Institute of Engineering" does not exist. Every page is stamped **SAMPLE DATA - FICTIONAL INSTITUTION - FOR
DEMONSTRATION ONLY**. Names, dates, fees, phone numbers and e-mail addresses are invented (e-mails use the reserved
`@sie.example` domain; phone numbers are `+00 000 000 xxxx` placeholders). Facts are consistent across documents
(for example hostel fee, bus zones and scholarship deadlines match everywhere).

Regenerate them any time (for example after editing `backend/app/scripts/sample_content.py`):

```powershell
cd backend
python -m app.scripts.generate_sample_pdfs
```

## Load the sample documents

```powershell
cd backend
python -m app.scripts.seed_knowledge_base --dry-run    # preview, changes nothing
python -m app.scripts.seed_knowledge_base              # import + index (synchronous, prints one line per file)
```

Running it again is safe: files already in the knowledge base are skipped (duplicates are detected by SHA-256).

## Replace the samples with official PDFs

Sample PDFs are fictional demo data. When an indexed official document exists in a category, retrieval ignores
`SAMPLE_` documents from that same category. Remove the sample set when switching a deployment to real college data:

**Option A - folders + script (bulk).** Copy PDFs into the folder named exactly like the category:

```
knowledge_base/official/Fee Structure/Fees_2026-27.pdf
knowledge_base/official/Hostel Facilities/Hostel_Rules.pdf
knowledge_base/official/Syllabus/BTech_CSE_AI_Syllabus.pdf
```

```powershell
cd backend
python -m app.scripts.seed_knowledge_base --remove-samples                       # drop demo documents (vectors + files + rows)
python -m app.scripts.seed_knowledge_base --dir ..\knowledge_base\official       # index your PDFs
```

For a flat folder of PDFs that all belong to one category:
`python -m app.scripts.seed_knowledge_base --dir C:\pdfs --category "Scholarships"`

**Option B - admin upload.** Upload PDFs through the admin Knowledge Base page (API: `POST /api/v1/documents`).
Remove demo documents with `--remove-samples` (or delete them one by one in the UI).

Valid category folder names: College Profile, Courses and Departments, Admission Process, Fee Structure,
Faculty Information, Syllabus, Examination Rules, Academic Calendar, Hostel Facilities, Library Information,
Transport Facilities, Placement Information, Scholarships, Rules and Regulations, Contact Information, Other.

## Tips for good answers with real PDFs

- Use text-based PDFs. Scanned/image PDFs fail with a clear message (no OCR); export a text PDF or run OCR first.
- Prefer clear sentences and "Label: value" lines over complex multi-column tables; tables often extract in a confusing order.
- One topic per file is easier to maintain than one giant handbook. Re-upload a corrected file after deleting the old one.
- After adding real documents, test 10-20 real student questions and tune `SIMILARITY_THRESHOLD` and `TOP_K` in `.env`.
- Never put confidential data (personal records, internal-only policies) into the knowledge base: any student can ask about it.
