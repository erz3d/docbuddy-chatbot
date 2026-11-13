# Embed questions and retrieve page-aware document chunks from SQLite.

import math
import struct
from dataclasses import dataclass

from src.config import EMBEDDING_MODEL
from src.database import get_connection
from src.services.openai_clients import async_client

RETRIEVAL_LIMIT = 6


@dataclass(frozen=True)
class RetrievedChunk:
    # Keep source details alongside each excerpt selected for a response.

    document_id: str
    document_name: str
    page_number: int
    text: str
    score: float
    label: str | None = None


async def retrieve_relevant_chunks(question: str, document_ids: list[str]) -> list[RetrievedChunk]:
    # Embed the question and rank chunks from only the selected documents.
    selected_ids = list(dict.fromkeys(document_ids))
    if not selected_ids or not question.strip():
        return []

    placeholders = ",".join("?" for _ in selected_ids)
    with get_connection() as db:
        rows = db.execute(
            f"""SELECT c.document_id,d.name,c.page_number,c.text,c.embedding,p.label
                FROM document_chunks c JOIN documents d ON d.id=c.document_id
                LEFT JOIN document_pages p
                  ON p.document_id=c.document_id AND p.page_number=c.page_number
                WHERE d.status='ready' AND c.embedding_model=?
                  AND c.document_id IN ({placeholders})""",
            [EMBEDDING_MODEL, *selected_ids],
        ).fetchall()
    if not rows:
        return []

    query_response = await async_client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=question,
        encoding_format="float",
    )
    query_vector = query_response.data[0].embedding
    query_norm = math.sqrt(sum(value * value for value in query_vector))
    if query_norm == 0:
        return []

    scored_chunks = []
    for row in rows:
        # Stored vectors are little-endian float32 values for compact SQLite storage.
        dimension = len(row["embedding"]) // 4
        if dimension != len(query_vector):
            continue
        vector = struct.unpack(f"<{dimension}f", row["embedding"])
        vector_norm = math.sqrt(sum(value * value for value in vector))
        if vector_norm == 0:
            continue
        score = sum(left * right for left, right in zip(query_vector, vector)) / (query_norm * vector_norm)
        scored_chunks.append(
            RetrievedChunk(
                document_id=row["document_id"],
                document_name=row["name"],
                page_number=row["page_number"],
                text=row["text"],
                score=score,
                label=row["label"],
            )
        )

    return sorted(scored_chunks, key=lambda chunk: chunk.score, reverse=True)[:RETRIEVAL_LIMIT]


def format_retrieved_context(chunks: list[RetrievedChunk]) -> str:
    return "\n\n".join(_format_chunk(chunk) for chunk in chunks)


def _format_chunk(chunk: RetrievedChunk) -> str:
    # Word sections are cited by section number; PDF pages by page number.
    if chunk.label:
        return f"[{chunk.document_name} | section {chunk.page_number}]\nSection: {chunk.label}\n{chunk.text}"
    return f"[{chunk.document_name} | page {chunk.page_number}]\n{chunk.text}"