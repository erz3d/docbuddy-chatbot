// Coordinate app state, navigation, document actions, and chat conversations.

import { useCallback, useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { askModel } from "./services/chatService";
import { api } from "./services/api";
import { useDocumentUploads } from "./hooks/useDocumentUploads";
import { useWorkspaceLoader } from "./hooks/useWorkspaceLoader";

import Sidebar from "./components/layout/Sidebar";
import ArchiveView from "./components/layout/ArchiveView";
import ChatHistoryView from "./components/layout/ChatHistoryView";
import ChatWindow from "./components/chat/ChatWindow";
import DocumentLibrary from "./components/documents/DocumentLibrary";
import DocumentViewer from "./components/documents/DocumentViewer";
import SettingsPanel from "./components/settings/SettingsPanel";

import type {
  ChatMessage,
  Citation,
  Collection,
  DocumentItem,
  Page,
  Theme,
  ConversationItem,
} from "./types";

function createId() {
  // Create unique client-side IDs for drafts and messages.
  return crypto.randomUUID();
}

// Render the application shell and connect views to workspace actions.
export default function App() {
  const [page, setPage] = useState<Page>("chat");
  const [theme, setTheme] = useState<Theme>("dark");
  const [appName, setAppName] = useState("DocBuddy");

  const [mobileOpen, setMobileOpen] = useState(false);

  const [collections, setCollections] = useState<Collection[]>([]);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedIdsRef = useRef<string[]>([]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [archivedConversations, setArchivedConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  useEffect(() => { activeConversationIdRef.current = activeConversationId; }, [activeConversationId]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [viewerDocument, setViewerDocument] =
    useState<DocumentItem | null>(null);
  const [viewerSource, setViewerSource] = useState<"chat" | "library">("library");
  const [viewerUnit, setViewerUnit] = useState(1);

  const abortRef = useRef<AbortController | null>(null);
  const pendingUploadsRef = useRef<Map<string, File>>(new Map());
  // Update pinned-document state and optionally persist it for the conversation.
  const setPinnedDocuments = useCallback((ids: string[], persist = true) => {
    selectedIdsRef.current = ids;
    setSelectedIds(ids);
    const conversationId = activeConversationIdRef.current;
    if (!conversationId || !persist) return;
    const savedIds = ids.filter((id) => !pendingUploadsRef.current.has(id));
    setConversations((current) => current.map((conversation) => conversation.id === conversationId
      ? { ...conversation, documentIds: [...new Set([...conversation.documentIds, ...savedIds])] }
      : conversation));
    void api(`/api/conversations/${conversationId}/documents`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentIds: savedIds }),
    }).catch((error) => window.alert(String(error)));
  }, []);

  const {
    uploadFiles,
    uploadPendingDocuments,
    discardPendingUploads,
  } = useDocumentUploads({ documents, setDocuments, pendingUploadsRef, selectedIdsRef, setPinnedDocuments });
  useWorkspaceLoader({
    setTheme,
    setAppName,
    setCollections,
    setDocuments,
    setMessages,
    setConversations,
    setArchivedConversations,
    setActiveConversationId,
    setPinnedDocuments,
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.title = appName;
  }, [appName]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();

    };
  }, []);

  // Toggle a document in the current chat's pinned selection.
  const toggleDocument = (id: string) => {
    const current = selectedIdsRef.current;
    const nextIds = current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];
    setPinnedDocuments(nextIds);
  };

  // Confirm deletion, remove a document, and clear related selection state.
  const deleteDocument = (id: string) => {
    const doc = documents.find((item) => item.id === id);
    if (!doc) return;

    if (!window.confirm(`Delete "${doc.name}" from your library?`)) return;

    void api(`/api/documents/${id}`, { method: "DELETE" }).catch((error) => window.alert(String(error)));

    setDocuments((current) => current.filter((item) => item.id !== id));
    setPinnedDocuments(selectedIdsRef.current.filter((item) => item !== id));

    if (viewerDocument?.id === id) {
      setViewerDocument(null);
    }
  };

  // Create a collection and add it to the visible workspace.
  const createCollection = (name: string, color: string) => {
    void api<Collection>("/api/collections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, color }) })
      .then((collection) => setCollections((current) => [...current, collection]))
      .catch((error) => window.alert(String(error)));
  };

  // Toggle and persist a collection's favorite state.
  const toggleFavorite = (id: string) => {
    const collection = collections.find((item) => item.id === id);
    if (collection) void api(`/api/collections/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ favorite: !collection.favorite }) }).catch((error) => window.alert(String(error)));
    setCollections((current) =>
      current.map((collection) =>
        collection.id === id
          ? { ...collection, favorite: !collection.favorite }
          : collection
      )
    );
  };

  // Add a document to a collection and update local membership state.
  const addDocumentToCollection = (documentId: string, collectionId: string) => {
    void api(`/api/documents/${documentId}/collections/${collectionId}`, { method: "POST" }).catch((error) => window.alert(String(error)));
    setDocuments((current) => current.map((doc) => doc.id !== documentId ? doc : {
      ...doc,
      collectionId: doc.collectionId ?? collectionId,
      collectionIds: [...new Set([...(doc.collectionIds ?? (doc.collectionId ? [doc.collectionId] : [])), collectionId])],
    }));
  };

  // Remove a document from a collection and refresh its primary membership.
  const removeDocumentFromCollection = (documentId: string, collectionId: string) => {
    void api(`/api/documents/${documentId}/collections/${collectionId}`, { method: "DELETE" }).catch((error) => window.alert(String(error)));
    setDocuments((current) => current.map((doc) => {
      if (doc.id !== documentId) return doc;
      const collectionIds = (doc.collectionIds ?? (doc.collectionId ? [doc.collectionId] : [])).filter((id) => id !== collectionId);
      return { ...doc, collectionIds, collectionId: collectionIds[0] ?? null };
    }));
  };

  // Open a document at a page, section, or sheet and remember its layout.
  const openDocument = (doc: DocumentItem, unit = 1, source: "chat" | "library" = "library") => {
    setViewerDocument(doc);
    setViewerUnit(unit);
    setViewerSource(source);
  };

  // Abort the current model request and clear its generating state.
  const stopGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsGenerating(false);
  };
  
  // Persist the draft, upload selected files, and request an assistant reply.
  const generateAnswer = async (
    prompt: string,
    addUserMessage = true,
    replaceLastAnswer = false
  ) => {
    abortRef.current?.abort();
  
    // Historique envoyé au modèle
    let history: ChatMessage[];
  
    if (addUserMessage) {
      const userMessage: ChatMessage = {
        id: createId(),
        role: "user",
        content: prompt,
        timestamp: Date.now(),
      };
  
      history = [...messages, userMessage];
      setMessages(history);
    } else {
      // Régénération : on garde tout jusqu'au dernier message utilisateur
      let lastUserIndex = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          lastUserIndex = i;
          break;
        }
      }
      history = messages.slice(0, lastUserIndex + 1);
    }
  
    const controller = new AbortController();
    abortRef.current = controller;
    setIsGenerating(true);
  
    let content: string;
  
    try {
      const conversationId = activeConversationId ?? createId();
      const firstPrompt = history.find((message) => message.role === "user")?.content ?? "New conversation";
      const draftDocumentIds = selectedIdsRef.current.filter((id) => !pendingUploadsRef.current.has(id));
      if (!activeConversationId) {
        activeConversationIdRef.current = conversationId;
        setActiveConversationId(conversationId);
        setConversations((current) => [{
          id: conversationId,
          title: firstPrompt.slice(0, 70) || "New conversation",
          preview: firstPrompt,
          updatedAt: new Date().toISOString(),
          documentIds: draftDocumentIds,
        }, ...current.filter((item) => item.id !== conversationId)]);
      }
      await api(`/api/conversations/${conversationId}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ id, role, content, liked, timestamp }) => ({ id, role, content, liked, timestamp })),
          documentIds: draftDocumentIds,
        }),
      });

      const resolvedIds = await uploadPendingDocuments();
      const documentIds = selectedIdsRef.current.map((id) => resolvedIds.get(id) ?? id);
      if (resolvedIds.size > 0) setPinnedDocuments(documentIds, false);
      const result = await askModel(history, documentIds, conversationId, controller.signal);
      content = result.content;
      activeConversationIdRef.current = result.conversationId;
      setActiveConversationId(result.conversationId);
      const savedAnswer: ChatMessage = {
        id: result.id,
        role: "assistant",
        content,
        citations: result.citations ?? [],
        pythonExecutions: result.pythonExecutions ?? [],
        timestamp: Date.parse(result.timestamp),
      };
      setMessages((current) => {
        if (replaceLastAnswer) {
          const updated = [...current];
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === "assistant") { updated[i] = savedAnswer; return updated; }
          }
        }
        return [...current, savedAnswer];
      });
      const conversationTitle = history.find((message) => message.role === "user")?.content.slice(0, 70) || "New conversation";
      setConversations((current) => {
        const exists = current.some((item) => item.id === result.conversationId);
        const updated = exists
          ? current.map((item) => item.id === result.conversationId
            ? { ...item, title: item.title === "New conversation" ? conversationTitle : item.title, preview: content, updatedAt: new Date().toISOString(), documentIds }
            : item)
          : [{ id: result.conversationId, title: conversationTitle, preview: content, updatedAt: new Date().toISOString(), documentIds }, ...current];
        return updated.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
      });
      setIsGenerating(false);
      abortRef.current = null;
      return;
    } catch (error) {
      if (controller.signal.aborted) return; // arrêt demandé par l'utilisateur
  
      content = `Erreur : ${
        error instanceof Error ? error.message : "impossible de joindre le serveur."
      }`;
    }
  
    const answer: ChatMessage = {
      id: createId(),
      role: "assistant",
      content,
      citations: [],
      timestamp: Date.now(),
    };
  
    setMessages((current) => {
      if (replaceLastAnswer) {
        const updated = [...current];
  
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].role === "assistant") {
            updated[i] = answer;
            return updated;
          }
        }
      }
  
      return [...current, answer];
    });

    const failedPreview = history.filter((message) => message.role === "user").at(-1)?.content ?? content;
    setConversations((current) => current.map((item) => item.id === activeConversationIdRef.current
      ? { ...item, preview: failedPreview, updatedAt: new Date().toISOString() }
      : item));
  
    setIsGenerating(false);
    abortRef.current = null;
  };

  // Start a new assistant response for the submitted user message.
  const sendMessage = (message: string) => {
    generateAnswer(message);
  };

  // Retry the latest user prompt while replacing the prior assistant reply.
  const regenerateAnswer = () => {
    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");

    if (lastUserMessage) {
      generateAnswer(lastUserMessage.content, false, true);
    }
  };

  // Toggle message feedback and persist the updated value.
  const updateFeedback = (id: string, liked: boolean) => {
    const target = messages.find((message) => message.id === id);
    const nextLiked = target?.liked === liked ? null : liked;
    if (activeConversationId) void api(`/api/conversations/${activeConversationId}/messages/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ liked: nextLiked }) }).catch((error) => window.alert(String(error)));
    setMessages((current) =>
      current.map((message) =>
        message.id === id
          ? {
              ...message,
              liked: message.liked === liked ? null : liked,
            }
          : message
      )
    );
  };

  // Open the cited document at the page referenced by the answer.
  const openCitation = (citation: Citation) => {
    const doc = documents.find(
      (document) => document.id === citation.documentId
    );

    if (doc) openDocument(doc, citation.page);
  };

  // Reset chat state and start a fresh conversation draft.
  const newConversation = () => {
    stopGeneration();
    discardPendingUploads();
    activeConversationIdRef.current = null;
    setActiveConversationId(null);
    setPinnedDocuments([], false);
    setViewerDocument(null);
    setPage("chat");
    setMessages([]);
  };

  // Load a saved conversation and restore its messages and pinned documents.
  const selectConversation = async (id: string) => {
    stopGeneration();
    try {
      const opened = await api<{ messages: ChatMessage[]; documentIds: string[] }>(`/api/conversations/${id}`);
      setMessages(opened.messages.map((message) => ({ ...message, timestamp: typeof message.timestamp === "number" ? message.timestamp : Date.parse(message.timestamp as unknown as string) })));
      discardPendingUploads();
      setActiveConversationId(id);
      activeConversationIdRef.current = id;
      setPinnedDocuments(opened.documentIds ?? [], false);
      setViewerDocument(null);
      setPage("chat");
    } catch (error) { window.alert(String(error)); }
  };

  // Clear messages from the active conversation while keeping it available.
  const clearHistory = () => {
    stopGeneration();
    setMessages([]);
    setPinnedDocuments([], false);
    if (activeConversationId) void api(`/api/conversations/${activeConversationId}/messages`, { method: "DELETE" })
      .then(() => setConversations((current) => current.map((item) => item.id === activeConversationId ? { ...item, title: "New conversation", preview: "", documentIds: [] } : item)))
      .catch((error) => window.alert(String(error)));
  };

  // Save a conversation title and update the sidebar state.
  const renameConversation = (id: string, title: string) => {
    void api<{ id: string; title: string }>(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }).then((updated) => setConversations((current) => current.map((item) => item.id === id ? { ...item, title: updated.title } : item)))
      .catch((error) => window.alert(String(error)));
  };

  // Archive a conversation and leave it out of the active history list.
  const archiveConversation = async (id: string) => {
    try {
      await api(`/api/conversations/${id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      const item = conversations.find((conversation) => conversation.id === id);
      if (item) setArchivedConversations((current) => [item, ...current.filter((conversation) => conversation.id !== id)]);
      setConversations((current) => current.filter((conversation) => conversation.id !== id));
      if (activeConversationId === id) newConversation();
    } catch (error) { window.alert(String(error)); }
  };

  // Confirm and permanently delete a conversation from both history lists.
  const deleteConversation = async (id: string) => {
    if (!window.confirm("Permanently delete this discussion and its messages?")) return;
    try {
      await api(`/api/conversations/${id}`, { method: "DELETE" });
      setConversations((current) => current.filter((conversation) => conversation.id !== id));
      setArchivedConversations((current) => current.filter((conversation) => conversation.id !== id));
      if (activeConversationId === id) newConversation();
    } catch (error) { window.alert(String(error)); }
  };

  // Restore an archived conversation to the active history list.
  const restoreConversation = async (id: string) => {
    try {
      await api(`/api/conversations/${id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
      const item = archivedConversations.find((conversation) => conversation.id === id);
      if (item) setConversations((current) => [item, ...current.filter((conversation) => conversation.id !== id)]);
      setArchivedConversations((current) => current.filter((conversation) => conversation.id !== id));
    } catch (error) { window.alert(String(error)); }
  };

  return (
    <div className="app-background app-text transition-theme flex h-screen min-h-[600px] overflow-hidden">
      <Sidebar
        page={page}
        onNavigate={(nextPage) => { setViewerDocument(null); setActiveCollectionId(null); setPage(nextPage); }}
        collections={collections}
        onNewChat={newConversation}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={selectConversation}
        onSelectCollection={(id) => { setViewerDocument(null); setActiveCollectionId(id); setPage("documents"); }}
        onRenameConversation={renameConversation}
        onArchiveConversation={archiveConversation}
        onDeleteConversation={deleteConversation}
        archivedCount={archivedConversations.length}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="app-background flex h-12 shrink-0 items-center px-4 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="app-muted rounded-lg p-2 hover:bg-[var(--surface-hover)]"
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <span className="ml-3 text-sm font-semibold">{appName}</span>
        </div>

        <div className="flex min-h-0 flex-1">
          {viewerDocument && viewerSource === "library" ? (
            <DocumentViewer
              document={viewerDocument}
              initialUnit={viewerUnit}
              onClose={() => setViewerDocument(null)}
            />
          ) : (
          <>
          {page === "chat" && (
            <>
              <div className={`min-w-0 ${viewerDocument && viewerSource === "chat" ? "hidden lg:flex lg:flex-col lg:flex-1" : "flex flex-1 flex-col"}`}>
                <ChatWindow
                  messages={messages}
                  documents={documents}
                  selectedIds={selectedIds}
                  isGenerating={isGenerating}
                  conversationTitle={conversations.find((item) => item.id === activeConversationId)?.title ?? "New conversation"}
                  onRenameConversation={(title) => activeConversationId && renameConversation(activeConversationId, title)}
                  onToggleDocument={toggleDocument}
                  onSend={sendMessage}
                  onUpload={(files) => uploadFiles(files, false)}
                  onStop={stopGeneration}
                  onRegenerate={regenerateAnswer}
                  onFeedback={updateFeedback}
                  onCitation={openCitation}
                  onViewDocument={(id) => {
                    const pinnedDocument = documents.find((doc) => doc.id === id && selectedIds.includes(doc.id));
                    if (pinnedDocument) openDocument(pinnedDocument, 1, "chat");
                  }}
                />
              </div>
              {viewerDocument && viewerSource === "chat" && (
                <div className="flex min-w-0 flex-1 flex-col lg:max-w-[48%]">
                  <DocumentViewer document={viewerDocument} initialUnit={viewerUnit} onClose={() => setViewerDocument(null)} />
                </div>
              )}
            </>
          )}

          {page === "documents" && (
            <DocumentLibrary
              documents={documents.filter((doc) => !doc.pending)}
              collections={collections}
              conversations={conversations}
              activeCollectionId={activeCollectionId}
              onUpload={(files) => uploadFiles(files, true)}
              onDelete={deleteDocument}
              onCreateCollection={createCollection}
              onToggleFavorite={toggleFavorite}
              onMoveDocument={addDocumentToCollection}
              onRemoveFromCollection={removeDocumentFromCollection}
              onViewDocument={(doc) => openDocument(doc, 1, "library")}
              onOpenCollection={(id) => setActiveCollectionId(id)}
              onBackToCollections={() => setActiveCollectionId(null)}
              onOpenConversation={selectConversation}
              onSelectForChat={(id) => {
                if (!selectedIds.includes(id)) toggleDocument(id);
                setPage("chat");
              }}
            />
          )}

          {page === "settings" && (
            <SettingsPanel
              theme={theme}
              onThemeChange={(nextTheme) => {
                setTheme(nextTheme);
                void api("/api/settings/theme", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: nextTheme }) }).catch((error) => window.alert(String(error)));
              }}
              appName={appName}
              onAppNameChange={(nextName) => {
                setAppName(nextName);
                void api("/api/settings/appName", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: nextName }) }).catch((error) => window.alert(String(error)));
              }}
              onClearHistory={clearHistory}
            />
          )}
          {page === "archive" && (
            <ArchiveView
              conversations={archivedConversations}
              onRestore={restoreConversation}
              onDelete={deleteConversation}
            />
          )}
          {page === "history" && (
            <ChatHistoryView conversations={conversations} onOpen={selectConversation} />
          )}
          </>
          )}
        </div>
      </main>
    </div>
  );
}
