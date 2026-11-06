from openai import AsyncOpenAI

from src.api.documents import DOCUMENTS
from src.config import API_KEY, MODEL, SYSTEM_PROMPT

client = AsyncOpenAI(api_key=API_KEY)


def build_context(document_ids: list[str]) -> str:
    parts = []
    for doc_id in document_ids:
        doc = DOCUMENTS.get(doc_id)
        if not doc:
            continue
        for number, text in enumerate(doc["pages"], start=1):
            parts.append(f"[{doc['name']} | page {number}]\n{text}")
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

    response = await client.responses.create(
        model=MODEL,
        instructions=instructions,
        input=messages,
    )

    return response.output_text   