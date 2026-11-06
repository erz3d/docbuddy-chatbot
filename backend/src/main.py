
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.documents import router as documents_router
from src.api.chat import router as chat_router


# Create FastAPI application
app = FastAPI(title="DocBuddy API")


# Configure CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# Register chat routes
app.include_router(chat_router)
app.include_router(documents_router)

# Health check endpoint
@app.get("/api/health")
async def health():
    return {"status": "ok"}
