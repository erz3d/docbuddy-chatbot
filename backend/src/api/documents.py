import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from src.database import get_connection
from src.services.document_processing import process_document
from src.services.document_storage import EmptyDocumentError, delete_pdf_file, save_pdf_upload

router = APIRouter()


class DocumentUpdate(BaseModel):
    collectionId: str | None


@router.get("/api/documents")
def list_documents():
    with get_connection() as db:
        rows = db.execute("SELECT id,name,size_bytes,collection_id,status,processing_stage,processing_error,added_at FROM documents ORDER BY added_at DESC").fetchall()
        memberships = db.execute("SELECT document_id, collection_id FROM document_collections").fetchall()
    by_document: dict[str, list[str]] = {}
    for membership in memberships:
        by_document.setdefault(membership["document_id"], []).append(membership["collection_id"])
    return [{"id": r["id"], "name": r["name"], "size": r["size_bytes"],
             "collectionId": r["collection_id"], "collectionIds": by_document.get(r["id"], []), "status": r["status"],
             "stage": r["processing_stage"], "error": r["processing_error"],
             "addedAt": r["added_at"]} for r in rows]


@router.post("/api/documents")
async def upload_document(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if file.content_type != "application/pdf" and not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(415, "Unsupported file type. Upload a PDF document.")
    doc_id = str(uuid.uuid4())
    name = file.filename or "document.pdf"
    try:
        path, size = await save_pdf_upload(doc_id, file.read)
    except EmptyDocumentError as exc:
        raise HTTPException(400, "The PDF file is empty. Choose a PDF that contains pages.") from exc
    except OSError as exc:
        raise HTTPException(500, "Could not save the uploaded PDF to disk.") from exc
    try:
        with get_connection() as db:
            db.execute("INSERT INTO documents (id,name,size_bytes,file_path,status,processing_stage) VALUES (?,?,?,?,'uploading','extracting')",
                       (doc_id, name, size, str(path)))
    except Exception:
        delete_pdf_file(path)
        raise
    background_tasks.add_task(process_document, doc_id)
    return {"id": doc_id, "name": name, "size": size, "status": "uploading", "stage": "extracting"}


@router.get("/api/documents/{document_id}/file")
def get_document_file(document_id: str):
    with get_connection() as db:
        row = db.execute("SELECT name,file_path FROM documents WHERE id=?", (document_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Document not found")
    file_path = Path(row["file_path"] or "")
    if not file_path.is_file():
        raise HTTPException(404, "The stored PDF file is missing.")
    return FileResponse(file_path, media_type="application/pdf", filename=row["name"], content_disposition_type="inline")


@router.get("/api/documents/{document_id}/status")
def get_document_status(document_id: str):
    with get_connection() as db:
        row = db.execute("SELECT status,processing_stage,processing_error FROM documents WHERE id=?", (document_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Document not found")
    return {"status": row["status"], "stage": row["processing_stage"], "error": row["processing_error"]}


@router.patch("/api/documents/{document_id}")
def update_document(document_id: str, payload: DocumentUpdate):
    with get_connection() as db:
        if payload.collectionId and not db.execute("SELECT 1 FROM collections WHERE id=?", (payload.collectionId,)).fetchone():
            raise HTTPException(404, "Collection not found")
        cursor = db.execute("UPDATE documents SET collection_id=? WHERE id=?",
                            (payload.collectionId, document_id))
        if not cursor.rowcount:
            raise HTTPException(404, "Document not found")
        db.execute("DELETE FROM document_collections WHERE document_id=?", (document_id,))
        if payload.collectionId:
            db.execute("INSERT INTO document_collections(document_id,collection_id) VALUES(?,?)",
                       (document_id, payload.collectionId))
    return {"ok": True}


@router.post("/api/documents/{document_id}/collections/{collection_id}")
def add_document_to_collection(document_id: str, collection_id: str):
    with get_connection() as db:
        if not db.execute("SELECT 1 FROM collections WHERE id=?", (collection_id,)).fetchone():
            raise HTTPException(404, "Collection not found")
        if not db.execute("SELECT 1 FROM documents WHERE id=?", (document_id,)).fetchone():
            raise HTTPException(404, "Document not found")
        db.execute("INSERT OR IGNORE INTO document_collections(document_id,collection_id) VALUES(?,?)",
                   (document_id, collection_id))
        db.execute("UPDATE documents SET collection_id=? WHERE id=? AND collection_id IS NULL",
                   (collection_id, document_id))
    return {"ok": True}


@router.delete("/api/documents/{document_id}/collections/{collection_id}")
def remove_document_from_collection(document_id: str, collection_id: str):
    with get_connection() as db:
        db.execute("DELETE FROM document_collections WHERE document_id=? AND collection_id=?",
                   (document_id, collection_id))
        remaining = db.execute("SELECT collection_id FROM document_collections WHERE document_id=? ORDER BY collection_id LIMIT 1",
                               (document_id,)).fetchone()
        db.execute("UPDATE documents SET collection_id=? WHERE id=?",
                   (remaining["collection_id"] if remaining else None, document_id))
    return {"ok": True}


@router.delete("/api/documents/{document_id}")
def delete_document(document_id: str):
    with get_connection() as db:
        row = db.execute("SELECT file_path FROM documents WHERE id=?", (document_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Document not found")
        cursor = db.execute("DELETE FROM documents WHERE id=?", (document_id,))
        if not cursor.rowcount:
            raise HTTPException(404, "Document not found")
    try:
        delete_pdf_file(row["file_path"])
    except OSError:
        # The row is deleted; an orphaned file can be safely cleaned up later.
        pass
    return {"ok": True}
