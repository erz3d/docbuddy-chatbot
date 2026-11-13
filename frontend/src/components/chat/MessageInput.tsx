// Render the chat composer, attachment controls, and send action.

import { useRef, useState } from "react";
import {
  Paperclip,
  Send,
  FileText,
  ChevronDown,
  Check,
} from "lucide-react";
import type { DocumentItem } from "../../types";
import { UPLOAD_ACCEPT } from "../../services/documentService";

interface MessageInputProps {
  documents: DocumentItem[];
  selectedIds: string[];
  onToggleDocument: (id: string) => void;
  onSend: (message: string) => void;
  onUpload: (files: FileList | null) => void;
  disabled?: boolean;
}

// Collect a message and optional files before passing them to the chat view.
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

  // Submit non-empty text and reset the composer after sending.
  const handleSend = () => {
    if (!message.trim() || disabled) return;

    onSend(message.trim());
    setMessage("");
  };

  return (
    <div className="app-surface mx-auto w-full max-w-4xl rounded-2xl border p-3 shadow-lg shadow-black/5">
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
            accept={UPLOAD_ACCEPT}
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
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => {
                        onToggleDocument(doc.id);
                        setShowDocuments(false);
                      }}
                      className="app-surface-hover flex w-full items-center gap-2 rounded-lg p-2 text-left text-xs"
                    >
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selectedIds.includes(doc.id) ? "border-teal-500 bg-teal-500 text-white" : "border-[var(--border)]"}`}>
                        {selectedIds.includes(doc.id) && <Check size={11} />}
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block truncate">{doc.name}</span>
                        {doc.error ? <span className="block truncate text-[10px] text-red-400">{doc.error}</span> : doc.stage === "extracting" ? <span className="app-muted block text-[10px]">Extracting text…</span> : doc.stage === "ocr" ? <span className="app-muted block text-[10px]">Running OCR…</span> : null}
                      </span>
                    </button>
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
