
import type { ChatMessage } from "../types";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001";

export async function askModel(
  messages: ChatMessage[],
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: messages.map(({ role, content }) => ({
        role,
        content,
      })),
    }),
    signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));

    throw new Error(
      data.detail ??
      data.error ??
      `Server error (${response.status})`
    );
  }

  const data: { content: string } = await response.json();

  return data.content;
}
