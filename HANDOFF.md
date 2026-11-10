# DocBuddy project handoff

Use this note to continue work on DocBuddy in a fresh context. The repository is `C:\Users\User\Desktop\docbuddy`.

## App overview

- Desktop launcher: `desktop.py` starts the FastAPI backend on `127.0.0.1:3001` and Vite on `127.0.0.1:5173`, then opens the desktop webview.
- Frontend: React + TypeScript + Vite in `frontend/`.
- Backend: FastAPI in `backend/src/`.
- Local database: SQLite at `backend/data/database.db`.
- OpenAI settings are read from `backend/.env` (`OPENAI_API_KEY`, `OPENAI_MODEL`). Keep secrets and local user data out of Git.

## Current persistence and document processing

- SQLite stores document metadata, extracted page text, collections and many-to-many document membership, conversations/messages, settings, archive state, feedback, citations, and document pins.
- New PDF bytes are streamed to `backend/data/documents/`; SQLite stores each file path. On backend startup, legacy PDF BLOBs are moved to files and cleared from SQLite. The directory is ignored by `backend/.gitignore`.
- Library uploads save immediately. PDFs attached in chat are staged in frontend memory until the user sends a message with them selected.
- Chat draft histories are persisted before attachment processing and before the model call. The chat API also persists submitted messages before contacting the model; assistant replies are saved after successful generation.
- Upload processing currently reports `uploading`, `extracting`, then `ready_for_indexing`; failures are saved with a user-facing error. Interrupted extraction jobs resume at backend startup.
- `document_pages` contains one extracted text record per page. There is not yet chunking, embeddings, a vector store, or retrieval. `backend/src/services/openai_service.py` still sends all selected document pages as model context. This is the next planned task (Task 3: RAG retrieval).
- The actual indexing stage is intentionally deferred to Task 3. `ready_for_indexing` is the handoff state after extraction.
- A new app launch opens a fresh chat; saved conversations remain accessible from Chat history.

## Recent UI features

- Collection detail views show documents and conversations that used those documents.
- A document can belong to multiple collections.
- Document rows use a three-dot menu with collection actions.
- The PDF viewer opens full width from the library and in a split layout from an active chat.
- In chat, the document icon opens the pinned-document panel. The View document control opens a menu of documents in the conversation. There is no TXT export control.
- Conversation titles can be renamed; conversations can be archived or deleted. Archive and Chat history views are available from the sidebar.
- The app always starts on a new chat. The sidebar shows up to eight recent saved conversations.

## Code organization after the modularity refactor

- `frontend/src/App.tsx`: application shell, page selection, chat orchestration, and workspace state.
- `frontend/src/hooks/useWorkspaceLoader.ts`: loads persisted workspace state and resumes polling for documents still extracting.
- `frontend/src/hooks/useDocumentUploads.ts`: staged chat uploads, library uploads, extraction polling, and cleanup.
- `frontend/src/services/documentService.ts`: upload API call and processing-status polling.
- `backend/src/api/collections.py`: collection endpoints.
- `backend/src/api/documents.py`: document upload, status, file, delete, and membership endpoints.
- `backend/src/services/document_storage.py`: streamed PDF save and file deletion.
- `backend/src/services/document_processing.py`: PDF text extraction, processing status, and errors.
- `backend/src/services/conversation_service.py`: shared conversation-history and assistant-message persistence used by both draft and chat routes.
- `backend/src/api/chat.py`: chat request validation and model orchestration.
- `backend/src/api/conversations.py`: conversation, title, archive, pins, feedback, and history endpoints.
- `backend/src/database.py`: SQLite path, schema, and startup migrations.
- `backend/src/services/openai_service.py`: current full-page context construction and model request; likely Task 3 integration point.

## Task 3 starting point

Implement RAG retrieval on top of extracted `document_pages`:

1. Choose a local vector store/index approach that fits this desktop app.
2. Split page text into chunks and retain document ID, document name, and page number on each chunk.
3. Generate and persist embeddings, with index status/error updates per document.
4. Retrieve relevant chunks for each user question instead of sending every page.
5. Keep citation source metadata available so the later citation task can link answers back to document pages.

Do not assume an index already exists. Preserve the current disk-backed PDF storage and conversation behavior while integrating indexing.

## Verification and environment notes

- After the modularity refactor, `npm.cmd run lint` and `npm.cmd run build` passed from `frontend/`.
- `python -m compileall -q src` passed from `backend/`.
- Backend API behavior has not been run end to end in the current Python environment because FastAPI is not installed there. Install backend dependencies from `backend/requirements.txt` or use the project runtime before confirming upload, extraction, startup migration, and restart recovery.
- The current working tree contains uncommitted changes from the storage, processing, and modularity work. Review `git status` before making further edits.

## Git and personal data

- `backend/data/database.db` is tracked by Git. Ignore rules do not untrack a file already tracked. An earlier request to remove it from the index was rejected, so leave it tracked unless the user asks again.
- `backend/.gitignore` ignores database WAL/SHM files and `data/documents/` so newly uploaded PDFs are not added to Git.
- Keep local database contents, uploaded documents, `.env` values, and other personal data out of commits.
