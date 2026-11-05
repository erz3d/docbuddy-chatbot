import { useState } from "react";
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
  Download,
  PanelRight,
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
  onViewDocument: () => void;
}

const suggestions = [
  "Summarise my documents",
  "What are the key findings?",
  "Explain the most important concepts",
  "What should I remember?",
];

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
}: ChatWindowProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyMessage = async (message: ChatMessage) => {
    await navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const exportConversation = () => {
    const text = messages
      .map((message) => {
        const role = message.role === "user" ? "You" : "DocBuddy";
        return `${role}:\n${message.content}`;
      })
      .join("\n\n");

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "docbuddy-conversation.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex h-[76px] items-center justify-between border-b border-[var(--border)] px-5 md:px-8">
        <div>
          <h1 className="text-sm font-semibold md:text-base">Document Chat</h1>
          <p className="app-muted mt-1 text-xs">
            {documents.length} documents in your library
          </p>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={exportConversation}
              title="Export conversation as TXT"
              className="app-muted app-surface-hover rounded-lg p-2"
            >
              <Download size={18} />
            </button>
          )}

          <button
            onClick={onViewDocument}
            className="app-muted app-surface-hover flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
          >
            <PanelRight size={17} />
            <span className="hidden sm:inline">View document</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8">
        <div className="mx-auto max-w-4xl">
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
          DocBuddy uses simulated responses in this frontend prototype.
        </p>
      </div>
    </div>
  );
}   