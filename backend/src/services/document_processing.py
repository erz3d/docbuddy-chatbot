# Extract page text, create document indexes, and record processing results.

import logging

from src.database import get_connection
from src.services.document_extractors import ExtractionError, extract_units
from src.services.document_indexing import index_document


def process_document(document_id: str) -> None:
    # Extract a document's citable text units and persist either the result or a clear error.
    with get_connection() as db:
        row = db.execute("SELECT file_path,mime_type,name FROM documents WHERE id=?", (document_id,)).fetchone()
        if not row:
            return
        db.execute(
            "UPDATE documents SET processing_stage='extracting',processing_error=NULL WHERE id=?",
            (document_id,),
        )

    try:
        units = extract_units(row["file_path"], row["mime_type"], row["name"])
        error = None
    except ExtractionError as exc:
        units = []
        error = str(exc)
    except Exception:
        logging.exception("Could not extract text from document %s", document_id)
        units = []
        error = "This file could not be read. Check that it is not damaged and try again."

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
                "INSERT INTO document_pages(document_id,page_number,text,label,structured_data,selected) VALUES(?,?,?,?,?,1)",
                [(document_id, number, unit.text, unit.label, unit.structured_data) for number, unit in enumerate(units, 1)],
            )
            db.execute(
                "UPDATE documents SET status='uploading',processing_stage='ready_for_indexing',processing_error=NULL WHERE id=?",
                (document_id,),
            )
        index_document(document_id)
    except Exception:
        with get_connection() as db:
            db.execute(
                "UPDATE documents SET status='failed',processing_stage='failed',processing_error=? WHERE id=?",
                ("Could not save the extracted text. Please try uploading the file again.", document_id),
            )
