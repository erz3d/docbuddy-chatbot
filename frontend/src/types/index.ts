// Share the app's core data shapes across views, hooks, and API services.

export type Theme = "dark" | "light";

export type Page = "chat" | "documents" | "settings" | "archive" | "history";
export type DocumentProcessingStage = "uploading" | "extracting" | "ready_for_indexing" | "failed";

export interface DocumentItem {
  id: string;
  backendId?: string;
  pending?: boolean;
  name: string;
  size: number;
  status: "ready" | "uploading" | "failed";
  stage?: DocumentProcessingStage;
  error?: string | null;
  collectionId: string | null;
  collectionIds?: string[];
  url?: string;
  addedAt: number;
}

export interface Collection {
  id: string;
  name: string;
  color: string;
  icon: string;
  favorite: boolean;
}

export interface Citation {
  documentId: string;
  documentName: string;
  page: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  liked?: boolean | null;
  timestamp: number;
}

export interface ConversationItem {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  documentIds: string[];
}
