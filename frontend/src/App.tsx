import { useEffect, useRef, useState } from "react";
import { Menu, PanelLeftClose } from "lucide-react";
import { askModel } from "./services/chatService";
import { uploadDocument } from "./services/documentService";

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
} from "./types";

const initialCollections: Collection[] = [
  {
    id: "university",
    name: "University Notes",
    color: "#11C5AD",
    icon: "folder",
    favorite: true,
  },
  {
    id: "research",
    name: "Research Papers",
    color: "#818CF8",
    icon: "folder",
    favorite: false,
  },
  {
    id: "work",
    name: "Work Documents",
    color: "#F59E0B",
    icon: "folder",
    favorite: false,
  },
];

function createId() {
  return crypto.randomUUID();
}

export default function App() {
  const [page, setPage] = useState<Page>("chat");
  const [theme, setTheme] = useState<Theme>("dark");
  const [appName, setAppName] = useState("DocBuddy");

  const [mobileOpen, setMobileOpen] = useState(false);

  const [collections, setCollections] =
    useState<Collection[]>(initialCollections);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const [viewerDocument, setViewerDocument] =
    useState<DocumentItem | null>(null);
  const [viewerPage, setViewerPage] = useState(1);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.title = appName;
  }, [appName]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();

      documents.forEach((doc) => {
        if (doc.url) URL.revokeObjectURL(doc.url);
      });
    };
  }, []);

  const toggleDocument = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
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
      setSelectedIds((current) => [...new Set([...current, id])]);
  
      // send file to backend
      uploadDocument(file)
        .then(({ id: backendId }) => {
          setDocuments((current) =>
            current.map((doc) =>
              doc.id === id ? { ...doc, status: "ready", backendId } : doc
            )
          );
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

    if (doc.url) URL.revokeObjectURL(doc.url);

    setDocuments((current) => current.filter((item) => item.id !== id));
    setSelectedIds((current) => current.filter((item) => item !== id));

    if (viewerDocument?.id === id) {
      setViewerDocument(null);
    }
  };

  const createCollection = (name: string, color: string) => {
    setCollections((current) => [
      ...current,
      {
        id: createId(),
        name,
        color,
        icon: "folder",
        favorite: false,
      },
    ]);
  };

  const toggleFavorite = (id: string) => {
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
    .filter(
      (doc) =>
        selectedIds.includes(doc.id) && doc.status === "ready" && doc.backendId
    )
    .map((doc) => doc.backendId as string);

    content = await askModel(history, documentIds, controller.signal);
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
    setMessages([]);
    setSelectedIds([]);
    setViewerDocument(null);
    setPage("chat");
  };

  const clearHistory = () => {
    stopGeneration();
    setMessages([]);
  };

  return (
    <div className="app-background app-text transition-theme flex h-screen min-h-[600px] overflow-hidden">
      <Sidebar
        page={page}
        onNavigate={setPage}
        collections={collections}
        onNewChat={newConversation}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
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
              selectedIds={selectedIds}
              onUpload={uploadFiles}
              onDelete={deleteDocument}
              onToggleSelect={toggleDocument}
              onCreateCollection={createCollection}
              onToggleFavorite={toggleFavorite}
              onMoveDocument={moveDocument}
              onViewDocument={openDocument}
            />
          )}

          {page === "settings" && (
            <SettingsPanel
              theme={theme}
              onThemeChange={setTheme}
              appName={appName}
              onAppNameChange={setAppName}
              onClearHistory={clearHistory}
            />
          )}
        </div>
      </main>
    </div>
  );
}