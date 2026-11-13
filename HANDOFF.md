# DocBuddy project handoff

Use this note to continue work on DocBuddy in a fresh context. The repository is `C:\Users\User\Desktop\docbuddy`.

## App overview

- Desktop launcher: `desktop.py` starts the FastAPI backend on `127.0.0.1:3001` and Vite on `127.0.0.1:5173`, then opens the desktop webview.
- Frontend: React + TypeScript + Vite in `frontend/`.
- Backend: FastAPI in `backend/src/`.
- Local database: SQLite at `backend/data/database.db`.
- OpenAI settings are read from `backend/.env` (`OPENAI_API_KEY`, `OPENAI_MODEL`). Keep secrets and local user data out of Git.

## Current persistence and document processing

- SQLite stores document metadata, extracted text units, spreadsheet preview data and sheet-selection state, chunks and embeddings, collections and memberships, conversations/messages, settings, archive state, feedback, citations, and document pins.
- Original PDF, DOCX, CSV, and XLSX bytes are streamed to `backend/data/documents/`; SQLite stores each file path. The directory is ignored by `backend/.gitignore`.
- Library uploads save immediately. Documents attached in chat remain staged in frontend memory until the user sends a message with them selected.
- Chat draft histories are persisted before attachment processing and before the model call. The chat API also persists submitted messages before contacting the model; assistant replies and structured citations are saved after successful generation.
- Upload processing reports `uploading`, `extracting`, `indexing`, then `indexed`; extraction and indexing failures are saved with a user-facing error. Interrupted upload/indexing jobs resume at backend startup.
- `document_pages` stores PDF pages, Word sections, or spreadsheet sheets. Its `label` holds section/sheet names; spreadsheet rows, headers, and cell values are stored as JSON in `structured_data`. The `selected` flag controls which spreadsheet sheets retrieval may use and defaults to selected for existing/new units.
- `document_chunks` stores overlapping page-aware chunks and their OpenAI embeddings in SQLite. Retrieval ranks chunks by cosine similarity from documents selected in the current chat and excludes spreadsheet sheets whose `selected` flag is false.
- Spreadsheet extraction is local. XLSX cells retain numeric, boolean, and string values; date/time values are serialized to ISO strings and formulas remain formula text. CSV is treated as one sheet named after the source filename; unambiguous numeric values are inferred while leading-zero identifiers remain strings.
- **Embedding caveat:** all extracted spreadsheet sheets are embedded during initial indexing. Sheet selection filters retrieval after indexing; it does not avoid or undo embeddings for excluded sheets.
- The embedding model defaults to `text-embedding-3-small` and can be overridden with `OPENAI_EMBEDDING_MODEL` in `backend/.env`. Changing the model triggers reindexing at startup. Embedding requests send extracted document text and chat questions to OpenAI; answer requests receive retrieved chunks as document context alongside chat history.
- Retrieved chunks retain document ID, document name, page/unit number, and label. Answers cite PDFs by page, Word files by section, and spreadsheets by sheet name; citations are matched to retrieved sources and persisted with assistant messages.
- A new app launch opens a fresh chat; saved conversations remain accessible from Chat history.

## Recent UI features

- Collection detail views show documents and conversations that used those documents.
- A document can belong to multiple collections.
- Document rows use a three-dot menu with collection actions.
- The document viewer opens full width from the library and in a split layout from an active chat. It previews PDFs, extracted Word sections, and CSV/XLSX tables.
- Spreadsheet previews show sheet names, headers, row numbers, and typed values. Users can include/exclude sheets for chat retrieval; choices persist in SQLite.
- In chat, the document icon opens the pinned-document panel. The View document control opens a menu of documents in the conversation. There is no TXT export control.
- Conversation titles can be renamed; conversations can be archived or deleted. Archive and Chat history views are available from the sidebar.
- The app always starts on a new chat. The sidebar shows up to eight recent saved conversations.

## Code organization after the modularity refactor

- `frontend/src/App.tsx`: application shell, page selection, chat orchestration, and workspace state.
- `frontend/src/hooks/useWorkspaceLoader.ts`: loads persisted workspace state and resumes polling for documents still extracting.
- `frontend/src/hooks/useDocumentUploads.ts`: staged chat uploads, library uploads, extraction polling, and cleanup.
- `frontend/src/services/documentService.ts`: upload API call and processing-status polling.
- `frontend/src/components/pdf/SpreadsheetViewer.tsx`: spreadsheet preview and persisted sheet-selection controls.
- `backend/src/api/collections.py`: collection endpoints.
- `backend/src/api/documents.py`: document upload, status, file, spreadsheet preview/selection, delete, and membership endpoints.
- `backend/src/services/document_storage.py`: streamed original-file save and file deletion.
- `backend/src/services/document_extractors.py`: PDF page, DOCX section, CSV sheet, and XLSX sheet extraction.
- `backend/src/services/document_processing.py`: extraction, structured unit persistence, and handoff to indexing.
- `backend/src/services/document_indexing.py`: page chunking, embedding batches, SQLite index persistence, and per-document index status.
- `backend/src/services/document_retrieval.py`: question embeddings, selected-document cosine ranking, and source-aware context formatting.
- `backend/src/services/openai_clients.py`: shared synchronous and asynchronous OpenAI clients.
- `backend/src/services/conversation_service.py`: shared conversation-history and assistant-message persistence used by both draft and chat routes.
- `backend/src/api/chat.py`: chat request validation and model orchestration.
- `backend/src/api/conversations.py`: conversation, title, archive, pins, feedback, and history endpoints.
- `backend/src/database.py`: SQLite path, schema, and startup migrations.
- `backend/src/services/openai_service.py`: retrieval integration, answer instructions, and model request.

## Current implementation status

- RAG retrieval and structured citation persistence/clickable citation metadata are implemented.
- Spreadsheet support for CSV/XLSX upload, extraction, preview, sheet selection, RAG filtering, and sheet citations is implemented in commit `8c42002` (`Spreadsheet support implemented`). No lint/build or end-to-end checks have been recorded for this spreadsheet change.
- OCR support is **not present in the current source tree**. Scanned PDFs without selectable text fail extraction; do not rely on older OCR notes from prior handoffs.
- The next task is not specified yet. Preserve disk-backed document storage and conversation persistence when continuing.

## Verification and environment notes

- Earlier frontend lint/build and backend compilation checks passed for prior work. Those checks do not cover the spreadsheet implementation.
- Spreadsheet upload, extraction, startup migration, indexing, sheet selection, and citations have not been verified end to end. Install backend dependencies from `backend/requirements.txt` or use the project runtime before testing them.
- The spreadsheet implementation is committed. `backend/data/database.db` is currently modified; inspect `git status` and do not reset or replace the database.

## Git and personal data

- `backend/data/database.db` is tracked by Git. Ignore rules do not untrack a file already tracked. An earlier request to remove it from the index was rejected, so leave it tracked unless the user asks again.
- `backend/.gitignore` ignores database WAL/SHM files and `data/documents/` so newly uploaded documents are not added to Git.
- Keep local database contents, uploaded documents, `.env` values, and other personal data out of commits.
