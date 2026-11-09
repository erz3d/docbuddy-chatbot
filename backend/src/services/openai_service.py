from openai import AsyncOpenAI

from src.config import API_KEY, MODEL, SYSTEM_PROMPT
from src.database import get_connection

client = AsyncOpenAI(api_key=API_KEY)


def build_context(document_ids: list[str]) -> str:
    parts = []
    with get_connection() as db:
        for doc_id in document_ids:
            doc = db.execute("SELECT name FROM documents WHERE id=?", (doc_id,)).fetchone()
            if not doc:
                continue
            pages = db.execute("SELECT page_number,text FROM document_pages WHERE document_id=? ORDER BY page_number", (doc_id,)).fetchall()
            for page in pages:
                parts.append(f"[{doc['name']} | page {page['page_number']}]\n{page['text']}")
    return "\n\n".join(parts)


async def generate_response(
    messages: list[dict], document_ids: list[str] | None = None
) -> str:
    instructions = SYSTEM_PROMPT

    context = build_context(document_ids or [])
    if context:
        instructions += (
            "\n\nBase your answer exclusively on the documents below. "
            "Cite the source in the format [name | page N]."
            "If the answer isn't there, say it.\n\n" + context
        )

    response = await client.responses.create( model=MODEL, instructions=instructions,input=messages,)

    return response.output_text
