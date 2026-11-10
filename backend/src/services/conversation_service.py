# Persist conversation drafts and assistant replies for the chat API.

import uuid
from datetime import datetime, timezone
from typing import Protocol, Sequence

from src.database import get_connection


class ConversationMessage(Protocol):
    id: str | None
    role: str
    content: str
    liked: bool | None
    timestamp: str | int | None


class MissingDocumentsError(ValueError):
    """Raised when a requested conversation document does not exist."""


def persist_conversation_history(
    conversation_id: str,
    messages: Sequence[ConversationMessage],
    document_ids: Sequence[str],
    *,
    require_documents: bool = True,
) -> None:
    # Replace a conversation's messages and synchronize its document links.
    now = datetime.now(timezone.utc).isoformat()
    first_user = next((message.content for message in messages if message.role == "user"), "New conversation")
    unique_document_ids = list(dict.fromkeys(document_ids))

    with get_connection() as db:
        if not db.execute("SELECT 1 FROM conversations WHERE id=?", (conversation_id,)).fetchone():
            db.execute("INSERT INTO conversations(id,title) VALUES(?,?)",
                       (conversation_id, first_user[:70] or "New conversation"))
        if unique_document_ids:
            placeholders = ",".join("?" for _ in unique_document_ids)
            found = db.execute(f"SELECT id FROM documents WHERE id IN ({placeholders})", unique_document_ids).fetchall()
            if require_documents and len(found) != len(unique_document_ids):
                raise MissingDocumentsError("One or more documents were not found")
            found_ids = {row["id"] for row in found}
            unique_document_ids = [document_id for document_id in unique_document_ids if document_id in found_ids]

        db.execute("DELETE FROM messages WHERE conversation_id=?", (conversation_id,))
        for message in messages:
            timestamp = (
                datetime.fromtimestamp(message.timestamp / 1000, timezone.utc).isoformat()
                if isinstance(message.timestamp, int)
                else message.timestamp or now
            )
            db.execute(
                "INSERT INTO messages(id,conversation_id,role,content,liked,created_at) VALUES(?,?,?,?,?,?)",
                (message.id or str(uuid.uuid4()), conversation_id, message.role, message.content,
                 None if message.liked is None else int(message.liked), timestamp),
            )

        db.execute("DELETE FROM conversation_documents WHERE conversation_id=?", (conversation_id,))
        db.executemany(
            "INSERT INTO conversation_documents(conversation_id,document_id) VALUES(?,?)",
            [(conversation_id, document_id) for document_id in unique_document_ids],
        )
        db.executemany(
            "INSERT OR IGNORE INTO conversation_document_history(conversation_id,document_id) VALUES(?,?)",
            [(conversation_id, document_id) for document_id in unique_document_ids],
        )
        db.execute(
            "UPDATE conversations SET title=CASE WHEN title='New conversation' THEN ? ELSE title END,updated_at=? WHERE id=?",
            (first_user[:70] or "New conversation", now, conversation_id),
        )


def persist_assistant_message(conversation_id: str, message_id: str, content: str) -> str:
    # Store an assistant reply and update the conversation's activity time.
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as db:
        db.execute(
            "INSERT INTO messages(id,conversation_id,role,content,created_at) VALUES(?,?,?,?,?)",
            (message_id, conversation_id, "assistant", content, now),
        )
        db.execute("UPDATE conversations SET updated_at=? WHERE id=?", (now, conversation_id))
    return now
