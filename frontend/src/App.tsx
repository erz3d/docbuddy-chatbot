import { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { askModel } from "./services/chatService";
import { uploadDocument } from "./services/documentService";
import { api, documentFileUrl } from "./services/api";

import Sidebar from "./components/layout/Sidebar";
import ChatWindow from "./components/chat/ChatWindow";
import DocumentLibrary from "./components/documents/DocumentLibrary";
import PDFViewer from "./components/pdf/PDFViewer";
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
  return crypto.randomUUID();
}

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
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  activeConversationIdRef.current = activeConversationId;
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [viewerDocument, setViewerDocument] =
    useState<DocumentItem | null>(null);
  const [viewerPage, setViewerPage] = useState(1);

  const abortRef = useRef<AbortController | null>(null);

  const setPinnedDocuments = (ids: string[], persist = true) => {
    selectedIdsRef.current = ids;
    setSelectedIds(ids);
    const conversationId = activeConversationIdRef.current;
    if (!conversationId || !persist) return;
    setConversations((current) => current.map((conversation) => conversation.id === conversationId
      ? { ...conversation, documentIds: ids }
      : conversation));
    void api(`/api/conversations/${conversationId}/documents`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentIds: ids }),
    }).catch((error) => window.alert(String(error)));
  };

  useEffect(() => {
    let alive = true;
    const loadWorkspace = async () => {
      try {
        const [savedSettings, savedCollections, savedDocuments, savedConversations] = await Promise.all([
          api<{ theme: Theme; appName: string }>("/api/settings"),
          api<Collection[]>("/api/collections"),
          api<Array<Omit<DocumentItem, "addedAt"> & { addedAt: string | number }>>("/api/documents"),
          api<ConversationItem[]>("/api/conversations"),
        ]);
        if (!alive) return;
        setTheme(savedSettings.theme);
        setAppName(savedSettings.appName);
        setCollections(savedCollections);
        setDocuments(savedDocuments.map((doc) => ({ ...doc, backendId: doc.id, addedAt: typeof doc.addedAt === "number" ? doc.addedAt : Date.parse(doc.addedAt), url: documentFileUrl(doc.id) })));
        let chats = savedConversations;
        if (chats.length === 0) {
          const created = await api<{ id: string; title: string }>("/api/conversations", { method: "POST" });
          chats = [{ ...created, preview: "", updatedAt: new Date().toISOString(), documentIds: [] }];
        }
        if (!alive) return;
        setConversations(chats);
        setActiveConversationId(chats[0].id);
        const opened = await api<{ messages: ChatMessage[]; documentIds: string[] }>(`/api/conversations/${chats[0].id}`);
        if (alive) {
          setMessages(opened.messages.map((m) => ({ ...m, timestamp: typeof m.timestamp === "number" ? m.timestamp : Date.parse(m.timestamp as unknown as string) })));
          setPinnedDocuments(opened.documentIds ?? [], false);
        }
      } catch (error) {
        console.error("Could not load saved DocBuddy data", error);
        if (alive) window.alert("Could not load saved data from the database. Check that the backend is running.");
      }
    };
    void loadWorkspace();
    return () => { alive = false; };
  }, []);

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

  const toggleDocument = (id: string) => {
    const current = selectedIdsRef.current;
    const nextIds = current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];
    setPinnedDocuments(nextIds);
  };

  const uploadFiles = (files: FileList | null) => {
    if (!files) return;
  
    Array.from(files).forEach((file) => {
      if (file.type !== "application/pdf") {
        window.alert(`${file.name} is not a PDF file.`);
        return;
      }
  
      const id = createId();
  
      const newDocument: DocumentItem = {
        id,
        name: file.name,
        size: file.size,
        status: "uploading",
        collectionId: null,
        url: URL.createObjectURL(file),
        addedAt: Date.now(),
      };
  
      setDocuments((current) => [...current, newDocument]);
  
      // Store the PDF and extracted page text in SQLite.
      uploadDocument(file)
        .then(({ id: backendId, name, size }) => {
          setDocuments((current) =>
            current.map((doc) =>
              doc.id === id ? { ...doc, id: backendId, backendId, name, size, url: documentFileUrl(backendId), status: "ready" } : doc
            )
          );
          setPinnedDocuments([...new Set([...selectedIdsRef.current, backendId])]);
        })
        .catch(() => {
          setDocuments((current) =>
            current.map((doc) =>
              doc.id === id ? { ...doc, status: "failed" } : doc
            )
          );
        });
    });
  };

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

  const createCollection = (name: string, color: string) => {
    void api<Collection>("/api/collections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, color }) })
      .then((collection) => setCollections((current) => [...current, collection]))
      .catch((error) => window.alert(String(error)));
  };

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

  const moveDocument = (
    documentId: string,
    collectionId: string | null
  ) => {
    void api(`/api/documents/${documentId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collectionId }) }).catch((error) => window.alert(String(error)));
    setDocuments((current) =>
      current.map((doc) =>
        doc.id === documentId ? { ...doc, collectionId } : doc
      )
    );
  };

  const openDocument = (doc: DocumentItem, page = 1) => {
    setViewerDocument(doc);
    setViewerPage(page);
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsGenerating(false);
  };
  
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
      const documentIds = documents
        .filter((doc) => selectedIds.includes(doc.id) && doc.status === "ready")
        .map((doc) => doc.backendId ?? doc.id);
      if (!activeConversationId) throw new Error("Conversation is not ready yet");
      const result = await askModel(history, documentIds, activeConversationId, controller.signal);
      content = result.content;
      const savedAnswer: ChatMessage = {
        id: result.id,
        role: "assistant",
        content,
        citations: [],
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
      setConversations((current) => current.map((item) => item.id === activeConversationId
        ? { ...item, title: history.find((message) => message.role === "user")?.content.slice(0, 70) || "New conversation", preview: content, updatedAt: new Date().toISOString(), documentIds }
        : item));
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
  
    setIsGenerating(false);
    abortRef.current = null;
  };

  const sendMessage = (message: string) => {
    generateAnswer(message);
  };

  const regenerateAnswer = () => {
    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");

    if (lastUserMessage) {
      generateAnswer(lastUserMessage.content, false, true);
    }
  };

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

  const openCitation = (citation: Citation) => {
    const doc = documents.find(
      (document) => document.id === citation.documentId
    );

    if (doc) openDocument(doc, citation.page);
  };

  const newConversation = () => {
    stopGeneration();
    setPinnedDocuments([], false);
    setViewerDocument(null);
    setPage("chat");
    void api<{ id: string; title: string }>("/api/conversations", { method: "POST" })
      .then((created) => {
        setConversations((current) => [{ ...created, preview: "", updatedAt: new Date().toISOString(), documentIds: [] }, ...current]);
        setActiveConversationId(created.id);
        setMessages([]);
      })
      .catch((error) => window.alert(String(error)));
  };

  const selectConversation = async (id: string) => {
    stopGeneration();
    try {
      const opened = await api<{ messages: ChatMessage[]; documentIds: string[] }>(`/api/conversations/${id}`);
      setMessages(opened.messages.map((message) => ({ ...message, timestamp: typeof message.timestamp === "number" ? message.timestamp : Date.parse(message.timestamp as unknown as string) })));
      setActiveConversationId(id);
      setPinnedDocuments(opened.documentIds ?? [], false);
      setViewerDocument(null);
      setPage("chat");
    } catch (error) { window.alert(String(error)); }
  };

  const clearHistory = () => {
    stopGeneration();
    setMessages([]);
    setPinnedDocuments([], false);
    if (activeConversationId) void api(`/api/conversations/${activeConversationId}/messages`, { method: "DELETE" })
      .then(() => setConversations((current) => current.map((item) => item.id === activeConversationId ? { ...item, title: "New conversation", preview: "", documentIds: [] } : item)))
      .catch((error) => window.alert(String(error)));
  };

  return (
    <div className="app-background app-text transition-theme flex h-screen min-h-[600px] overflow-hidden">
      <Sidebar
        page={page}
        onNavigate={(nextPage) => { setActiveCollectionId(null); setPage(nextPage); }}
        collections={collections}
        onNewChat={newConversation}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={selectConversation}
        onSelectCollection={(id) => { setActiveCollectionId(id); setPage("documents"); }}
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
          {page === "chat" && (
            <>
              <div
                className={`min-w-0 flex-1 ${
                  viewerDocument ? "hidden lg:flex lg:flex-col" : "flex flex-col"
                }`}
              >
                <ChatWindow
                  messages={messages}
                  documents={documents}
                  selectedIds={selectedIds}
                  isGenerating={isGenerating}
                  onToggleDocument={toggleDocument}
                  onSend={sendMessage}
                  onUpload={uploadFiles}
                  onStop={stopGeneration}
                  onRegenerate={regenerateAnswer}
                  onFeedback={updateFeedback}
                  onCitation={openCitation}
                  onViewDocument={() => {
                    const selectedDocument = documents.find((doc) =>
                      selectedIds.includes(doc.id)
                    );

                    if (selectedDocument) {
                      openDocument(selectedDocument);
                    } else if (documents.length > 0) {
                      openDocument(documents[0]);
                    } else {
                      setPage("documents");
                    }
                  }}
                />
              </div>

              {viewerDocument && (
                <div className="flex min-w-0 flex-1 flex-col lg:max-w-[48%]">
                  <PDFViewer
                    document={viewerDocument}
                    initialPage={viewerPage}
                    onClose={() => setViewerDocument(null)}
                  />
                </div>
              )}
            </>
          )}

          {page === "documents" && (
            <DocumentLibrary
              documents={documents}
              collections={collections}
              conversations={conversations}
              activeCollectionId={activeCollectionId}
              selectedIds={selectedIds}
              onUpload={uploadFiles}
              onDelete={deleteDocument}
              onCreateCollection={createCollection}
              onToggleFavorite={toggleFavorite}
              onMoveDocument={moveDocument}
              onViewDocument={openDocument}
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
        </div>
      </main>
    </div>
  );
}
