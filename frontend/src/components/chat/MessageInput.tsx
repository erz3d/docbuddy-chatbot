import { useRef, useState } from "react";
import {
  Paperclip,
  Send,    
  FileText,
  X,
  ChevronDown,
} from "lucide-react";
import type { DocumentItem } from "../../types";

interface MessageInputProps {
  documents: DocumentItem[];
  selectedIds: string[];
  onToggleDocument: (id: string) => void;
  onSend: (message: string) => void;
  onUpload: (files: FileList | null) => void;
  disabled?: boolean;
}

export default function MessageInput({
  documents,
  selectedIds,
  onToggleDocument,
  onSend,
  onUpload,
  disabled,
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [showDocuments, setShowDocuments] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!message.trim() || disabled) return;

    onSend(message.trim());
    setMessage("");
  };

  return (
    <div className="app-surface mx-auto w-full max-w-4xl rounded-2xl border p-3 shadow-lg shadow-black/5">
      {selectedIds.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selectedIds.map((id) => {
            const document = documents.find((doc) => doc.id === id);
            if (!document) return null;

            return (
              <span
                key={id}
                className="flex items-center gap-2 rounded-lg bg-teal-500/10 px-2.5 py-1.5 text-xs text-teal-500"
              >
                <FileText size={13} />
                <span className="max-w-40 truncate">{document.name}</span>
                <button
                  onClick={() => onToggleDocument(id)}
                  aria-label={`Remove ${document.name}`}
                >
                  <X size={13} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder="Ask anything about your documents..."
        rows={2}
        className="app-text w-full resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-[var(--muted)]"
      />

      <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
        <div className="flex items-center gap-1">
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

          <button
            onClick={() => fileInput.current?.click()}
            title="Attach PDF"
            className="app-muted app-surface-hover rounded-lg p-2"
          >
            <Paperclip size={18} />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowDocuments(!showDocuments)}
              className="app-muted app-surface-hover flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
            >
              <FileText size={15} />
              Documents ({selectedIds.length})
              <ChevronDown size={13} />
            </button>

            {showDocuments && (
              <div className="app-surface absolute bottom-12 left-0 z-30 max-h-64 w-64 overflow-y-auto rounded-xl border p-2 shadow-xl">
                {documents.length === 0 ? (
                  <p className="app-muted p-3 text-xs">
                    Upload a PDF to get started.
                  </p>
                ) : (
                  documents.map((doc) => (
                    <label
                      key={doc.id}
                      className="app-surface-hover flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(doc.id)}
                        onChange={() => onToggleDocument(doc.id)}
                        className="accent-teal-500"
                      />
                      <span className="truncate">{doc.name}</span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          className="accent-button flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
        >
          Send
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}