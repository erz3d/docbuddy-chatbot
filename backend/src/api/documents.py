import uuid
import os
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pypdf import PdfReader

from src.database import DOCUMENTS_DIR, get_connection

router = APIRouter()


class CollectionInput(BaseModel):
    name: str
    color: str = "#11C5AD"


class CollectionUpdate(BaseModel):
    favorite: bool | None = None


class DocumentUpdate(BaseModel):
    collectionId: str | None


@router.get("/api/collections")
def list_collections():
    with get_connection() as db:
        rows = db.execute("SELECT * FROM collections ORDER BY created_at, name").fetchall()
    return [{"id": r["id"], "name": r["name"], "color": r["color"],
             "icon": r["icon"], "favorite": bool(r["favorite"])} for r in rows]


@router.post("/api/collections")
def create_collection(payload: CollectionInput):
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Collection name is required")
    item = {"id": str(uuid.uuid4()), "name": name, "color": payload.color,
            "icon": "folder", "favorite": False}
    with get_connection() as db:
        db.execute("INSERT INTO collections (id,name,color,icon,favorite) VALUES (?,?,?,?,0)",
                   (item["id"], name, item["color"], item["icon"]))
    return item


@router.patch("/api/collections/{collection_id}")
def update_collection(collection_id: str, payload: CollectionUpdate):
    if payload.favorite is None:
        raise HTTPException(400, "No collection changes provided")
    with get_connection() as db:
        cursor = db.execute("UPDATE collections SET favorite=? WHERE id=?",
                            (int(payload.favorite), collection_id))
        if not cursor.rowcount:
            raise HTTPException(404, "Collection not found")
    return {"ok": True}


@router.get("/api/documents")
def list_documents():
    with get_connection() as db:
        rows = db.execute("SELECT id,name,size_bytes,collection_id,status,processing_error,added_at FROM documents ORDER BY added_at DESC").fetchall()
        memberships = db.execute("SELECT document_id, collection_id FROM document_collections").fetchall()
    by_document: dict[str, list[str]] = {}
    for membership in memberships:
        by_document.setdefault(membership["document_id"], []).append(membership["collection_id"])
    return [{"id": r["id"], "name": r["name"], "size": r["size_bytes"],
             "collectionId": r["collection_id"], "collectionIds": by_document.get(r["id"], []), "status": r["status"],
             "error": r["processing_error"],
             "addedAt": r["added_at"]} for r in rows]


def extract_document_text(document_id: str) -> None:
    """Extract page text after upload has been saved and acknowledged."""
    with get_connection() as db:
        row = db.execute("SELECT file_path FROM documents WHERE id=?", (document_id,)).fetchone()
    if not row:
        return
    try:
        file_path = Path(row["file_path"])
        reader = PdfReader(str(file_path))
        pages = [(page.extract_text() or "") for page in reader.pages]
        if not pages:
            raise ValueError("The PDF contains no pages.")
        with get_connection() as db:
            db.execute("DELETE FROM document_pages WHERE document_id=?", (document_id,))
            db.executemany(
                "INSERT INTO document_pages(document_id,page_number,text) VALUES(?,?,?)",
                [(document_id, page_number, text) for page_number, text in enumerate(pages, 1)],
            )
            db.execute("UPDATE documents SET status='ready',processing_error=NULL WHERE id=?", (document_id,))
    except Exception as exc:
        with get_connection() as db:
            db.execute(
                "UPDATE documents SET status='failed',processing_error=? WHERE id=?",
                (str(exc)[:500] or "Could not extract text from this PDF.", document_id),
            )


@router.post("/api/documents")
async def upload_document(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if file.content_type != "application/pdf" and not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "PDF only")
    doc_id = str(uuid.uuid4())
    name = file.filename or "document.pdf"
    DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
    document_path = DOCUMENTS_DIR / f"{doc_id}.pdf"
    temporary_path = document_path.with_suffix(".uploading")
    size = 0
    try:
        with temporary_path.open("wb") as destination:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                destination.write(chunk)
        if size == 0:
            raise HTTPException(400, "The PDF file is empty.")
        os.replace(temporary_path, document_path)
        with get_connection() as db:
            db.execute("INSERT INTO documents (id,name,size_bytes,file_path,status) VALUES (?,?,?,?,'uploading')",
                       (doc_id, name, size, str(document_path)))
    except HTTPException:
        temporary_path.unlink(missing_ok=True)
        document_path.unlink(missing_ok=True)
        raise
    except OSError as exc:
        temporary_path.unlink(missing_ok=True)
        document_path.unlink(missing_ok=True)
        raise HTTPException(500, "Could not save the uploaded PDF to disk.") from exc
    except Exception:
        temporary_path.unlink(missing_ok=True)
        document_path.unlink(missing_ok=True)
        raise
    background_tasks.add_task(extract_document_text, doc_id)
    return {"id": doc_id, "name": name, "size": size, "status": "uploading"}


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
        row = db.execute("SELECT status,processing_error FROM documents WHERE id=?", (document_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Document not found")
    return {"status": row["status"], "error": row["processing_error"]}


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
    if row["file_path"]:
        try:
            Path(row["file_path"]).unlink(missing_ok=True)
        except OSError:
            # The row is deleted; an orphaned file can be safely cleaned up later.
            pass
    return {"ok": True}
