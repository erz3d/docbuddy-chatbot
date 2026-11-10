
# Build the FastAPI app, configure startup recovery, and register API routes.

import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.chat import router as chat_router
from src.api.collections import router as collections_router
from src.api.conversations import router as conversations_router
from src.api.documents import router as documents_router
from src.api.settings import router as settings_router
from src.database import get_connection, initialize_database
from src.services.document_processing import process_document


# Create FastAPI application
app = FastAPI(title="DocBuddy API")


@app.on_event("startup")
async def startup() -> None:
    # Initialize storage and resume document extraction left in progress.
    initialize_database()
    with get_connection() as db:
        pending_ids = [row["id"] for row in db.execute("SELECT id FROM documents WHERE status='uploading'")]
    for document_id in pending_ids:
        asyncio.create_task(asyncio.to_thread(process_document, document_id))


# Configure CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)


# Register chat routes
app.include_router(chat_router)
app.include_router(collections_router)
app.include_router(documents_router)
app.include_router(conversations_router)
app.include_router(settings_router)

# Health check endpoint
@app.get("/api/health")
async def health():
    # Report that the local backend is responding.
    return {"status": "ok"}
