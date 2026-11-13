// Preview spreadsheet sheets and choose which ones are included in document retrieval.

import { useEffect, useMemo, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { api } from "../../services/api";

type CellValue = string | number | boolean | null;
interface SpreadsheetSheet {
  number: number;
  name: string;
  data: { headers: string[]; rows: CellValue[][]; rowNumbers: number[] };
  selected: boolean;
}

interface SpreadsheetViewerProps {
  documentId: string;
  initialSheet: number;
}

const PREVIEW_ROWS = 100;

function displayCell(value: CellValue) {
  if (value === null) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value);
}

export default function SpreadsheetViewer({ documentId, initialSheet }: SpreadsheetViewerProps) {
  const [sheets, setSheets] = useState<SpreadsheetSheet[] | null>(null);
  const [activeNumber, setActiveNumber] = useState(initialSheet);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<SpreadsheetSheet[]>(`/api/documents/${documentId}/sheets`)
      .then((result) => {
        if (!cancelled) {
          setSheets(result);
          if (!result.some((sheet) => sheet.number === initialSheet) && result[0]) setActiveNumber(result[0].number);
        }
      })
      .catch((err: Error) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [documentId, initialSheet]);

  const activeSheet = useMemo(() => sheets?.find((sheet) => sheet.number === activeNumber) ?? sheets?.[0], [sheets, activeNumber]);

  const saveSelection = async (next: SpreadsheetSheet[]) => {
    if (!sheets) return;
    setSheets(next);
    setSaving(true);
    try {
      await api(`/api/documents/${documentId}/sheets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedNumbers: next.filter((sheet) => sheet.selected).map((sheet) => sheet.number) }),
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSheets(sheets);
    } finally {
      setSaving(false);
    }
  };

  if (error && !sheets) return <p className="app-muted p-4 text-sm">{error}</p>;
  if (!sheets) return <p className="app-muted flex items-center gap-2 p-4 text-sm"><LoaderCircle size={15} className="animate-spin" />Loading spreadsheet…</p>;
  if (sheets.length === 0) return <p className="app-muted p-4 text-sm">Spreadsheet preview is not ready yet. Try again after extraction finishes.</p>;

  const selectedCount = sheets.filter((sheet) => sheet.selected).length;
  const visibleRows = activeSheet?.data.rows.slice(0, PREVIEW_ROWS) ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="app-surface rounded-xl border p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Choose sheets for chat search</p>
            <p className="app-muted mt-1 text-xs">{selectedCount} of {sheets.length} sheets included in answers{saving ? " · Saving…" : ""}</p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => saveSelection(sheets.map((sheet) => ({ ...sheet, selected: selectedCount !== sheets.length })))}
            className="app-muted app-surface-hover rounded-lg px-3 py-2 text-xs"
          >{selectedCount === sheets.length ? "Deselect all" : "Select all"}</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {sheets.map((sheet) => (
            <div key={sheet.number} className={`flex items-center rounded-lg border ${activeNumber === sheet.number ? "border-teal-500/60" : "border-[var(--border)]"}`}>
              <button type="button" onClick={() => setActiveNumber(sheet.number)} className="app-surface-hover rounded-l-lg px-3 py-2 text-xs">{sheet.name}</button>
              <button
                type="button"
                aria-label={`${sheet.selected ? "Exclude" : "Include"} ${sheet.name} in chat search`}
                disabled={saving}
                onClick={() => saveSelection(sheets.map((item) => item.number === sheet.number ? { ...item, selected: !item.selected } : item))}
                className={`rounded-r-lg border-l border-[var(--border)] px-2 py-2 ${sheet.selected ? "text-teal-500" : "app-muted"}`}
              >{sheet.selected ? <Check size={14} /> : "–"}</button>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-400">Could not save sheet selection: {error}</p>}
      {activeSheet && (
        <div className="app-surface overflow-hidden rounded-xl border">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">{activeSheet.name}</h3>
              <p className="app-muted mt-1 text-xs">{activeSheet.data.rows.length} data rows · {activeSheet.data.headers.length} columns</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] ${activeSheet.selected ? "bg-teal-500/10 text-teal-500" : "app-muted bg-[var(--surface-hover)]"}`}>
              {activeSheet.selected ? "Included in chat search" : "Excluded from chat search"}
            </span>
          </div>
          {activeSheet.data.headers.length === 0 ? (
            <p className="app-muted p-5 text-sm">This sheet is empty.</p>
          ) : (
            <div className="max-h-[65vh] overflow-auto">
              <table className="min-w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 bg-[var(--surface)]">
                  <tr>
                    <th className="app-muted border-b border-r border-[var(--border)] px-3 py-2 font-medium">Row</th>
                    {activeSheet.data.headers.map((header, index) => <th key={`${index}-${header}`} className="border-b border-r border-[var(--border)] px-3 py-2 font-semibold">{header || `Column ${index + 1}`}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, rowIndex) => (
                    <tr key={activeSheet.data.rowNumbers[rowIndex] ?? rowIndex + 2} className="hover:bg-[var(--surface-hover)]">
                      <td className="app-muted border-b border-r border-[var(--border)] px-3 py-2">{activeSheet.data.rowNumbers[rowIndex] ?? rowIndex + 2}</td>
                      {activeSheet.data.headers.map((_, columnIndex) => {
                        const value = row[columnIndex] ?? null;
                        return <td key={columnIndex} className="max-w-72 border-b border-r border-[var(--border)] px-3 py-2">{displayCell(value)}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {activeSheet.data.rows.length > PREVIEW_ROWS && <p className="app-muted border-t border-[var(--border)] px-4 py-2 text-xs">Showing the first {PREVIEW_ROWS} of {activeSheet.data.rows.length} rows. All rows remain available to chat search.</p>}
        </div>
      )}
    </div>
  );
}
