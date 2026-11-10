import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.database import get_connection

router = APIRouter()


class CollectionInput(BaseModel):
    name: str
    color: str = "#11C5AD"


class CollectionUpdate(BaseModel):
    favorite: bool | None = None


@router.get("/api/collections")
def list_collections():
    with get_connection() as db:
        rows = db.execute("SELECT * FROM collections ORDER BY created_at, name").fetchall()
    return [{"id": row["id"], "name": row["name"], "color": row["color"],
             "icon": row["icon"], "favorite": bool(row["favorite"])} for row in rows]


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
