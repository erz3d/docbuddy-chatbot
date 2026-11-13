// Share the app's core data shapes across views, hooks, and API services.

export type Theme = "dark" | "light";

export type Page = "chat" | "documents" | "settings" | "archive" | "history";
export type DocumentProcessingStage =
  | "uploading"
  | "extracting"
  | "ocr"
  | "ready_for_indexing"
  | "indexing"
  | "indexed"
  | "failed";

export interface DocumentItem {
  id: string;
  backendId?: string;
  pending?: boolean;
  name: string;
  size: number;
  status: "ready" | "uploading" | "failed";
  stage?: DocumentProcessingStage;
  error?: string | null;
  // Page numbers whose OCR text is unreliable or missing.
  lowQualityPages?: number[];
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
  excerpt?: string;
  label?: string | null;
}

export interface PythonExecution {
  code: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  pythonExecutions?: PythonExecution[];
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
