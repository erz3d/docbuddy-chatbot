# Split extracted pages into chunks, embed them, and persist the local search index.

import logging
import struct

from src.config import EMBEDDING_MODEL
from src.database import get_connection
from src.services.openai_clients import sync_client

CHUNK_SIZE = 2400
CHUNK_OVERLAP = 300
EMBEDDING_BATCH_SIZE = 32

def split_page_into_chunks(text: str) -> list[str]:
    # Split page text into overlapping, word-boundary chunks for semantic search.
    normalized_text = " ".join(text.split())
    chunks = []
    start = 0

    while start < len(normalized_text):
        end = min(start + CHUNK_SIZE, len(normalized_text))
        if end < len(normalized_text):
            boundary = normalized_text.rfind(" ", start + CHUNK_SIZE // 2, end)
            if boundary > start:
                end = boundary

        chunk = normalized_text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(normalized_text):
            break
        start = max(start + 1, end - CHUNK_OVERLAP)

    return chunks


def index_document(document_id: str) -> None:
    # Embed a document's extracted pages and atomically replace its search index.
    with get_connection() as db:
        document = db.execute("SELECT id FROM documents WHERE id=?", (document_id,)).fetchone()
        if not document:
            return
        pages = db.execute(
            "SELECT page_number,text FROM document_pages WHERE document_id=? ORDER BY page_number",
            (document_id,),
        ).fetchall()
        db.execute(
            "UPDATE documents SET status='uploading',processing_stage='indexing',processing_error=NULL WHERE id=?",
            (document_id,),
        )

    chunks = [
        (page["page_number"], index, chunk)
        for page in pages
        for index, chunk in enumerate(split_page_into_chunks(page["text"]))
    ]
    if not chunks:
        _mark_indexing_failed(document_id, "No extracted text was available to build a search index.")
        return

    try:
        indexed_chunks = []
        for offset in range(0, len(chunks), EMBEDDING_BATCH_SIZE):
            batch = chunks[offset : offset + EMBEDDING_BATCH_SIZE]
            response = sync_client.embeddings.create(
                model=EMBEDDING_MODEL,
                input=[chunk[2] for chunk in batch],
                encoding_format="float",
            )
            embeddings = sorted(response.data, key=lambda item: item.index)
            if len(embeddings) != len(batch):
                raise ValueError("The embedding service returned an incomplete batch.")

            for (page_number, chunk_index, text), result in zip(batch, embeddings):
                vector = result.embedding
                embedding_blob = struct.pack(f"<{len(vector)}f", *vector)
                indexed_chunks.append(
                    (document_id, page_number, chunk_index, text, embedding_blob, EMBEDDING_MODEL)
                )

        with get_connection() as db:
            db.execute("DELETE FROM document_chunks WHERE document_id=?", (document_id,))
            db.executemany(
                """INSERT INTO document_chunks
                   (document_id,page_number,chunk_index,text,embedding,embedding_model)
                   VALUES(?,?,?,?,?,?)""",
                indexed_chunks,
            )
            db.execute(
                "UPDATE documents SET status='ready',processing_stage='indexed',processing_error=NULL WHERE id=?",
                (document_id,),
            )
    except Exception:
        logging.exception("Could not build document search index for %s", document_id)
        _mark_indexing_failed(
            document_id,
            "Could not index this PDF. Check OpenAI settings and connectivity, then upload it again.",
        )


def _mark_indexing_failed(document_id: str, message: str) -> None:
    # Mark the document unavailable for chat and store a user-facing index error.
    with get_connection() as db:
        db.execute(
            "UPDATE documents SET status='failed',processing_stage='failed',processing_error=? WHERE id=?",
            (message, document_id),
        )
