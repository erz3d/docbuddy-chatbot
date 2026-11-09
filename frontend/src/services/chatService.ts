
import type { ChatMessage } from "../types";
import { api } from "./api";

export async function askModel(messages: ChatMessage[], documentIds: string[], conversationId: string | null, signal?: AbortSignal): Promise<{ content: string; id: string; timestamp: string; conversationId: string }> {
  return api("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: messages.map(({ id, role, content, liked, timestamp }) => ({ id, role, content, liked, timestamp })),
      documentIds,
      conversationId,
    }),
    signal,
  });
}
