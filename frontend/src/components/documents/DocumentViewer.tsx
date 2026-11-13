// Display a stored document in its format-specific preview.

import { X, FileText } from "lucide-react";
import type { DocumentItem } from "../../types";
import { documentFileUrl } from "../../services/api";
import { isSpreadsheetDocument, isWordDocument } from "../../services/documentService";
import SectionViewer from "./SectionViewer";
import SpreadsheetViewer from "./SpreadsheetViewer";

interface DocumentViewerProps {
  document: DocumentItem | null;
  initialUnit: number;
  onClose: () => void;
}

// Display the selected document in its matching preview.
export default function DocumentViewer({
  document,
  initialUnit,
  onClose,
}: DocumentViewerProps) {
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
        {isSpreadsheetDocument(document.name) ? (
          <SpreadsheetViewer
            key={document.backendId ?? document.id}
            documentId={document.backendId ?? document.id}
            initialSheet={initialUnit}
          />
        ) : isWordDocument(document.name) ? (
          <SectionViewer
            key={document.backendId ?? document.id}
            documentId={document.backendId ?? document.id}
            initialSection={initialUnit}
          />
        ) : document.id ? (
          <iframe
            key={`${document.id}-${initialUnit}`}
            src={`${document.url ?? documentFileUrl(document.id)}#page=${initialUnit}`}
            title={document.name}
            className="h-full min-h-[500px] w-full rounded-lg bg-white"
          />
        ) : (
          <div className="flex h-full min-h-[400px] items-center justify-center">
            <div className="app-surface max-w-sm rounded-2xl border p-8 text-center">
              <FileText size={42} className="mx-auto text-red-400" />
              <h3 className="mt-4 text-sm font-semibold">
                Document preview unavailable
              </h3>
              <p className="app-muted mt-2 text-xs leading-5">
                The document preview could not be loaded.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
