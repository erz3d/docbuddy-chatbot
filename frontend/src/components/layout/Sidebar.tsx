import {
    MessageSquare,
    Files,
    Settings,
    Plus,
    Bot,
    ChevronDown,
    Folder,
    Star,
    X,
} from "lucide-react";
import type { Collection, Page } from "../../types";
import type  { ReactNode } from "react";
  interface SidebarProps {
    page: Page;
    onNavigate: (page: Page) => void;
    collections: Collection[];
    onNewChat: () => void;
    mobileOpen: boolean;
    onMobileClose: () => void;
  }
  
  export default function Sidebar({
    page,
    onNavigate,
    collections,
    onNewChat,
    mobileOpen,
    onMobileClose,
  }: SidebarProps) {
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
            <p className="app-muted px-3 pb-2 pt-3 text-[10px] font-bold uppercase tracking-[0.16em]">
              Workspace
            </p>

            <NavButton
              active={page === "chat"}
              icon={<MessageSquare size={18} />}
              label="Chat"
              onClick={() => navigate("chat")}
            />
  
            <NavButton
              active={page === "documents"}
              icon={<Files size={18} />}
              label="Document library"
              onClick={() => navigate("documents")}
            />
  
            <div className="flex items-center justify-between px-3 pb-2 pt-8">
              <p className="app-muted text-[10px] font-bold uppercase tracking-[0.16em]">
                Collections
              </p>
              <ChevronDown size={14} className="app-muted" />
            </div>
  
            {collections.map((collection) => (
              <button
                key={collection.id}
                onClick={() => navigate("documents")}
                className="app-muted app-surface-hover flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition"
              >
                <Folder size={17} style={{ color: collection.color }} />
                <span className="flex-1 truncate">{collection.name}</span>
                {collection.favorite && (
                  <Star size={13} className="text-amber-400" />
                )}
              </button>
            ))}
  
            <div className="pt-8">
              <p className="app-muted px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em]">
                Preferences
              </p>
  
              <NavButton
                active={page === "settings"}
                icon={<Settings size={18} />}
                label="Settings"
                onClick={() => navigate("settings")}
              />
            </div>
          </nav>
  
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