import { useState } from "react";
import { Moon, Sun, Trash2, Pencil, Check, X } from "lucide-react";
import type { Theme } from "../../types";

interface SettingsPanelProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  appName: string;
  onAppNameChange: (name: string) => void;
  onClearHistory: () => void;
}

export default function SettingsPanel({
  theme,
  onThemeChange,
  appName,
  onAppNameChange,
  onClearHistory,
}: SettingsPanelProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(appName);

  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="app-muted mt-2 text-sm">
          Personalise your DocBuddy experience.
        </p>

        <section className="app-surface mt-8 rounded-2xl border p-5">
          <h2 className="text-sm font-semibold">Appearance</h2>
          <p className="app-muted mt-1 text-xs">
            Choose how DocBuddy looks on your device.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              onClick={() => onThemeChange("dark")}
              className={`flex items-center gap-3 rounded-xl border p-4 ${
                theme === "dark"
                  ? "border-teal-500 bg-teal-500/10"
                  : "border-[var(--border)]"
              }`}
            >
              <Moon size={20} className="accent-text" />
              <span className="text-sm font-medium">Dark mode</span>
            </button>

            <button
              onClick={() => onThemeChange("light")}
              className={`flex items-center gap-3 rounded-xl border p-4 ${
                theme === "light"
                  ? "border-teal-500 bg-teal-500/10"
                  : "border-[var(--border)]"
              }`}
            >
              <Sun size={20} className="accent-text" />
              <span className="text-sm font-medium">Light mode</span>
            </button>
          </div>
        </section>

        <section className="app-surface mt-4 rounded-2xl border p-5">
          <h2 className="text-sm font-semibold">Application name</h2>
          <p className="app-muted mt-1 text-xs">
            Change the name displayed in your workspace.
          </p>

          {editing ? (
            <div className="mt-4 flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="app-input min-w-0 flex-1 rounded-lg px-3 py-2 text-sm"
              />

              <button
                onClick={() => {
                  if (name.trim()) onAppNameChange(name.trim());
                  setEditing(false);
                }}
                className="rounded-lg bg-teal-500/10 p-2 text-teal-500"
                aria-label="Save application name"
              >
                <Check size={18} />
              </button>

              <button
                onClick={() => {
                  setName(appName);
                  setEditing(false);
                }}
                className="app-muted rounded-lg p-2 hover:bg-[var(--surface-hover)]"
                aria-label="Cancel editing"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm font-medium">{appName}</span>
              <button
                onClick={() => setEditing(true)}
                className="app-muted app-surface-hover flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
              >
                <Pencil size={14} />
                Edit name
              </button>
            </div>
          )}
        </section>

        <section className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
          <h2 className="text-sm font-semibold">Clear chat history</h2>
          <p className="app-muted mt-1 text-xs">
            Delete your current conversation messages. Your uploaded PDFs will
            remain in your library.
          </p>

          <button
            onClick={() => {
              if (
                window.confirm(
                  "Are you sure you want to clear your chat history?"
                )
              ) {
                onClearHistory();
              }
            }}
            className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10"
          >
            <Trash2 size={15} />
            Clear chat history
          </button>
        </section>
      </div>
    </div>
  );
}