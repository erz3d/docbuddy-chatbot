import { Clock3, MessageSquare } from "lucide-react";
import type { ConversationItem } from "../../types";

interface ChatHistoryViewProps {
  conversations: ConversationItem[];
  onOpen: (id: string) => void;
}

export default function ChatHistoryView({ conversations, onOpen }: ChatHistoryViewProps) {
  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-3">
          <Clock3 size={23} className="accent-text" />
          <div>
            <h1 className="text-2xl font-bold">Chat history</h1>
            <p className="app-muted mt-1 text-sm">Your saved discussions.</p>
          </div>
        </div>
        <div className="mt-7 space-y-3">
          {conversations.length === 0 ? (
            <div className="app-surface rounded-xl border p-8 text-center app-muted text-sm">No saved discussions yet. A discussion is saved after its first message is sent.</div>
          ) : conversations.map((conversation) => (
            <button key={conversation.id} onClick={() => onOpen(conversation.id)} className="app-surface app-surface-hover flex w-full items-center gap-3 rounded-xl border p-4 text-left">
              <MessageSquare size={18} className="shrink-0 text-teal-500" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{conversation.title}</span>
                {conversation.preview && <span className="app-muted mt-1 block truncate text-xs">{conversation.preview}</span>}
              </span>
              <span className="app-muted hidden text-xs sm:block">{new Date(conversation.updatedAt).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
