"""Filesystem operations for uploaded PDF documents."""

import os
from pathlib import Path
from typing import Awaitable, Callable

from src.database import DOCUMENTS_DIR


class EmptyDocumentError(ValueError):
    """Raised when an uploaded PDF contains no bytes."""


def document_path(document_id: str) -> Path:
    return DOCUMENTS_DIR / f"{document_id}.pdf"


async def save_pdf_upload(
    document_id: str,
    read_chunk: Callable[[int], Awaitable[bytes]],
) -> tuple[Path, int]:
    """Stream an upload to an atomic temporary file and return its size."""
    DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
    destination = document_path(document_id)
    temporary = destination.with_suffix(".uploading")
    size = 0
    try:
        with temporary.open("wb") as output:
            while chunk := await read_chunk(1024 * 1024):
                size += len(chunk)
                output.write(chunk)
        if size == 0:
            raise EmptyDocumentError
        os.replace(temporary, destination)
        return destination, size
    except Exception:
        temporary.unlink(missing_ok=True)
        destination.unlink(missing_ok=True)
        raise


def delete_pdf_file(path: str | Path | None) -> None:
    if path:
        Path(path).unlink(missing_ok=True)
