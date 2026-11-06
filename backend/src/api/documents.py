from fastapi import APIRouter, UploadFile, HTTPException
from pypdf import PdfReader
import uuid

router = APIRouter()

# id -> {"name": ..., "pages": ["texte page 1", "texte page 2", ...]}
DOCUMENTS: dict[str, dict] = {}

@router.post("/api/documents")
async def upload_document(file: UploadFile):
    if file.content_type != "application/pdf":
        raise HTTPException(400, "PDF only")

    reader = PdfReader(file.file)
    pages = [(page.extract_text() or "") for page in reader.pages]

    doc_id = str(uuid.uuid4())
    DOCUMENTS[doc_id] = {"name": file.filename, "pages": pages}
    return {"id": doc_id, "pages": len(pages)}