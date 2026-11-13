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
- Upload processing reports `uploading`, `extracting`, `indexing`, then `indexed`; extraction and indexing failures are saved with a user-facing error. Interrupted jobs resume at backend startup.
- `document_pages` contains extracted text by page. `document_chunks` stores overlapping page-aware chunks and their OpenAI embeddings in SQLite. Retrieval ranks chunks by cosine similarity and sends only the top matches from documents selected in the current chat.
- The embedding model defaults to `text-embedding-3-small` and can be overridden with `OPENAI_EMBEDDING_MODEL` in `backend/.env`. Changing the model triggers reindexing at startup. Embedding requests send extracted document text and chat questions to OpenAI.
- Retrieved chunks retain document ID, document name, and page number for citation integration. The answer prompt asks the model to cite sources as `[document name | page N]`; structured citations are still a later task.
- PDF pages with fewer than 20 selectable characters are treated as scanned and OCR'd with Tesseract (PyMuPDF renders at 300 DPI, pytesseract reads). OCR runs in a separate `ocr` processing stage. Pages keep their numbers. Each page stores `ocr`, `ocr_confidence`, and `low_quality` (set when mean word confidence is below 60, when OCR text is empty, or when a scanned page could not be OCR'd). The library shows a warning listing low-quality pages; the warning appears after a reload for freshly uploaded documents.
- OCR needs the Tesseract binary on the machine (on PATH, or set `TESSERACT_CMD` in `backend/.env`). Set `OCR_LANGUAGES` (default `eng`, e.g. `eng+fra`) for other languages. Without Tesseract, a PDF with only scanned pages fails with an install message; mixed PDFs still import with the scanned pages flagged.
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
- `backend/src/services/document_extractors.py`: PDF page extraction (pypdf, with OCR for scanned pages) and DOCX section extraction.
- `backend/src/services/ocr.py`: Tesseract availability check, page rendering and OCR, confidence scoring (`OCR_CONFIDENCE_THRESHOLD`).
- `backend/src/services/document_processing.py`: extraction stages, page persistence, and handoff to indexing.
- `backend/src/services/document_indexing.py`: page chunking, embedding batches, SQLite index persistence, and per-document index status.
- `backend/src/services/document_retrieval.py`: question embeddings, selected-document cosine ranking, and source-aware context formatting.
- `backend/src/services/openai_clients.py`: shared synchronous and asynchronous OpenAI clients.
- `backend/src/services/conversation_service.py`: shared conversation-history and assistant-message persistence used by both draft and chat routes.
- `backend/src/api/chat.py`: chat request validation and model orchestration.
- `backend/src/api/conversations.py`: conversation, title, archive, pins, feedback, and history endpoints.
- `backend/src/database.py`: SQLite path, schema, and startup migrations.
- `backend/src/services/openai_service.py`: retrieval integration, answer instructions, and model request.

## Next planned task

Task 3 RAG retrieval is implemented across the document indexing, retrieval, and OpenAI services. Roadmap item 6 (OCR support for scanned PDF pages) is implemented but uncommitted: it covers the OCR service, the extraction and processing changes, the new `document_pages` columns, the `ocr` stage and low-quality warnings in the UI, and a 30-minute processing poll limit. The next follow-up can add structured citation persistence and clickable citation metadata to assistant messages. Existing disk-backed PDF storage and conversation persistence remain in place.

## Verification and environment notes

- After the modularity refactor, `npm.cmd run lint` and `npm.cmd run build` passed from `frontend/`.
- `python -m compileall -q src` passed from `backend/`.
- After RAG implementation, frontend lint/build and backend Python compilation passed. Backend API behavior has not been run end to end in the current Python environment because FastAPI is not installed there.
- Install backend dependencies from `backend/requirements.txt` or use the project runtime before confirming upload, extraction, startup migration, indexing, and restart recovery end to end. The OCR packages (`pymupdf`, `pytesseract`, `pillow`) are now in requirements and were installed in the local Python 3.14 environment.
- OCR verification so far: `python -m compileall -q src` and frontend `npm.cmd run lint` and `npm.cmd run build` pass. A generated blank-page PDF produces the "needs Tesseract" error when Tesseract is missing, and OCR text assembly and confidence averaging were checked on sample data. The Tesseract binary is not installed on this machine, so real OCR, the `ocr` stage, and the warning UI are not yet tested end to end. Install Tesseract (for example the UB Mannheim Windows build) and test with a scanned PDF and a mixed text/scan PDF.
- The RAG implementation is currently uncommitted. A modified `backend/data/database.db` was present before this RAG work and has been preserved; inspect `git status` and do not reset or replace the database.

## Git and personal data

- `backend/data/database.db` is tracked by Git. Ignore rules do not untrack a file already tracked. An earlier request to remove it from the index was rejected, so leave it tracked unless the user asks again.
- `backend/.gitignore` ignores database WAL/SHM files and `data/documents/` so newly uploaded PDFs are not added to Git.
- Keep local database contents, uploaded documents, `.env` values, and other personal data out of commits.
