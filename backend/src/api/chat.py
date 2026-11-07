
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

class ChatRequest(BaseModel):
    messages: list[IncomingMessage]
    documentIds: list[str] = []
    conversationId: str


@router.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not request.messages:
        raise HTTPException(
            status_code=400,
            detail="messages manquants",
        )

    try:
        messages = [
            {
                "role": message.role,
                "content": message.content,
            }
            for message in request.messages
        ]

        answer = await generate_response(messages, request.documentIds)
        answer_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        with get_connection() as db:
            if not db.execute("SELECT 1 FROM conversations WHERE id=?", (request.conversationId,)).fetchone():
                raise HTTPException(404, "Conversation not found")
            db.execute("DELETE FROM messages WHERE conversation_id=?", (request.conversationId,))
            document_ids = list(dict.fromkeys(request.documentIds))
            db.execute("DELETE FROM conversation_documents WHERE conversation_id=?", (request.conversationId,))
            for document_id in document_ids:
                if db.execute("SELECT 1 FROM documents WHERE id=?", (document_id,)).fetchone():
                    db.execute("INSERT INTO conversation_documents(conversation_id,document_id) VALUES(?,?)",
                               (request.conversationId, document_id))
                    db.execute("INSERT OR IGNORE INTO conversation_document_history(conversation_id,document_id) VALUES(?,?)",
                               (request.conversationId, document_id))
            for item in request.messages:
                stamp = (datetime.fromtimestamp(item.timestamp / 1000, timezone.utc).isoformat()
                         if isinstance(item.timestamp, int) else item.timestamp or now)
                db.execute("INSERT INTO messages(id,conversation_id,role,content,liked,created_at) VALUES(?,?,?,?,?,?)",
                           (item.id or str(uuid.uuid4()), request.conversationId, item.role, item.content,
                            None if item.liked is None else int(item.liked),
                            stamp))
            db.execute("INSERT INTO messages(id,conversation_id,role,content,created_at) VALUES(?,?,?,?,?)",
                       (answer_id, request.conversationId, "assistant", answer, now))
            first_user = next((m.content for m in request.messages if m.role == "user"), "New conversation")
            db.execute("UPDATE conversations SET title=?,updated_at=? WHERE id=?",
                       (first_user[:70], now, request.conversationId))
        return {"content": answer, "id": answer_id, "timestamp": now}

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
