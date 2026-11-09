"""SQLite database setup for DocBuddy's local data."""

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

BACKEND_DIR = Path(__file__).resolve().parents[1]
DATABASE_PATH = BACKEND_DIR / "data" / "database.db"


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    """Open a connection with foreign key enforcement enabled."""
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


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
            CREATE TABLE IF NOT EXISTS document_pages (
                document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                page_number INTEGER NOT NULL CHECK (page_number > 0),
                text TEXT NOT NULL,
                PRIMARY KEY (document_id, page_number)
            );
            CREATE INDEX IF NOT EXISTS idx_documents_collection
                ON documents(collection_id);
            CREATE TABLE IF NOT EXISTS document_collections (
                document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
                PRIMARY KEY (document_id, collection_id)
            );
            CREATE INDEX IF NOT EXISTS idx_document_collections_collection
                ON document_collections(collection_id, document_id);

            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT 'New conversation',
                archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );
            CREATE TABLE IF NOT EXISTS conversation_documents (
                conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                pinned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                PRIMARY KEY (conversation_id, document_id)
            );
            CREATE INDEX IF NOT EXISTS idx_conversation_documents_document
                ON conversation_documents(document_id, conversation_id);
            CREATE TABLE IF NOT EXISTS conversation_document_history (
                conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                first_pinned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                PRIMARY KEY (conversation_id, document_id)
            );
            CREATE INDEX IF NOT EXISTS idx_conversation_document_history_document
                ON conversation_document_history(document_id, conversation_id);
            INSERT OR IGNORE INTO conversation_document_history(conversation_id,document_id)
                SELECT conversation_id,document_id FROM conversation_documents;

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
        conversation_columns = {row["name"] for row in connection.execute("PRAGMA table_info(conversations)")}
        if "archived" not in conversation_columns:
            connection.execute("ALTER TABLE conversations ADD COLUMN archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1))")
        connection.execute("""
            INSERT OR IGNORE INTO document_collections(document_id, collection_id)
            SELECT id, collection_id FROM documents WHERE collection_id IS NOT NULL
        """)
