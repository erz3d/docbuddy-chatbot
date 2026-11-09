
import logging
import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException
from openai import APIError
from pydantic import BaseModel

from src.services.openai_service import generate_response
from src.database import get_connection

router = APIRouter()


class IncomingMessage(BaseModel):
    id: str | None = None
    role: Literal["user", "assistant"]
    content: str
    liked: bool | None = None
    timestamp: str | int | None = None


class ChatResponse(BaseModel):
    content: str
    id: str
    timestamp: str
    conversationId: str

class ChatRequest(BaseModel):
    messages: list[IncomingMessage]
    documentIds: list[str] = []
    conversationId: str | None = None


@router.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not request.messages:
        raise HTTPException(
            status_code=400,
            detail="messages manquants",
        )

    try:
        conversation_id = request.conversationId or str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        answer_id = str(uuid.uuid4())
        first_user = next((m.content for m in request.messages if m.role == "user"), "New conversation")

        # Persist the submitted history before waiting on the model so a failed
        # or interrupted model request does not discard the user's messages.
        with get_connection() as db:
            exists = db.execute("SELECT 1 FROM conversations WHERE id=?", (conversation_id,)).fetchone()
            if not exists:
                db.execute("INSERT INTO conversations(id,title) VALUES(?,?)",
                           (conversation_id, first_user[:70] or "New conversation"))
            db.execute("DELETE FROM messages WHERE conversation_id=?", (conversation_id,))
            document_ids = list(dict.fromkeys(request.documentIds))
            db.execute("DELETE FROM conversation_documents WHERE conversation_id=?", (conversation_id,))
            for document_id in document_ids:
                if db.execute("SELECT 1 FROM documents WHERE id=?", (document_id,)).fetchone():
                    db.execute("INSERT INTO conversation_documents(conversation_id,document_id) VALUES(?,?)",
                               (conversation_id, document_id))
                    db.execute("INSERT OR IGNORE INTO conversation_document_history(conversation_id,document_id) VALUES(?,?)",
                               (conversation_id, document_id))
            for item in request.messages:
                stamp = (datetime.fromtimestamp(item.timestamp / 1000, timezone.utc).isoformat()
                         if isinstance(item.timestamp, int) else item.timestamp or now)
                db.execute("INSERT INTO messages(id,conversation_id,role,content,liked,created_at) VALUES(?,?,?,?,?,?)",
                           (item.id or str(uuid.uuid4()), conversation_id, item.role, item.content,
                            None if item.liked is None else int(item.liked), stamp))
            db.execute("UPDATE conversations SET title=CASE WHEN title='New conversation' THEN ? ELSE title END,updated_at=? WHERE id=?",
                       (first_user[:70] or "New conversation", now, conversation_id))

        messages = [{"role": message.role, "content": message.content} for message in request.messages]
        answer = await generate_response(messages, request.documentIds)
        answer_time = datetime.now(timezone.utc).isoformat()
        with get_connection() as db:
            db.execute("INSERT INTO messages(id,conversation_id,role,content,created_at) VALUES(?,?,?,?,?)",
                       (answer_id, conversation_id, "assistant", answer, answer_time))
            db.execute("UPDATE conversations SET updated_at=? WHERE id=?", (answer_time, conversation_id))
        return {"content": answer, "id": answer_id, "timestamp": answer_time, "conversationId": conversation_id}

    except HTTPException:
        raise
    except APIError as error:
        logging.exception("OpenAI API error")
        raise HTTPException(
            status_code=error.status_code or 500,
            detail="OpenAI request failed",
        )

    except Exception:
        logging.exception("Unexpected backend error")
        raise HTTPException(
            status_code=500,
            detail="Internal server error",
        )
