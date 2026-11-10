import uuid
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from src.database import get_connection
from src.services.conversation_service import MissingDocumentsError, persist_conversation_history

router = APIRouter()


@router.get("/api/conversations")
def list_conversations(archived: bool = Query(False)):
    with get_connection() as db:
        rows = db.execute("""SELECT c.id,c.title,c.created_at,c.updated_at,
            (SELECT content FROM messages WHERE conversation_id=c.id ORDER BY created_at DESC LIMIT 1) preview
            FROM conversations c WHERE c.archived=? ORDER BY c.updated_at DESC""", (int(archived),)).fetchall()
        document_rows = db.execute("SELECT conversation_id,document_id FROM conversation_document_history").fetchall()
    documents_by_chat: dict[str, list[str]] = {}
    for row in document_rows:
        documents_by_chat.setdefault(row["conversation_id"], []).append(row["document_id"])
    return [{"id": r["id"], "title": r["title"], "updatedAt": r["updated_at"],
             "preview": r["preview"] or "", "documentIds": documents_by_chat.get(r["id"], [])} for r in rows]


@router.post("/api/conversations")
def create_conversation():
    conversation_id = str(uuid.uuid4())
    with get_connection() as db:
        db.execute("INSERT INTO conversations(id,title) VALUES(?, 'New conversation')", (conversation_id,))
    return {"id": conversation_id, "title": "New conversation"}


@router.get("/api/conversations/{conversation_id}")
def get_conversation(conversation_id: str):
    with get_connection() as db:
        exists = db.execute("SELECT id FROM conversations WHERE id=?", (conversation_id,)).fetchone()
        if not exists:
            raise HTTPException(404, "Conversation not found")
        messages = db.execute("SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at, rowid", (conversation_id,)).fetchall()
        document_ids = [r["document_id"] for r in db.execute(
            "SELECT document_id FROM conversation_documents WHERE conversation_id=? ORDER BY pinned_at, document_id",
            (conversation_id,),
        ).fetchall()]
        result = []
        for m in messages:
            citations = db.execute("SELECT document_id,document_name,page FROM citations WHERE message_id=?", (m["id"],)).fetchall()
            result.append({"id": m["id"], "role": m["role"], "content": m["content"],
                           "liked": None if m["liked"] is None else bool(m["liked"]),
                           "timestamp": m["created_at"],
                           "citations": [{"documentId": c["document_id"], "documentName": c["document_name"], "page": c["page"]} for c in citations]})
    return {"id": conversation_id, "messages": result, "documentIds": document_ids}


class PinnedDocuments(BaseModel):
    documentIds: list[str]


class DraftMessage(BaseModel):
    id: str | None = None
    role: Literal["user", "assistant"]
    content: str
    liked: bool | None = None
    timestamp: str | int | None = None


class ConversationDraft(BaseModel):
    messages: list[DraftMessage]
    documentIds: list[str] = []


@router.put("/api/conversations/{conversation_id}/draft")
def save_conversation_draft(conversation_id: str, payload: ConversationDraft):
    try:
        persist_conversation_history(
            conversation_id,
            payload.messages,
            payload.documentIds,
            require_documents=True,
        )
    except MissingDocumentsError as exc:
        raise HTTPException(404, str(exc)) from exc
    return {"id": conversation_id, "saved": True}


class ConversationRename(BaseModel):
    title: str


@router.patch("/api/conversations/{conversation_id}")
def rename_conversation(conversation_id: str, payload: ConversationRename):
    title = payload.title.strip()
    if not title:
        raise HTTPException(400, "Conversation title is required")
    with get_connection() as db:
        cursor = db.execute("UPDATE conversations SET title=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
                            (title[:120], conversation_id))
        if not cursor.rowcount:
            raise HTTPException(404, "Conversation not found")
    return {"id": conversation_id, "title": title[:120]}


class ArchiveUpdate(BaseModel):
    archived: bool


@router.patch("/api/conversations/{conversation_id}/archive")
def set_conversation_archived(conversation_id: str, payload: ArchiveUpdate):
    with get_connection() as db:
        cursor = db.execute("UPDATE conversations SET archived=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
                            (int(payload.archived), conversation_id))
        if not cursor.rowcount:
            raise HTTPException(404, "Conversation not found")
    return {"id": conversation_id, "archived": payload.archived}


@router.delete("/api/conversations/{conversation_id}")
def delete_conversation(conversation_id: str):
    with get_connection() as db:
        cursor = db.execute("DELETE FROM conversations WHERE id=?", (conversation_id,))
        if not cursor.rowcount:
            raise HTTPException(404, "Conversation not found")
    return {"ok": True}


@router.put("/api/conversations/{conversation_id}/documents")
def set_pinned_documents(conversation_id: str, payload: PinnedDocuments):
    document_ids = list(dict.fromkeys(payload.documentIds))
    with get_connection() as db:
        if not db.execute("SELECT 1 FROM conversations WHERE id=?", (conversation_id,)).fetchone():
            raise HTTPException(404, "Conversation not found")
        if document_ids:
            placeholders = ",".join("?" for _ in document_ids)
            found = db.execute(f"SELECT id FROM documents WHERE id IN ({placeholders})", document_ids).fetchall()
            if len(found) != len(document_ids):
                raise HTTPException(404, "One or more documents were not found")
        db.execute("DELETE FROM conversation_documents WHERE conversation_id=?", (conversation_id,))
        db.executemany("INSERT INTO conversation_documents(conversation_id,document_id) VALUES(?,?)",
                       [(conversation_id, document_id) for document_id in document_ids])
        db.executemany("INSERT OR IGNORE INTO conversation_document_history(conversation_id,document_id) VALUES(?,?)",
                       [(conversation_id, document_id) for document_id in document_ids])
        db.execute("UPDATE conversations SET updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?", (conversation_id,))
    return {"documentIds": document_ids}


class MessageUpdate(BaseModel):
    liked: bool | None


@router.patch("/api/conversations/{conversation_id}/messages/{message_id}")
def update_message_feedback(conversation_id: str, message_id: str, payload: MessageUpdate):
    with get_connection() as db:
        cursor = db.execute("UPDATE messages SET liked=? WHERE id=? AND conversation_id=?",
                            (None if payload.liked is None else int(payload.liked), message_id, conversation_id))
        if not cursor.rowcount:
            raise HTTPException(404, "Message not found")
    return {"ok": True}


@router.delete("/api/conversations/{conversation_id}/messages")
def clear_messages(conversation_id: str):
    with get_connection() as db:
        if not db.execute("SELECT 1 FROM conversations WHERE id=?", (conversation_id,)).fetchone():
            raise HTTPException(404, "Conversation not found")
        db.execute("DELETE FROM messages WHERE conversation_id=?", (conversation_id,))
        db.execute("DELETE FROM conversation_documents WHERE conversation_id=?", (conversation_id,))
        db.execute("UPDATE conversations SET title='New conversation' WHERE id=?", (conversation_id,))
    return {"ok": True}
