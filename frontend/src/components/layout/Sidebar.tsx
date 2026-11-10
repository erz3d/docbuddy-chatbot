// Render primary navigation, collections, and recent conversation controls.

import { useEffect, useRef, useState } from "react";
import {
    Files,
    Settings,
    Plus,
    ChevronDown,
    Folder,
    Star,
    X,
    Clock3,
    Pencil,
    MoreHorizontal,
    Archive,
    Trash2,
    Check,
} from "lucide-react";
import type { Collection, ConversationItem, Page } from "../../types";
import type { ReactNode } from "react";
  interface SidebarProps {
    page: Page;
    onNavigate: (page: Page) => void;
    collections: Collection[];
    onNewChat: () => void;
    mobileOpen: boolean;
    onMobileClose: () => void;
    conversations: ConversationItem[];
    activeConversationId: string | null;
    onSelectConversation: (id: string) => void;
    onSelectCollection: (id: string) => void;
    onRenameConversation: (id: string, title: string) => void;
    onArchiveConversation: (id: string) => void;
    onDeleteConversation: (id: string) => void;
    archivedCount: number;
  }
  
  // Provide navigation and conversation actions from the app sidebar.
  export default function Sidebar({
    page,
    onNavigate,
    collections,
    onNewChat,
    mobileOpen,
    onMobileClose,
    conversations,
    activeConversationId,
    onSelectConversation,
    onSelectCollection,
    onRenameConversation,
    onArchiveConversation,
    onDeleteConversation,
    archivedCount,
  }: SidebarProps) {
    const [collectionsOpen, setCollectionsOpen] = useState(true);
    const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
    const [draftTitle, setDraftTitle] = useState("");
    const [menuConversationId, setMenuConversationId] = useState<string | null>(null);
    const menuPanelRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (!menuConversationId) return;
      // Dismiss the open conversation menu when clicking elsewhere.
      const closeOnOutsideClick = (event: MouseEvent) => {
        if (!menuPanelRef.current?.contains(event.target as Node)) setMenuConversationId(null);
      };
      document.addEventListener("mousedown", closeOnOutsideClick);
      return () => document.removeEventListener("mousedown", closeOnOutsideClick);
    }, [menuConversationId]);
    // Change the active page and close the mobile navigation drawer.
    const navigate = (nextPage: Page) => {
      onNavigate(nextPage);
      onMobileClose();
    };
  
    return (
      <>
        {mobileOpen && (
          <button
            aria-label="Close navigation"
            onClick={onMobileClose}
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          />
        )}
  
        <aside
          className={`app-sidebar fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col border-r transition-transform duration-300 lg:static lg:translate-x-0 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-[76px] items-center justify-between border-b border-[var(--border)]">
            <div className="flex items-center gap-3">
              <img
                src="/docbuddy-logo.png"
                alt="DocBuddy logo"
                className="h-15 w-22"
              />
              <span className="text-xl font-bold tracking-tight">DocBuddy</span>
            </div>
  
            <button
              onClick={onMobileClose}
              className="app-muted rounded-lg p-2 hover:bg-[var(--surface-hover)] lg:hidden"
              aria-label="Close sidebar"
            >
              <X size={19} />
            </button>
          </div>
  
          <div className="p-4">
            <button
              onClick={() => {
                onNewChat();
                onMobileClose();
              }}
              className="accent-button flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
            >
              <Plus size={18} />
              New conversation
            </button>
          </div>
  
          <nav className="flex-1 space-y-1 overflow-y-auto px-3">
            <button onClick={() => navigate("history")} className={`app-muted app-surface-hover mt-6 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left ${page === "history" ? "bg-teal-500/10 text-[var(--accent)]" : ""}`}>
              <Clock3 size={14} />
              <span className="text-[10px] font-bold uppercase tracking-[0.16em]">Chat history</span>
            </button>
            {conversations.slice(0, 8).map((conversation) => (
              <div key={conversation.id} className={`relative flex items-center gap-1 rounded-lg ${activeConversationId === conversation.id ? "bg-teal-500/10 text-[var(--accent)]" : "app-muted app-surface-hover"}`}>
                {editingConversationId === conversation.id ? (
                  <form className="flex min-w-0 flex-1 gap-1 p-1" onSubmit={(event) => { event.preventDefault(); const title = draftTitle.trim(); if (title) onRenameConversation(conversation.id, title); setEditingConversationId(null); }}>
                    <input autoFocus value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} className="app-input min-w-0 flex-1 rounded px-2 py-1 text-xs" aria-label="Discussion title" />
                    <button className="app-muted px-1" title="Save title"><Check size={14} /></button>
                    <button type="button" onClick={() => setEditingConversationId(null)} className="app-muted px-1" title="Cancel"><X size={14} /></button>
                  </form>
                ) : (
                  <>
                    <button onClick={() => { onSelectConversation(conversation.id); onMobileClose(); }} className="flex min-w-0 flex-1 items-center px-3 py-2 text-left text-[11px]">
                      <span className="truncate">{conversation.title}</span>
                    </button>
                    <button onClick={() => setMenuConversationId(menuConversationId === conversation.id ? null : conversation.id)} className="app-muted rounded p-1.5 hover:bg-[var(--surface-hover)]" title="Discussion options" aria-label={`Options for ${conversation.title}`}>
                      <MoreHorizontal size={15} />
                    </button>
                    {menuConversationId === conversation.id && (
                      <div ref={menuPanelRef} className="app-surface absolute right-1 top-9 z-40 w-36 rounded-xl border p-1.5 shadow-xl">
                        <button onClick={() => { setEditingConversationId(conversation.id); setDraftTitle(conversation.title); setMenuConversationId(null); }} className="app-surface-hover flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs"><Pencil size={13} />Rename</button>
                        <button onClick={() => { onArchiveConversation(conversation.id); setMenuConversationId(null); }} className="app-surface-hover flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs"><Archive size={13} />Archive</button>
                        <button onClick={() => { onDeleteConversation(conversation.id); setMenuConversationId(null); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-red-400 hover:bg-red-500/10"><Trash2 size={13} />Delete</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
  
            <button
              onClick={() => navigate("documents")}
              className="accent-button mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
            >
              <Files size={18} />
              Document library
            </button>
  
            <button onClick={() => setCollectionsOpen((open) => !open)} aria-expanded={collectionsOpen} className="app-muted app-surface-hover flex w-full items-center justify-between rounded px-3 pb-2 pt-8 text-left">
              <p className="app-muted text-[10px] font-bold uppercase tracking-[0.16em]">
                Collections
              </p>
              <ChevronDown size={14} className={`app-muted transition-transform ${collectionsOpen ? "rotate-0" : "-rotate-90"}`} />
            </button>
  
            {collectionsOpen && collections.map((collection) => (
              <button
                key={collection.id}
                onClick={() => { onSelectCollection(collection.id); onMobileClose(); }}
                className="app-muted app-surface-hover flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition"
              >
                <Folder size={17} style={{ color: collection.color }} />
                <span className="flex-1 truncate">{collection.name}</span>
                {collection.favorite && (
                  <Star size={13} className="text-amber-400" />
                )}
              </button>
            ))}
  
          </nav>

          <div className="space-y-1 px-4 pb-2">
            <NavButton
              active={page === "settings"}
              icon={<Settings size={18} />}
              label="Settings"
              onClick={() => navigate("settings")}
            />
            <button onClick={() => navigate("archive")} className={`app-muted app-surface-hover flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${page === "archive" ? "bg-teal-500/10 text-[var(--accent)]" : ""}`}>
              <Archive size={17} />
              <span className="flex-1 text-left">Archive</span>
              {archivedCount > 0 && <span className="text-xs">{archivedCount}</span>}
            </button>
          </div>
  
          <div className="border-t border-[var(--border)] p-4">
            <div className="flex items-center gap-3 rounded-xl p-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500/15 text-sm font-bold text-teal-400">
                D
              </div>
              <div>
                <p className="text-sm font-semibold">My workspace</p>
                <p className="app-muted text-xs">Personal account</p>
              </div>
            </div>
          </div>
        </aside>
      </>
    );
  }
  
  // Render one page-navigation button with its active state.
  function NavButton({
    active,
    icon,
    label,
    onClick,
  }: {
    active: boolean;
    icon: ReactNode;
    label: string;
    onClick: () => void;
  }) {
    return (
      <button
        onClick={onClick}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
          active
            ? "bg-teal-500/10 font-semibold text-[var(--accent)]"
            : "app-muted app-surface-hover"
        }`}
      >
        {icon}
        {label}
      </button>
    );
  }
