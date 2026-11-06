"""SQLite database setup for DocBuddy's local data."""

import sqlite3
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
DATABASE_PATH = BACKEND_DIR / "data" / "database.db"


def get_connection() -> sqlite3.Connection:
    """Open a connection with foreign key enforcement enabled."""
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database() -> None:
    """Create the local schema if it does not already exist."""
    with get_connection() as connection:
        connection.executescript(
            """
            PRAGMA journal_mode = WAL;

            CREATE TABLE IF NOT EXISTS collections (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL CHECK (length(trim(name)) > 0),
                color TEXT NOT NULL DEFAULT '#11C5AD',
                icon TEXT NOT NULL DEFAULT 'folder',
                favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );

            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
                name TEXT NOT NULL,
                mime_type TEXT NOT NULL DEFAULT 'application/pdf',
                size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
                content BLOB,
                status TEXT NOT NULL DEFAULT 'ready'
                    CHECK (status IN ('ready', 'uploading', 'failed')),
                added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );
            CREATE INDEX IF NOT EXISTS idx_documents_collection
                ON documents(collection_id);

            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT 'New conversation',
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                liked INTEGER CHECK (liked IN (0, 1) OR liked IS NULL),
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );
            CREATE INDEX IF NOT EXISTS idx_messages_conversation
                ON messages(conversation_id, created_at);

            CREATE TABLE IF NOT EXISTS citations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
                document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
                document_name TEXT NOT NULL,
                page INTEGER NOT NULL CHECK (page > 0)
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            """
        )
