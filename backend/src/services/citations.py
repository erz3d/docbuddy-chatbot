# Turn "[document name | page N]" references in an answer into verified citations.

import re

from src.services.document_retrieval import RetrievedChunk

EXCERPT_LENGTH = 300
MAX_RANGE = 10

# Matches "[name | page 3]", "[name | pages 3, 5]" and "[name | pages 3-5]".
_REFERENCE = re.compile(r"\[([^\[\]|]+?)\s*\|\s*([^\[\]]+?)\]")
_RANGE = re.compile(r"(\d+)\s*[-–]\s*(\d+)")
_NUMBER = re.compile(r"\d+")
_SHEET = re.compile(r'^sheet\s+[\"\'](.+?)[\"\']$', re.IGNORECASE)


def _pages(text: str) -> list[int]:
    # Expand page lists and short ranges, keeping order and dropping duplicates.
    pages: list[int] = []
    for start, end in _RANGE.findall(text):
        if 0 < int(start) <= int(end) and int(end) - int(start) < MAX_RANGE:
            pages.extend(range(int(start), int(end) + 1))
    pages.extend(int(number) for number in _NUMBER.findall(_RANGE.sub(" ", text)))
    return list(dict.fromkeys(page for page in pages if page > 0))


def _excerpt(text: str) -> str:
    collapsed = " ".join(text.split())
    return collapsed if len(collapsed) <= EXCERPT_LENGTH else collapsed[:EXCERPT_LENGTH].rstrip() + "…"


def extract_citations(answer: str, chunks: list[RetrievedChunk]) -> list[dict]:
    # Keep only references that match an excerpt actually sent to the model, so
    # a hallucinated document name or page never becomes a clickable citation.
    best_chunk: dict[tuple[str, int], RetrievedChunk] = {}
    for chunk in chunks:  # chunks arrive best-scoring first
        best_chunk.setdefault((chunk.document_name.casefold(), chunk.page_number), chunk)

    citations: list[dict] = []
    seen: set[tuple[str, int]] = set()
    for match in _REFERENCE.finditer(answer):
        name = match.group(1).strip().casefold()
        reference = match.group(2).strip()
        sheet_match = _SHEET.match(reference)
        if sheet_match:
            sheet_name = sheet_match.group(1).strip().casefold()
            matches = [chunk for chunk in chunks if chunk.document_name.casefold() == name and (chunk.label or "").casefold() == sheet_name]
        else:
            matches = [best_chunk[(name, page)] for page in _pages(reference) if (name, page) in best_chunk]
        for chunk in matches:
            page = chunk.page_number
            if chunk is None or (chunk.document_id, page) in seen:
                continue
            seen.add((chunk.document_id, page))
            citations.append({
                "documentId": chunk.document_id,
                "documentName": chunk.document_name,
                "page": page,
                "excerpt": _excerpt(chunk.text),
                "label": chunk.label,
            })
    return citations
