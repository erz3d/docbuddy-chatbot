// Show a Word document as its extracted sections and scroll to a cited one.

import { useEffect, useState } from "react";
import { api } from "../../services/api";

interface Section {
  number: number;
  label: string | null;
  text: string;
}

interface SectionViewerProps {
  documentId: string;
  initialSection: number;
}

// Load a document's sections and highlight the section a citation points to.
// The parent sets key={documentId}, so state starts fresh for each document.
export default function SectionViewer({ documentId, initialSection }: SectionViewerProps) {
  const [sections, setSections] = useState<Section[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Section[]>(`/api/documents/${documentId}/sections`)
      .then((data) => {
        if (!cancelled) setSections(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    if (!sections) return;
    document
      .getElementById(`section-${initialSection}`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [sections, initialSection]);

  if (error) return <p className="app-muted p-4 text-sm">{error}</p>;
  if (!sections) return <p className="app-muted p-4 text-sm">Loading document...</p>;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      {sections.map((section) => (
        <section
          key={section.number}
          id={`section-${section.number}`}
          className={`app-surface rounded-xl border p-4 ${
            section.number === initialSection ? "border-teal-500/60" : "border-transparent"
          }`}
        >
          <p className="app-muted mb-2 text-[11px] uppercase tracking-wide">
            Section {section.number}
            {section.label ? ` · ${section.label}` : ""}
          </p>
          <p className="whitespace-pre-wrap text-sm leading-6">{section.text}</p>
        </section>
      ))}
    </div>
  );
}