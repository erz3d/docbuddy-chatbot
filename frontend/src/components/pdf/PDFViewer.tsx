import { X, FileText } from "lucide-react";
import type { DocumentItem } from "../../types";
import { documentFileUrl } from "../../services/api";

interface PDFViewerProps {
  document: DocumentItem | null;
  initialPage: number;
  onClose: () => void;
}

export default function PDFViewer({
  document,
  onClose,
}: PDFViewerProps) {
  if (!document) return null;

  return (
    <div className="app-background flex h-full min-w-0 flex-1 flex-col border-l border-[var(--border)]">
      <header className="flex h-[76px] shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-4">
        <div className="flex min-w-0 items-center gap-2">
          <FileText size={18} className="shrink-0 text-red-400" />
          <span className="truncate text-sm font-semibold">
            {document.name}
          </span>
        </div>

        <button
          onClick={onClose}
          title="Close viewer"
          className="app-muted rounded-lg p-2 hover:bg-[var(--surface-hover)]"
        >
          <X size={18} />
        </button>
      </header>

      <div className="flex-1 overflow-auto bg-black/5 p-4">
        {document.id ? (
          <iframe
            key={document.id}
            src={document.url ?? documentFileUrl(document.id)}
            title={document.name}
            className="h-full min-h-[500px] w-full rounded-lg bg-white"
          />
        ) : (
          <div className="flex h-full min-h-[400px] items-center justify-center">
            <div className="app-surface max-w-sm rounded-2xl border p-8 text-center">
              <FileText size={42} className="mx-auto text-red-400" />
              <h3 className="mt-4 text-sm font-semibold">
                PDF preview unavailable
              </h3>
              <p className="app-muted mt-2 text-xs leading-5">
                The PDF preview could not be loaded.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
