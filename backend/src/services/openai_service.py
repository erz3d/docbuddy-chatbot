
from openai import AsyncOpenAI

from src.config import API_KEY, MODEL, SYSTEM_PROMPT

client = AsyncOpenAI(api_key=API_KEY)


async def generate_response(messages: list[dict]) -> str:
    response = await client.responses.create(
        model=MODEL,
        instructions=SYSTEM_PROMPT,
        input=messages,
    )

    return response.output_text
