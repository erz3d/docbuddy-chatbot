
import logging
from typing import Literal

from fastapi import APIRouter, HTTPException
from openai import APIError
from pydantic import BaseModel

from src.services.openai_service import generate_response

router = APIRouter()


class IncomingMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[IncomingMessage]


class ChatResponse(BaseModel):
    content: str

class ChatRequest(BaseModel):
    messages: list[IncomingMessage]
    documentIds: list[str] = []


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

        return ChatResponse(content=answer)

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
