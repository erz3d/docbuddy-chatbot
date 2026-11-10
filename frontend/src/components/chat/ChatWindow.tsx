// Render the conversation header, messages, document controls, and chat states.

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  User,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Square,
  FileText,
  Sparkles,
  X,
  Pencil,
  PanelLeft,
} from "lucide-react";
import type {
  ChatMessage,
  DocumentItem,
  Citation,
} from "../../types";
import MessageInput from "./MessageInput";

interface ChatWindowProps {
  messages: ChatMessage[];
  documents: DocumentItem[];
  selectedIds: string[];
  isGenerating: boolean;
  onToggleDocument: (id: string) => void;
  onSend: (message: string) => void;
  onUpload: (files: FileList | null) => void;
  onStop: () => void;
  onRegenerate: () => void;
  onFeedback: (id: string, liked: boolean) => void;
  onCitation: (citation: Citation) => void;
  onViewDocument: (documentId: string) => void;
  conversationTitle: string;
  onRenameConversation: (title: string) => void;
}

const suggestions = [
  "Summarise my documents",
  "What are the key findings?",
  "Explain the most important concepts",
  "What should I remember?",
];

// Display the active chat and forward user actions to the app shell.
export default function ChatWindow({
  messages,
  documents,
  selectedIds,
  isGenerating,
  onToggleDocument,
  onSend,
  onUpload,
  onStop,
  onRegenerate,
  onFeedback,
  onCitation,
  onViewDocument,
  conversationTitle,
  onRenameConversation,
}: ChatWindowProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(conversationTitle);
  const [showPinnedDocuments, setShowPinnedDocuments] = useState(false);
  const [showViewDocumentMenu, setShowViewDocumentMenu] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pinnedPanelRef = useRef<HTMLElement>(null);
  const pinnedCountButtonRef = useRef<HTMLButtonElement>(null);
  const viewDocumentMenuRef = useRef<HTMLDivElement>(null);
  const pinnedDocuments = documents.filter((doc) => selectedIds.includes(doc.id));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isGenerating, selectedIds.length]);
  useEffect(() => {
    if (!showPinnedDocuments) return;
    // Close the view-document menu when a pointer event lands outside it.
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!pinnedPanelRef.current?.contains(target) && !pinnedCountButtonRef.current?.contains(target)) {
        setShowPinnedDocuments(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [showPinnedDocuments]);
  useEffect(() => {
    if (!showViewDocumentMenu) return;
    // Close the pinned-document panel when a pointer event lands outside it.
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!viewDocumentMenuRef.current?.contains(event.target as Node)) setShowViewDocumentMenu(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [showViewDocumentMenu]);

  // Copy a message's text to the system clipboard.
  const copyMessage = async (message: ChatMessage) => {
    await navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex h-[76px] items-center justify-between border-b border-[var(--border)] px-5 md:px-8">
        <div className="min-w-0">
          {editingTitle ? (
            <form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); const title = titleDraft.trim(); if (title) onRenameConversation(title); setEditingTitle(false); }}>
              <input autoFocus maxLength={120} value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} className="app-input min-w-0 max-w-sm rounded-lg px-2 py-1 text-sm font-semibold" aria-label="Discussion title" />
              <button className="accent-text text-xs font-semibold">Save</button>
              <button type="button" onClick={() => { setTitleDraft(conversationTitle); setEditingTitle(false); }} className="app-muted text-xs">Cancel</button>
            </form>
          ) : (
            <button onClick={() => { setTitleDraft(conversationTitle); setEditingTitle(true); }} className="group flex max-w-full items-center gap-2 text-left" title="Rename discussion">
              <h1 className="truncate text-sm font-semibold md:text-base">{conversationTitle}</h1>
              <Pencil size={13} className="app-muted shrink-0 opacity-60 group-hover:opacity-100" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            ref={pinnedCountButtonRef}
            onClick={() => setShowPinnedDocuments((open) => !open)}
            disabled={pinnedDocuments.length === 0}
            title={`${pinnedDocuments.length} ${pinnedDocuments.length === 1 ? "document" : "documents"} in this conversation`}
            aria-label={`${pinnedDocuments.length} documents in this conversation`}
            aria-expanded={showPinnedDocuments}
            className="app-muted app-surface-hover rounded-lg p-2 transition-colors duration-200 hover:text-[var(--accent)]"
          >
            <FileText size={18} />
          </button>
          <div className="relative" ref={viewDocumentMenuRef}>
            <button
              onClick={() => setShowViewDocumentMenu((open) => !open)}
              disabled={pinnedDocuments.length === 0}
              title="View document"
              aria-label="View document"
              aria-expanded={showViewDocumentMenu}
              className="app-muted app-surface-hover rounded-lg p-2 transition-colors duration-200 hover:text-[var(--accent)]"
            >
              <span className="flex items-center gap-2 px-1 text-sm">
                <PanelLeft size={18} />
                View document
              </span>
            </button>
            {showViewDocumentMenu && pinnedDocuments.length > 0 && (
              <div className="app-surface absolute right-0 top-full z-40 mt-2 max-h-64 w-64 overflow-y-auto rounded-xl border p-1.5 shadow-xl">
                {pinnedDocuments.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => { onViewDocument(doc.id); setShowViewDocumentMenu(false); }}
                    className="app-surface-hover flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs"
                    title={doc.name}
                  >
                    <FileText size={14} className="shrink-0 text-red-400" />
                    <span className="truncate">{doc.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8">
        <div className="mx-auto max-w-4xl">
          {showPinnedDocuments && pinnedDocuments.length > 0 && (
            <section ref={pinnedPanelRef} className="sticky top-0 z-20 mb-6 rounded-xl border border-teal-500/20 bg-[var(--background)] p-3 shadow-md">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-teal-500">Pinned for this chat</p>
              <div className="flex flex-wrap gap-2">
                {pinnedDocuments.map((document) => {
                  return (
                    <div key={document.id} className="app-surface flex max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                      <FileText size={14} className="shrink-0 text-red-400" />
                      <button onClick={() => onViewDocument(document.id)} className="max-w-64 truncate text-left font-medium hover:text-[var(--accent)]" title={`View ${document.name}`}>{document.name}</button>
                      <button onClick={() => onToggleDocument(document.id)} title={`Unpin ${document.name}`} aria-label={`Unpin ${document.name}`} className="app-muted rounded p-0.5 hover:bg-[var(--surface-hover)]">
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          {messages.length === 0 ? (
            <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10">
                <Bot size={30} className="accent-text" />
              </div>

              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                What can I help you discover?
              </h2>

              <p className="app-muted mt-3 max-w-md text-sm leading-6">
                Upload your PDFs and start asking questions. I'll help you
                understand your documents and find the information you need.
              </p>

              {documents.length === 0 ? (
                <p className="app-muted mt-8 flex items-center gap-2 text-xs">
                  <FileText size={15} />
                  Upload a PDF below to get started.
                </p>
              ) : (
                <div className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => onSend(suggestion)}
                      className="app-surface app-surface-hover rounded-xl border p-3 text-left text-xs transition"
                    >
                      <Sparkles
                        size={14}
                        className="accent-text mb-2"
                      />
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      message.role === "assistant"
                        ? "bg-teal-500/10 text-teal-500"
                        : "app-surface text-[var(--muted)]"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <Bot size={19} />
                    ) : (
                      <User size={19} />
                    )}
                  </div>

                  <div className="min-w-0 max-w-[85%]">
                    <p className="mb-2 text-xs font-semibold">
                      {message.role === "assistant" ? "DocBuddy" : "You"}
                    </p>

                    <div
                      className={`whitespace-pre-wrap text-sm leading-7 ${
                        message.role === "user"
                          ? "app-surface rounded-2xl rounded-tr-sm px-4 py-3"
                          : ""
                      }`}
                    >
                      {message.content}
                    </div>

                    {message.citations && message.citations.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.citations.map((citation, index) => (
                          <button
                            key={`${citation.documentId}-${index}`}
                            onClick={() => onCitation(citation)}
                            className="flex items-center gap-1.5 rounded-lg border border-teal-500/20 bg-teal-500/5 px-2.5 py-1.5 text-[11px] text-teal-500 hover:bg-teal-500/10"
                          >
                            <FileText size={12} />
                            {citation.documentName}, p. {citation.page}
                          </button>
                        ))}
                      </div>
                    )}

                    {message.role === "assistant" && (
                      <div className="app-muted mt-3 flex items-center gap-1">
                        <button
                          onClick={() => copyMessage(message)}
                          title="Copy response"
                          className="rounded-md p-2 hover:bg-[var(--surface-hover)]"
                        >
                          {copiedId === message.id ? (
                            <span className="text-xs text-teal-500">Copied!</span>
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>

                        <button
                          onClick={() => onFeedback(message.id, true)}
                          title="Like response"
                          className={`rounded-md p-2 hover:bg-[var(--surface-hover)] ${
                            message.liked === true ? "text-teal-500" : ""
                          }`}
                        >
                          <ThumbsUp size={14} />
                        </button>

                        <button
                          onClick={() => onFeedback(message.id, false)}
                          title="Dislike response"
                          className={`rounded-md p-2 hover:bg-[var(--surface-hover)] ${
                            message.liked === false ? "text-red-400" : ""
                          }`}
                        >
                          <ThumbsDown size={14} />
                        </button>

                        <button
                          onClick={onRegenerate}
                          title="Regenerate response"
                          className="rounded-md p-2 hover:bg-[var(--surface-hover)]"
                        >
                          <RotateCcw size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isGenerating && (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-500">
                    <Bot size={19} />
                  </div>
                  <div className="app-muted flex items-center gap-2 text-sm">
                    <span className="animate-pulse">DocBuddy is thinking...</span>
                    <button
                      onClick={onStop}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                    >
                      <Square size={11} />
                      Stop
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="px-4 pb-5 pt-2 md:px-8">
        <MessageInput
          documents={documents}
          selectedIds={selectedIds}
          onToggleDocument={onToggleDocument}
          onSend={onSend}
          onUpload={onUpload}
          disabled={isGenerating}
        />
        <p className="app-muted mt-3 text-center text-[10px]">
          Answers are generated from your selected PDFs and chat history.
        </p>
      </div>
    </div>
  );
}   
