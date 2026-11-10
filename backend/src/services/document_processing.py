"""PDF extraction and processing-state updates."""

from pathlib import Path

from pypdf import PdfReader

from src.database import get_connection


def process_document(document_id: str) -> None:
    with get_connection() as db:
        row = db.execute("SELECT file_path FROM documents WHERE id=?", (document_id,)).fetchone()
        if not row:
            return
        db.execute(
            "UPDATE documents SET processing_stage='extracting',processing_error=NULL WHERE id=?",
            (document_id,),
        )

    try:
        reader = PdfReader(str(Path(row["file_path"])))
        pages = [(page.extract_text() or "") for page in reader.pages]
        if not pages:
            error = "This PDF contains no pages."
        elif not any(text.strip() for text in pages):
            error = "No selectable text was found. Scanned PDF OCR is not available yet."
        else:
            error = None
    except Exception:
        pages = []
        error = "This PDF is damaged, encrypted, or unreadable. Re-export it as a standard PDF and try again."

    if error:
        with get_connection() as db:
            db.execute(
                "UPDATE documents SET status='failed',processing_stage='failed',processing_error=? WHERE id=?",
                (error, document_id),
            )
        return

    try:
        with get_connection() as db:
            db.execute("DELETE FROM document_pages WHERE document_id=?", (document_id,))
            db.executemany(
                "INSERT INTO document_pages(document_id,page_number,text) VALUES(?,?,?)",
                [(document_id, number, text) for number, text in enumerate(pages, 1)],
            )
            db.execute(
                "UPDATE documents SET status='ready',processing_stage='ready_for_indexing',processing_error=NULL WHERE id=?",
                (document_id,),
            )
    except Exception:
        with get_connection() as db:
            db.execute(
                "UPDATE documents SET status='failed',processing_stage='failed',processing_error=? WHERE id=?",
                ("Could not save the extracted text. Please try uploading the PDF again.", document_id),
            )
