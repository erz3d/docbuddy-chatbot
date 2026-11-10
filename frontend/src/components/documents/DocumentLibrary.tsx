// Display library documents, collections, and collection-related conversations.

import { useEffect, useRef, useState } from "react";
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
  MoreVertical,
} from "lucide-react";
import type { Collection, ConversationItem, DocumentItem } from "../../types";

interface DocumentLibraryProps {
  documents: DocumentItem[];
  collections: Collection[];
  onUpload: (files: FileList | null) => void;
  onDelete: (id: string) => void;
  onCreateCollection: (name: string, color: string) => void;
  onToggleFavorite: (id: string) => void;
  onMoveDocument: (documentId: string, collectionId: string) => void;
  onRemoveFromCollection: (documentId: string, collectionId: string) => void;
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

function documentStatusLabel(document: DocumentItem) {
  // Convert backend processing states into labels for the library UI.
  if (document.status === "failed" || document.stage === "failed") return "Failed";
  if (document.stage === "uploading") return "Uploading";
  if (document.stage === "extracting") return "Extracting text";
  if (document.stage === "ready_for_indexing" || document.stage === "indexing") return "Indexing";
  return "Ready";
}

// Render collection management and document browsing actions.
export default function DocumentLibrary({
  documents,
  collections,
  onUpload,
  onDelete,
  onCreateCollection,
  onToggleFavorite,
  onMoveDocument,
  onRemoveFromCollection,
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
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [openCollectionPicker, setOpenCollectionPicker] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    // Close open menus when a click occurs outside the document list.
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
        setOpenCollectionPicker(null);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [openMenu]);

  // Render the menu actions available for the current document.
  const renderDocumentActions = (doc: DocumentItem, inCollection = false) => (
    <div className="relative" ref={openMenu === doc.id ? menuRef : undefined}>
      <button
        onClick={() => { setOpenMenu(openMenu === doc.id ? null : doc.id); setOpenCollectionPicker(null); }}
        title="Document actions"
        aria-label={`Actions for ${doc.name}`}
        aria-expanded={openMenu === doc.id}
        className="app-muted app-surface-hover rounded-lg p-2"
      >
        <MoreVertical size={17} />
      </button>
      {openMenu === doc.id && (
        <div className="app-surface absolute right-0 top-10 z-40 w-44 rounded-xl border p-1.5 shadow-xl">
          {inCollection ? (
            <button onClick={() => { onViewDocument(doc); setOpenMenu(null); }} className="app-surface-hover flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs"><Eye size={14} />View</button>
          ) : null}
          <button disabled={doc.status !== "ready"} onClick={() => { onSelectForChat(doc.id); setOpenMenu(null); }} title={doc.status === "ready" ? "Use in chat" : "Available after processing completes"} className="app-surface-hover flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs"><MessageSquarePlus size={14} />Use in chat</button>
          {!inCollection && <button onClick={() => { onViewDocument(doc); setOpenMenu(null); }} className="app-surface-hover flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs"><Eye size={14} />View</button>}
          <div className="relative">
            <button onClick={() => setOpenCollectionPicker(openCollectionPicker === doc.id ? null : doc.id)} className="app-surface-hover flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs"><FolderPlus size={14} />Add to collection</button>
            {openCollectionPicker === doc.id && (
              <div className="app-surface absolute left-full top-0 z-50 ml-2 max-h-52 w-48 overflow-y-auto rounded-xl border p-1.5 shadow-xl">
                {collections.length === 0 ? <p className="app-muted px-2.5 py-2 text-xs">No collections yet</p> : collections.map((collection) => (
                  <button key={collection.id} onClick={() => { onMoveDocument(doc.id, collection.id); setOpenMenu(null); setOpenCollectionPicker(null); }} className="app-surface-hover flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs"><Folder size={14} style={{ color: collection.color }} /><span className="truncate">{collection.name}</span></button>
                ))}
              </div>
            )}
          </div>
          {inCollection ? (
            <button onClick={() => { onRemoveFromCollection(doc.id, activeCollectionId!); setOpenMenu(null); }} className="app-surface-hover flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs">Remove from collection</button>
          ) : (
            <button onClick={() => { onDelete(doc.id); setOpenMenu(null); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-red-400 hover:bg-red-500/10"><Trash2 size={14} />Delete</button>
          )}
        </div>
      )}
    </div>
  );

  const filteredDocuments = documents
    .filter((doc) => doc.name.toLowerCase().includes(search.toLowerCase()))
    .filter((doc) =>
      filter === "all"
        ? true
        : filter === "null"
          ? (doc.collectionIds?.length ?? (doc.collectionId ? 1 : 0)) === 0
          : doc.collectionIds?.includes(filter) || doc.collectionId === filter
    )    .sort((a, b) => b.addedAt - a.addedAt);

  // Create the collection from the current name and selected color.
  const handleCreate = () => {
    if (!collectionName.trim()) return;
    onCreateCollection(collectionName.trim(), collectionColor);
    setCollectionName("");
    setShowCreate(false);
  };

  const activeCollection = collections.find((item) => item.id === activeCollectionId);
  if (activeCollection) {
    const collectionDocuments = documents.filter((doc) => doc.collectionIds?.includes(activeCollection.id) || doc.collectionId === activeCollection.id);
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
                    <p className="app-muted mt-1 text-xs">{(doc.size / 1024 / 1024).toFixed(2)} MB · {documentStatusLabel(doc)}</p>
                  </div>
                  {doc.error && <p className="w-full pl-8 text-xs text-red-400" title={doc.error}>{doc.error}</p>}
                  {renderDocumentActions(doc, true)}
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
              (doc) => doc.collectionIds?.includes(collection.id) || doc.collectionId === collection.id
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
                    {documentStatusLabel(doc)}
                  </p>
                  {doc.error && <p className="mt-1 text-xs text-red-400" title={doc.error}>{doc.error}</p>}
                </div>

                {renderDocumentActions(doc)}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
