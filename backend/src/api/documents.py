import uuid

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from pypdf import PdfReader

from src.database import get_connection

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
        rows = db.execute("SELECT id,name,size_bytes,collection_id,status,added_at FROM documents ORDER BY added_at DESC").fetchall()
        memberships = db.execute("SELECT document_id, collection_id FROM document_collections").fetchall()
    by_document: dict[str, list[str]] = {}
    for membership in memberships:
        by_document.setdefault(membership["document_id"], []).append(membership["collection_id"])
    return [{"id": r["id"], "name": r["name"], "size": r["size_bytes"],
             "collectionId": r["collection_id"], "collectionIds": by_document.get(r["id"], []), "status": r["status"],
             "addedAt": r["added_at"]} for r in rows]


@router.post("/api/documents")
async def upload_document(file: UploadFile = File(...)):
    if file.content_type != "application/pdf" and not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "PDF only")
    content = await file.read()
    try:
        import io
        reader = PdfReader(io.BytesIO(content))
        pages = [(page.extract_text() or "") for page in reader.pages]
    except Exception as exc:
        raise HTTPException(400, "Could not read this PDF") from exc
    doc_id = str(uuid.uuid4())
    name = file.filename or "document.pdf"
    with get_connection() as db:
        db.execute("INSERT INTO documents (id,name,size_bytes,content) VALUES (?,?,?,?)",
                   (doc_id, name, len(content), content))
        db.executemany("INSERT INTO document_pages(document_id,page_number,text) VALUES(?,?,?)",
                       [(doc_id, i, text) for i, text in enumerate(pages, 1)])
    return {"id": doc_id, "name": name, "size": len(content), "pages": len(pages)}


@router.get("/api/documents/{document_id}/file")
def get_document_file(document_id: str):
    with get_connection() as db:
        row = db.execute("SELECT name,content FROM documents WHERE id=?", (document_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Document not found")
    return Response(content=row["content"], media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{row["name"]}"'})


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
        cursor = db.execute("DELETE FROM documents WHERE id=?", (document_id,))
        if not cursor.rowcount:
            raise HTTPException(404, "Document not found")
    return {"ok": True}
