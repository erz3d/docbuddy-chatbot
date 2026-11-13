# Load required OpenAI settings and the assistant's base instructions.

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]

load_dotenv(BACKEND_DIR / ".env")

API_KEY = os.getenv("OPENAI_API_KEY")
MODEL = os.getenv("OPENAI_MODEL")
EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
# Optional OCR settings: path to the tesseract binary if it is not on PATH, and language codes like "eng+fra".
TESSERACT_CMD = os.getenv("TESSERACT_CMD")
OCR_LANGUAGES = os.getenv("OCR_LANGUAGES", "eng")

if not API_KEY or not MODEL:
    raise RuntimeError(
        "Missing OPENAI_API_KEY or OPENAI_MODEL in backend/.env"
    )

SYSTEM_PROMPT = (
    "You are DocBuddy, an assistant that helps "
    "people understand documents."
)
