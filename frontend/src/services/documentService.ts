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

export async function uploadDocument(
  file: File
): Promise<UploadedDocument> {
  const formData = new FormData();
  formData.append("file", file);

  return api<UploadedDocument>("/api/documents", {
    method: "POST",
    body: formData,
  });
}

export async function waitForDocumentProcessing(
  documentId: string,
  onStatus?: (status: "ready" | "uploading" | "failed", stage: DocumentProcessingStage, error?: string | null) => void,
): Promise<void> {
  for (let attempt = 0; attempt < 600; attempt += 1) {
    let result: { status: "ready" | "uploading" | "failed"; stage: DocumentProcessingStage; error?: string | null };
    try {
      result = await api<{ status: "ready" | "uploading" | "failed"; stage: DocumentProcessingStage; error?: string | null }>(
        `/api/documents/${documentId}/status`,
      );
    } catch (error) {
      if (attempt === 599) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      continue;
    }
    onStatus?.(result.status, result.stage, result.error);
    if (result.status === "ready") return;
    if (result.status === "failed") {
      throw new Error(result.error || "Document processing failed.");
    }
    await new Promise((resolve) => window.setTimeout(resolve, 500));
  }
  throw new Error("Document processing is taking too long. Check its status in the document library.");
}
