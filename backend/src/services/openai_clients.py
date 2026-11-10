# Share configured synchronous and asynchronous OpenAI clients across services.

from openai import AsyncOpenAI, OpenAI

from src.config import API_KEY

async_client = AsyncOpenAI(api_key=API_KEY)
sync_client = OpenAI(api_key=API_KEY)
