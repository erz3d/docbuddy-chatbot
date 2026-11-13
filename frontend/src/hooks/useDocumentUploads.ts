// Manage library uploads, staged chat attachments, and their processing state.

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { DocumentItem } from "../types";
import { documentFileUrl } from "../services/api";
import { uploadDocument, waitForDocumentProcessing, isSupportedUpload } from "../services/documentService";

type SetDocuments = Dispatch<SetStateAction<DocumentItem[]>>;
type SetPinnedDocuments = (ids: string[], persist?: boolean) => void;

interface UseDocumentUploadsOptions {
  documents: DocumentItem[];
  setDocuments: SetDocuments;
  pendingUploadsRef: MutableRefObject<Map<string, File>>;
  selectedIdsRef: MutableRefObject<string[]>;
  setPinnedDocuments: SetPinnedDocuments;
}

function createId() {
  // Generate a temporary ID for a document before the server assigns one.
  return crypto.randomUUID();
}

// Provide upload actions while synchronizing document and pinned-chat state.
export function useDocumentUploads({
  documents,
  setDocuments,
  pendingUploadsRef,
  selectedIdsRef,
  setPinnedDocuments,
}: UseDocumentUploadsOptions) {
  // Upload library files immediately or stage chat attachments until send.
  const uploadFiles = (files: FileList | null, fromLibrary = false) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!isSupportedUpload(file.name)) {
        window.alert(`${file.name}: unsupported file type. Please upload a PDF or a Word (.docx) document.`);
        return;
      }

      const id = createId();
      const localUrl = URL.createObjectURL(file);
      const newDocument: DocumentItem = {
        id,
        name: file.name,
        size: file.size,
        status: fromLibrary ? "uploading" : "ready",
        stage: "uploading",
        collectionId: null,
        url: localUrl,
        addedAt: Date.now(),
        pending: !fromLibrary,
      };
      setDocuments((current) => [...current, newDocument]);

      if (!fromLibrary) {
        pendingUploadsRef.current.set(id, file);
        setPinnedDocuments([...new Set([...selectedIdsRef.current, id])], false);
        return;
      }

      void uploadDocument(file)
        .then(async ({ id: backendId, name, size, status, stage }) => {
          URL.revokeObjectURL(localUrl);
          setDocuments((current) => current.map((doc) => doc.id === id
            ? { ...doc, id: backendId, backendId, name, size, url: documentFileUrl(backendId), status, stage, pending: false }
            : doc));
          try {
            await waitForDocumentProcessing(backendId, (nextStatus, nextStage, error) => {
              setDocuments((current) => current.map((doc) => doc.id === backendId
                ? { ...doc, status: nextStatus, stage: nextStage, error: error ?? null }
                : doc));
            });
          } catch (error) {
            setDocuments((current) => current.map((doc) => doc.id === backendId
              ? { ...doc, status: "failed", stage: "failed", error: String(error) }
              : doc));
          }
        })
        .catch((error) => setDocuments((current) => current.map((doc) => doc.id === id
          ? { ...doc, status: "failed", stage: "failed", pending: false, error: String(error) }
          : doc)));
    });
  };

  // Upload staged attachments and replace temporary IDs with server IDs.
  const uploadPendingDocuments = async () => {
    const pendingIds = selectedIdsRef.current.filter((id) => pendingUploadsRef.current.has(id));
    const resolvedIds = new Map<string, string>();

    for (const pendingId of pendingIds) {
      const file = pendingUploadsRef.current.get(pendingId);
      if (!file) continue;
      const uploaded = await uploadDocument(file).catch((error: unknown) => {
        setDocuments((current) => current.map((doc) => doc.id === pendingId
          ? { ...doc, status: "failed", stage: "failed", error: String(error) }
          : doc));
        throw error;
      });
      resolvedIds.set(pendingId, uploaded.id);
      const localDocument = documents.find((doc) => doc.id === pendingId);
      if (localDocument?.url) URL.revokeObjectURL(localDocument.url);
      pendingUploadsRef.current.delete(pendingId);
      setDocuments((current) => current.map((doc) => doc.id === pendingId
        ? { ...doc, id: uploaded.id, backendId: uploaded.id, name: uploaded.name, size: uploaded.size, url: documentFileUrl(uploaded.id), pending: false, status: uploaded.status, stage: uploaded.stage }
        : doc));
      setPinnedDocuments(selectedIdsRef.current.map((id) => resolvedIds.get(id) ?? id), false);

      try {
        await waitForDocumentProcessing(uploaded.id, (status, stage, error) => {
          setDocuments((current) => current.map((doc) => doc.id === uploaded.id
            ? { ...doc, status, stage, error: error ?? null }
            : doc));
        });
      } catch (error) {
        setDocuments((current) => current.map((doc) => doc.id === uploaded.id
          ? { ...doc, status: "failed", stage: "failed", error: String(error) }
          : doc));
        setPinnedDocuments(selectedIdsRef.current.filter((id) => id !== uploaded.id), false);
        throw error;
      }
    }

    return resolvedIds;
  };

  // Release staged file URLs and remove attachments that were not sent.
  const discardPendingUploads = () => {
    pendingUploadsRef.current.forEach((_, id) => {
      const document = documents.find((item) => item.id === id);
      if (document?.url) URL.revokeObjectURL(document.url);
    });
    const pendingIds = new Set(pendingUploadsRef.current.keys());
    pendingUploadsRef.current.clear();
    setDocuments((current) => current.filter((doc) => !pendingIds.has(doc.id)));
  };

  return {
    pendingUploadsRef,
    uploadFiles,
    uploadPendingDocuments,
    discardPendingUploads,
  };
}
