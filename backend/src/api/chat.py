
# Validate chat requests, persist submitted history, and return model replies.

import logging
import uuid
from typing import Literal

from fastapi import APIRouter, HTTPException
from openai import APIError
from pydantic import BaseModel, Field

from src.services.conversation_service import persist_assistant_message, persist_conversation_history
from src.services.openai_service import generate_response

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
    documentIds: list[str] = Field(default_factory=list)
    conversationId: str | None = None


@router.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    # Save the conversation, generate an answer, and persist the assistant reply.
    if not request.messages:
        raise HTTPException(
            status_code=400,
            detail="messages manquants",
        )

    try:
        conversation_id = request.conversationId or str(uuid.uuid4())
        answer_id = str(uuid.uuid4())

        # Persist the submitted history before waiting on the model so a failed
        # or interrupted model request does not discard the user's messages.
        persist_conversation_history(
            conversation_id,
            request.messages,
            request.documentIds,
            require_documents=False,
        )

        messages = [{"role": message.role, "content": message.content} for message in request.messages]
        answer = await generate_response(messages, request.documentIds)
        answer_time = persist_assistant_message(conversation_id, answer_id, answer)
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
