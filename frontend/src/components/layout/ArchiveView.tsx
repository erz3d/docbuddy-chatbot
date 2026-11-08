import { Archive, MessageSquare, RotateCcw, Trash2 } from "lucide-react";
import type { ConversationItem } from "../../types";

interface ArchiveViewProps {
  conversations: ConversationItem[];
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ArchiveView({ conversations, onRestore, onDelete }: ArchiveViewProps) {
  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-3">
          <Archive size={24} className="accent-text" />
          <div>
            <h1 className="text-2xl font-bold">Archive</h1>
            <p className="app-muted mt-1 text-sm">Archived discussions are kept here until you restore or delete them.</p>
          </div>
        </div>
        <div className="mt-7 space-y-3">
          {conversations.length === 0 ? (
            <div className="app-surface rounded-xl border p-8 text-center app-muted text-sm">Your archive is empty.</div>
          ) : conversations.map((conversation) => (
            <div key={conversation.id} className="app-surface flex items-center gap-3 rounded-xl border p-4">
              <MessageSquare size={18} className="shrink-0 text-teal-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{conversation.title}</p>
                {conversation.preview && <p className="app-muted mt-1 truncate text-xs">{conversation.preview}</p>}
              </div>
              <button onClick={() => onRestore(conversation.id)} title="Restore discussion" className="app-muted app-surface-hover flex items-center gap-2 rounded-lg px-3 py-2 text-xs"><RotateCcw size={14} /><span className="hidden sm:inline">Restore</span></button>
              <button onClick={() => onDelete(conversation.id)} title="Delete discussion" className="rounded-lg p-2 text-red-400 hover:bg-red-500/10"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
