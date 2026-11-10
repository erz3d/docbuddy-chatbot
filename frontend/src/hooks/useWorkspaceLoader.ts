// Load saved workspace data and resume polling documents still being extracted.

import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { ChatMessage, Collection, ConversationItem, DocumentItem, Theme } from "../types";
import { api, documentFileUrl } from "../services/api";
import { waitForDocumentProcessing } from "../services/documentService";

type Setter<T> = Dispatch<SetStateAction<T>>;

interface UseWorkspaceLoaderOptions {
  setTheme: Setter<Theme>;
  setAppName: Setter<string>;
  setCollections: Setter<Collection[]>;
  setDocuments: Setter<DocumentItem[]>;
  setMessages: Setter<ChatMessage[]>;
  setConversations: Setter<ConversationItem[]>;
  setArchivedConversations: Setter<ConversationItem[]>;
  setActiveConversationId: Setter<string | null>;
  setPinnedDocuments: (ids: string[], persist?: boolean) => void;
}

// Restore settings, library data, and conversation lists when the app starts.
export function useWorkspaceLoader({
  setTheme,
  setAppName,
  setCollections,
  setDocuments,
  setMessages,
  setConversations,
  setArchivedConversations,
  setActiveConversationId,
  setPinnedDocuments,
}: UseWorkspaceLoaderOptions) {
  useEffect(() => {
    let alive = true;
    // Fetch and restore the saved workspace, then resume pending extraction.
    const loadWorkspace = async () => {
      try {
        const [savedSettings, savedCollections, savedDocuments, savedConversations, savedArchive] = await Promise.all([
          api<{ theme: Theme; appName: string }>("/api/settings"),
          api<Collection[]>("/api/collections"),
          api<Array<Omit<DocumentItem, "addedAt"> & { addedAt: string | number }>>("/api/documents"),
          api<ConversationItem[]>("/api/conversations"),
          api<ConversationItem[]>("/api/conversations?archived=true"),
        ]);
        if (!alive) return;

        setTheme(savedSettings.theme);
        setAppName(savedSettings.appName);
        setCollections(savedCollections);
        const restoredDocuments = savedDocuments.map((doc) => ({
          ...doc,
          stage: doc.stage ?? (doc.status === "failed" ? "failed" : doc.status === "uploading" ? "extracting" : "ready_for_indexing"),
          collectionIds: doc.collectionIds ?? (doc.collectionId ? [doc.collectionId] : []),
          backendId: doc.id,
          addedAt: typeof doc.addedAt === "number" ? doc.addedAt : Date.parse(doc.addedAt),
          url: documentFileUrl(doc.id),
        }));
        setDocuments(restoredDocuments);
        restoredDocuments.filter((doc) => doc.status === "uploading").forEach((doc) => {
          void waitForDocumentProcessing(doc.id, (status, stage, error) => {
            if (alive) setDocuments((current) => current.map((item) => item.id === doc.id
              ? { ...item, status, stage, error: error ?? null }
              : item));
          }).catch((error) => {
            if (alive) setDocuments((current) => current.map((item) => item.id === doc.id
              ? { ...item, status: "failed", stage: "failed", error: String(error) }
              : item));
          });
        });

        setConversations(savedConversations);
        setArchivedConversations(savedArchive);
        setActiveConversationId(null);
        setMessages([]);
        setPinnedDocuments([], false);
      } catch (error) {
        console.error("Could not load saved DocBuddy data", error);
        if (alive) window.alert("Could not load saved data from the database. Check that the backend is running.");
      }
    };

    void loadWorkspace();
    return () => { alive = false; };
  }, [
    setTheme,
    setAppName,
    setCollections,
    setDocuments,
    setMessages,
    setConversations,
    setArchivedConversations,
    setActiveConversationId,
    setPinnedDocuments,
  ]);
}
