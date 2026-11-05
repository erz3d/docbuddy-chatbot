import { useEffect, useRef, useState } from "react";
import { Menu, PanelLeftClose } from "lucide-react";

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

  const generationTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.title = appName;
  }, [appName]);

  useEffect(() => {
    return () => {
      if (generationTimer.current) {
        clearTimeout(generationTimer.current);
      }

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

    const uploaded: DocumentItem[] = [];

    Array.from(files).forEach((file) => {
      if (file.type !== "application/pdf") {
        window.alert(`${file.name} is not a PDF file.`);
        return;
      }

      const newDocument: DocumentItem = {
        id: createId(),
        name: file.name,
        size: file.size,
        status: "ready",
        collectionId: null,
        url: URL.createObjectURL(file),
        addedAt: Date.now(),
      };

      uploaded.push(newDocument);
    });

    if (uploaded.length > 0) {
      setDocuments((current) => [...current, ...uploaded]);
      setSelectedIds((current) => [
        ...new Set([...current, ...uploaded.map((doc) => doc.id)]),
      ]);
    }
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
    if (generationTimer.current) {
      clearTimeout(generationTimer.current);
      generationTimer.current = null;
    }

    setIsGenerating(false);
  };

  const generateAnswer = (
    prompt: string,
    addUserMessage = true,
    replaceLastAnswer = false
  ) => {
    if (generationTimer.current) {
      clearTimeout(generationTimer.current);
    }

    if (addUserMessage) {
      const userMessage: ChatMessage = {
        id: createId(),
        role: "user",
        content: prompt,
        timestamp: Date.now(),
      };

      setMessages((current) => [...current, userMessage]);
    }

    setIsGenerating(true);

    generationTimer.current = setTimeout(() => {
      const firstDocument = documents.find((doc) =>
        selectedIds.includes(doc.id)
      );

      const answer: ChatMessage = {
        id: createId(),
        role: "assistant",
        content:
          documents.length === 0
            ? "I can help you analyse documents once you upload a PDF. Please add a document to your library to get started."
            : `Here is a simulated response to your question:\n\n"${prompt}"\n\nIn a connected version of DocBuddy, I would analyse the selected documents, retrieve relevant passages and provide a concise answer based on their content.\n\nThis is placeholder content for the frontend prototype.`,
        citations: firstDocument
          ? [
              {
                documentId: firstDocument.id,
                documentName: firstDocument.name,
                page: 1,
              },
            ]
          : [],
        timestamp: Date.now(),
      };

      setMessages((current) => {
        if (replaceLastAnswer) {
          const updated = [...current];
          
          let lastAssistantIndex = -1;

          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === "assistant") {
              lastAssistantIndex = i;
              break;
            }
          }

          if (lastAssistantIndex >= 0) {
            updated[lastAssistantIndex] = answer;
            return updated;
          }
        }

        return [...current, answer];
      });

      setIsGenerating(false);
      generationTimer.current = null;
    }, 1200);
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