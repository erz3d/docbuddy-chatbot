// Upload PDF files and poll the backend until text extraction finishes.

import { api } from "./api";
import type { DocumentProcessingStage } from "../types";

export interface UploadedDocument {
  id: string;
  name: string;
  size: number;
  status: "ready" | "uploading" | "failed";
  stage: DocumentProcessingStage;
  error?: string | null;
}

interface DocumentProcessingStatus {
  status: UploadedDocument["status"];
  stage: DocumentProcessingStage;
  error?: string | null;
}

// Pause between status checks without blocking the browser UI.
const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

// Upload a PDF as multipart form data to the document API.
export async function uploadDocument(file: File): Promise<UploadedDocument> {
  const formData = new FormData();
  formData.append("file", file);

  return api<UploadedDocument>("/api/documents", {
    method: "POST",
    body: formData,
  });
}

// Poll processing state and report updates until extraction succeeds or fails.
export async function waitForDocumentProcessing(
  documentId: string,
  onStatus?: (status: DocumentProcessingStatus["status"], stage: DocumentProcessingStage, error?: string | null) => void,
): Promise<void> {
  for (let attempt = 0; attempt < 600; attempt += 1) {
    let result: DocumentProcessingStatus;
    try {
      result = await api<DocumentProcessingStatus>(`/api/documents/${documentId}/status`);
    } catch (error) {
      if (attempt === 599) throw error;
      await delay(500);
      continue;
    }
    onStatus?.(result.status, result.stage, result.error);
    if (result.status === "ready") return;
    if (result.status === "failed") {
      throw new Error(result.error || "Document processing failed.");
    }
    await delay(500);
  }
  throw new Error("Document processing is taking too long. Check its status in the document library.");
}
