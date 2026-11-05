import { useEffect, useState } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
} from "lucide-react";
import type { DocumentItem } from "../../types";

interface PDFViewerProps {
  document: DocumentItem | null;
  initialPage: number;
  onClose: () => void;
}

export default function PDFViewer({
  document,
  initialPage,
  onClose,
}: PDFViewerProps) {
  const [page, setPage] = useState(initialPage);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    setPage(initialPage);
  }, [initialPage, document?.id]);

  useEffect(() => {
    setZoom(100);
  }, [document?.id]);

  if (!document) return null;

  const downloadDocument = () => {
    if (!document.url) return;

    const link = window.document.createElement("a");
    link.href = document.url;
    link.download = document.name;
    link.click();
  };

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

      <div className="app-surface flex shrink-0 items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            className="app-muted rounded-lg p-2 hover:bg-[var(--surface-hover)]"
            title="Previous page"
          >
            <ChevronLeft size={17} />
          </button>

          <span className="app-muted px-2 text-xs">
            Page {page}
          </span>

          <button
            onClick={() => setPage(page + 1)}
            className="app-muted rounded-lg p-2 hover:bg-[var(--surface-hover)]"
            title="Next page"
          >
            <ChevronRight size={17} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(Math.max(50, zoom - 10))}
            className="app-muted rounded-lg p-2 hover:bg-[var(--surface-hover)]"
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>

          <span className="app-muted min-w-10 text-center text-xs">
            {zoom}%
          </span>

          <button
            onClick={() => setZoom(Math.min(150, zoom + 10))}
            className="app-muted rounded-lg p-2 hover:bg-[var(--surface-hover)]"
            title="Zoom in"
          >
            <ZoomIn size={16} />
          </button>

          <button
            onClick={downloadDocument}
            disabled={!document.url}
            className="app-muted ml-2 rounded-lg p-2 hover:bg-[var(--surface-hover)]"
            title="Download PDF"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-black/5 p-4">
        {document.url ? (
          <iframe
            key={`${document.id}-${page}`}
            src={`${document.url}#page=${page}&zoom=${zoom}`}
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
                This sample document has no local PDF preview. Upload a real
                PDF to view it here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}