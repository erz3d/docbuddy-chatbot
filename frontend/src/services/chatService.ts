
// Send chat history, selected documents, and cancellation to the chat API.

import type { ChatMessage, Citation, PythonExecution } from "../types";
import { api } from "./api";

// Submit a chat turn and return the saved assistant message details.
export async function askModel(messages: ChatMessage[], documentIds: string[], conversationId: string | null, signal?: AbortSignal): Promise<{ content: string; id: string; timestamp: string; conversationId: string; citations: Citation[]; pythonExecutions?: PythonExecution[] }> {
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
