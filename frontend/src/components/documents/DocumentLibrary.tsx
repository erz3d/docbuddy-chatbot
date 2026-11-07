import { useRef, useState } from "react";
import {
  Upload,
  FileText,
  Trash2,
  FolderPlus,
  Search,
  Star,
  Folder,
  Eye,
  X,
  MessageSquarePlus,
  Check,
} from "lucide-react";
import type { Collection, ConversationItem, DocumentItem } from "../../types";

interface DocumentLibraryProps {
  documents: DocumentItem[];
  collections: Collection[];
  selectedIds: string[];
  onUpload: (files: FileList | null) => void;
  onDelete: (id: string) => void;
  onCreateCollection: (name: string, color: string) => void;
  onToggleFavorite: (id: string) => void;
  onMoveDocument: (documentId: string, collectionId: string | null) => void;
  onViewDocument: (document: DocumentItem) => void;
  onSelectForChat: (id: string) => void;
  activeCollectionId: string | null;
  conversations: ConversationItem[];
  onOpenCollection: (id: string) => void;
  onBackToCollections: () => void;
  onOpenConversation: (id: string) => void;
}

const collectionColors = [
  "#11C5AD",
  "#818CF8",
  "#F59E0B",
  "#F472B6",
  "#38BDF8",
];

export default function DocumentLibrary({
  documents,
  collections,
  selectedIds,
  onUpload,
  onDelete,
  onCreateCollection,
  onToggleFavorite,
  onMoveDocument,
  onViewDocument,
  onSelectForChat,
  activeCollectionId,
  conversations,
  onOpenCollection,
  onBackToCollections,
  onOpenConversation,
}: DocumentLibraryProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const [collectionColor, setCollectionColor] = useState(collectionColors[0]);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState("all");

  const filteredDocuments = documents
    .filter((doc) => doc.name.toLowerCase().includes(search.toLowerCase()))
    .filter((doc) =>
      filter === "all"
        ? true
        : filter === "null"
          ? doc.collectionId === null
          : doc.collectionId === filter
    )    .sort((a, b) => b.addedAt - a.addedAt);

  const handleCreate = () => {
    if (!collectionName.trim()) return;
    onCreateCollection(collectionName.trim(), collectionColor);
    setCollectionName("");
    setShowCreate(false);
  };

  const activeCollection = collections.find((item) => item.id === activeCollectionId);
  if (activeCollection) {
    const collectionDocuments = documents.filter((doc) => doc.collectionId === activeCollection.id);
    const collectionDocumentIds = new Set(collectionDocuments.map((doc) => doc.id));
    const relatedConversations = conversations.filter((conversation) =>
      conversation.documentIds?.some((id) => collectionDocumentIds.has(id))
    );

    return (
      <div className="h-full flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl p-5 md:p-8">
          <button onClick={onBackToCollections} className="app-muted app-surface-hover rounded-lg px-3 py-2 text-xs">← All documents and collections</button>
          <div className="mt-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${activeCollection.color}20` }}>
              <Folder size={22} style={{ color: activeCollection.color }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{activeCollection.name}</h1>
              <p className="app-muted mt-1 text-sm">{collectionDocuments.length} {collectionDocuments.length === 1 ? "document" : "documents"}</p>
            </div>
          </div>

          <section className="mt-8">
            <h2 className="text-sm font-semibold">Documents in this collection</h2>
            <div className="mt-3 space-y-2">
              {collectionDocuments.length === 0 ? (
                <div className="app-surface rounded-xl border p-6 text-sm app-muted">No documents have been added to this collection yet.</div>
              ) : collectionDocuments.map((doc) => (
                <div key={doc.id} className="app-surface flex flex-wrap items-center gap-3 rounded-xl border p-3">
                  <FileText size={19} className="text-red-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.name}</p>
                    <p className="app-muted mt-1 text-xs">{(doc.size / 1024 / 1024).toFixed(2)} MB · {doc.status === "ready" ? "Ready" : doc.status}</p>
                  </div>
                  <button onClick={() => onSelectForChat(doc.id)} className="app-muted app-surface-hover rounded-lg px-3 py-2 text-xs">{selectedIds.includes(doc.id) ? "Open in chat" : "Pin in chat"}</button>
                  <button onClick={() => onViewDocument(doc)} title="View PDF" className="app-muted rounded-lg p-2 hover:bg-[var(--surface-hover)]"><Eye size={16} /></button>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-9">
            <h2 className="text-sm font-semibold">Conversations that used these documents</h2>
            <p className="app-muted mt-1 text-xs">Chats where at least one document from this collection was pinned.</p>
            <div className="mt-3 space-y-2">
              {relatedConversations.length === 0 ? (
                <div className="app-surface rounded-xl border p-6 text-sm app-muted">No conversations have pinned these documents yet.</div>
              ) : relatedConversations.map((conversation) => {
                const pinnedNames = collectionDocuments.filter((doc) => conversation.documentIds.includes(doc.id)).map((doc) => doc.name);
                return (
                  <button key={conversation.id} onClick={() => onOpenConversation(conversation.id)} className="app-surface app-surface-hover flex w-full items-start gap-3 rounded-xl border p-4 text-left">
                    <MessageSquarePlus size={17} className="mt-0.5 shrink-0 text-teal-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{conversation.title}</span>
                      <span className="app-muted mt-1 block truncate text-xs">Pinned: {pinnedNames.join(", ")}</span>
                      {conversation.preview && <span className="app-muted mt-1 block truncate text-xs">{conversation.preview}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl p-5 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Document library</h1>
            <p className="app-muted mt-2 text-sm">
              Manage your PDFs and organise them into collections.
            </p>
          </div>

          <button
            onClick={() => fileInput.current?.click()}
            className="accent-button flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
          >
            <Upload size={17} />
            Upload PDFs
          </button>

          <input
            ref={fileInput}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              onUpload(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">
            Your collections ({collections.length})
          </h2>

          <button
            onClick={() => setShowCreate(true)}
            className="app-muted app-surface-hover flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
          >
            <FolderPlus size={15} />
            New collection
          </button>
        </div>

        {showCreate && (
          <div className="app-surface mt-4 rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Create collection</h3>
              <button onClick={() => setShowCreate(false)}>
                <X size={17} className="app-muted" />
              </button>
            </div>

            <input
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              placeholder="Collection name..."
              className="app-input mt-3 w-full rounded-lg px-3 py-2.5 text-sm"
            />

            <div className="mt-3 flex items-center gap-3">
              {collectionColors.map((color) => (
                <button
                  key={color}
                  onClick={() => setCollectionColor(color)}
                  className={`h-6 w-6 rounded-full ${
                    collectionColor === color
                      ? "ring-2 ring-offset-2 ring-offset-[var(--surface)] ring-teal-500"
                      : ""
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Choose ${color}`}
                />
              ))}
            </div>

            <button
              onClick={handleCreate}
              disabled={!collectionName.trim()}
              className="accent-button mt-4 rounded-lg px-4 py-2 text-xs font-semibold"
            >
              Create collection
            </button>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {collections.map((collection) => {
            const count = documents.filter(
              (doc) => doc.collectionId === collection.id
            ).length;

            return (
              <div
                key={collection.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenCollection(collection.id)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpenCollection(collection.id); }}
                className="app-surface cursor-pointer rounded-xl border p-4 transition hover:scale-105 duration-400"
              >
                <div className="flex items-center justify-between">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${collection.color}20` }}
                  >
                    <Folder size={19} style={{ color: collection.color }} />
                  </div>

                  <button
                    onClick={(event) => { event.stopPropagation(); onToggleFavorite(collection.id); }}
                    className="app-muted rounded-lg p-2 hover:bg-[var(--surface-hover)]"
                    title="Favourite collection"
                  >
                    <Star
                      size={16}
                      className={
                        collection.favorite ? "fill-amber-400 text-amber-400" : ""
                      }
                    />
                  </button>
                </div>

                <h3 className="mt-4 text-sm font-semibold">
                  {collection.name}
                </h3>
                <p className="app-muted mt-1 text-xs">
                  {count} {count === 1 ? "document" : "documents"}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-sm font-semibold">
            All documents ({documents.length})
          </h2>

          <div className="flex flex-wrap gap-2">
            <div className="app-input flex items-center gap-2 rounded-lg px-3 py-2">
              <Search size={15} className="app-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search PDFs..."
                className="w-32 bg-transparent text-xs outline-none sm:w-44"
              />
            </div>

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="app-input rounded-lg px-3 py-2 text-xs"
            >
              <option value="all">All collections</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
              <option value="null">Unsorted</option>
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {filteredDocuments.length === 0 ? (
            <div className="app-surface rounded-xl border p-10 text-center">
              <FileText size={30} className="app-muted mx-auto" />
              <p className="mt-3 text-sm font-medium">No documents found</p>
              <p className="app-muted mt-1 text-xs">
                Upload a PDF or change your search.
              </p>
            </div>
          ) : (
            filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className="app-surface flex flex-wrap items-center gap-3 rounded-xl border p-3 sm:flex-nowrap"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                  <FileText size={19} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{doc.name}</p>
                  <p className="app-muted mt-1 text-xs">
                    {(doc.size / 1024 / 1024).toFixed(2)} MB ·{" "}
                    {doc.status === "ready" ? "Ready" : doc.status}
                  </p>
                </div>

                <select
                  value={doc.collectionId ?? "null"}
                  onChange={(e) =>
                    onMoveDocument(
                      doc.id,
                      e.target.value === "null" ? null : e.target.value
                    )
                  }
                  className="app-input max-w-36 rounded-lg px-2 py-2 text-xs"
                  aria-label={`Move ${doc.name} to collection`}
                >
                  <option value="null">Unsorted</option>
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => onSelectForChat(doc.id)}
                  title="Use this PDF in chat"
                  className="app-muted app-surface-hover flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                >
                  {selectedIds.includes(doc.id) ? <Check size={15} /> : <MessageSquarePlus size={15} />}
                  <span className="hidden md:inline">{selectedIds.includes(doc.id) ? "In chat" : "Use in chat"}</span>
                </button>

                <button
                  onClick={() => onViewDocument(doc)}
                  title="View document"
                  className="app-muted rounded-lg p-2 hover:bg-[var(--surface-hover)]"
                >
                  <Eye size={16} />
                </button>

                <button
                  onClick={() => onDelete(doc.id)}
                  title="Delete document"
                  className="rounded-lg p-2 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
