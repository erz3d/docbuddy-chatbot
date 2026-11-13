# Extract citable text units from PDF and Word files.

import re
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn
from docx.table import Table, _Cell
from docx.text.paragraph import Paragraph
from pypdf import PdfReader

from src.services.ocr import OCR_CONFIDENCE_THRESHOLD, ocr_available, ocr_pages

PDF_MIME = "application/pdf"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
MAX_SECTION_CHARS = 6000
# Pages with fewer selectable characters than this are treated as scanned and sent to OCR.
SCANNED_PAGE_MIN_CHARS = 20

_HEADING_STYLE = re.compile(r"^(?:heading|titre)\s*(\d+)$", re.IGNORECASE)


class ExtractionError(Exception):
    """Carries a user-facing message explaining why a file could not be read."""


@dataclass(frozen=True)
class ExtractedUnit:
    # One citable unit: a PDF page (no label) or a Word section (labelled).
    # OCR fields are set only for PDF pages that were read with OCR or could not be read at all.

    text: str
    label: str | None = None
    ocr: bool = False
    confidence: float | None = None
    low_quality: bool = False


def extract_units(
    path: str | Path, mime_type: str, on_ocr_start: Callable[[], None] | None = None
) -> list[ExtractedUnit]:
    # Pick the extractor matching the stored file type.
    if mime_type == DOCX_MIME:
        return extract_docx_sections(path)
    return extract_pdf_pages(path, on_ocr_start)


def extract_pdf_pages(path: str | Path, on_ocr_start: Callable[[], None] | None = None) -> list[ExtractedUnit]:
    # Return one unit per PDF page. Pages without selectable text are OCR'd when Tesseract is available.
    try:
        reader = PdfReader(str(path))
        pages = [(page.extract_text() or "") for page in reader.pages]
    except Exception as exc:
        raise ExtractionError(
            "This PDF is damaged, encrypted, or unreadable. Re-export it as a standard PDF and try again."
        ) from exc
    if not pages:
        raise ExtractionError("This PDF contains no pages.")

    scanned = [index for index, text in enumerate(pages) if len(text.strip()) < SCANNED_PAGE_MIN_CHARS]
    ocr_results: dict[int, tuple[str, float | None]] = {}
    if scanned and ocr_available():
        if on_ocr_start:
            on_ocr_start()
        ocr_results = ocr_pages(path, scanned)

    units: list[ExtractedUnit] = []
    for index, text in enumerate(pages):
        if index not in scanned:
            units.append(ExtractedUnit(text))
            continue
        if index not in ocr_results:
            # Not OCR'd: either OCR is unavailable or this page failed to OCR. Keep the page with a flag.
            units.append(ExtractedUnit(text.strip(), low_quality=True))
            continue
        ocr_text, confidence = ocr_results[index]
        low = not ocr_text.strip() or confidence is None or confidence < OCR_CONFIDENCE_THRESHOLD
        units.append(ExtractedUnit(ocr_text.strip(), ocr=True, confidence=confidence, low_quality=low))

    if not any(unit.text.strip() for unit in units):
        if scanned and not ocr_available():
            raise ExtractionError(
                "This PDF appears to be scanned, and OCR needs Tesseract, which is not installed. "
                "Install Tesseract OCR and try again."
            )
        raise ExtractionError("No readable text was found in this PDF, even after OCR.")
    return units


def extract_docx_sections(path: str | Path) -> list[ExtractedUnit]:
    # Split a Word file into sections at its headings, keeping tables in reading order.
    try:
        document = Document(str(path))
        blocks = list(_iter_blocks(document))
    except Exception as exc:
        raise ExtractionError(
            "This Word file is damaged, password-protected, or not a .docx. "
            "Save it as a standard .docx and try again."
        ) from exc

    sections: list[tuple[list[str], list[tuple[int, str]]]] = []
    heading_stack: list[tuple[int, str]] = []
    current_path: list[str] = []
    current_blocks: list[tuple[int, str]] = []
    block_number = 0

    def flush() -> None:
        # A heading with nothing under it adds no section of its own.
        if any(number > 0 for number, _ in current_blocks):
            sections.append((current_path, current_blocks.copy()))
        current_blocks.clear()

    for block in blocks:
        if isinstance(block, Table):
            text = _table_text(block)
            level = None
        else:
            text = " ".join(block.text.split())
            level = _heading_level(block)
        if not text:
            continue
        block_number += 1
        if level is not None:
            flush()
            while heading_stack and heading_stack[-1][0] >= level:
                heading_stack.pop()
            heading_stack.append((level, text))
            current_path = [title for _, title in heading_stack]
            current_blocks.append((-block_number, text))  # negative number marks a heading
        else:
            current_blocks.append((block_number, text))
    flush()

    units: list[ExtractedUnit] = []
    for path_titles, section_blocks in sections:
        units.extend(_section_units(path_titles, section_blocks))
    if not units:
        raise ExtractionError("No text was found in this Word document.")
    return units


def _iter_blocks(document):
    # Yield paragraphs and tables in the order they appear in the document body.
    for child in document.element.body.iterchildren():
        if child.tag == qn("w:p"):
            yield Paragraph(child, document)
        elif child.tag == qn("w:tbl"):
            yield Table(child, document)


def _heading_level(paragraph: Paragraph) -> int | None:
    # Built-in heading styles are stored as "heading N" whatever Word's UI language is.
    name = (paragraph.style.name if paragraph.style is not None else "") or ""
    name = name.strip()
    if name.lower() == "title":
        return 1
    match = _HEADING_STYLE.match(name)
    return int(match.group(1)) if match else None


def _table_text(table: Table) -> str:
    rows: list[list[str]] = []
    # Read the raw XML rows instead of table.rows[i].cells, which raises on
    # irregular tables (merged or missing cells) exported by some Word versions.
    for tr in table._tbl.tr_lst:
        cells = [" ".join(_Cell(tc, table).text.split()) for tc in tr.tc_lst]
        if any(cells):
            rows.append(cells)
    if not rows:
        return ""
    headers = rows[0]
    has_header = len(rows) > 1 and all(headers) and len(set(headers)) == len(headers)
    if has_header:
        lines = [
            " | ".join(f"{header}: {value}" for header, value in zip(headers, row) if value)
            for row in rows[1:]
        ]
    else:
        lines = [" | ".join(row) for row in rows]
    return "\n".join(lines)


def _section_units(path_titles: list[str], blocks: list[tuple[int, str]]) -> list[ExtractedUnit]:
    # Cut an oversized section into several units so a citation stays precise.
    groups: list[list[tuple[int, str]]] = [[]]
    size = 0
    for number, text in blocks:
        if groups[-1] and size + len(text) > MAX_SECTION_CHARS:
            groups.append([])
            size = 0
        groups[-1].append((number, text))
        size += len(text)

    units = []
    for group in groups:
        numbers = [abs(number) for number, _ in group]
        span = (
            f"paragraph {numbers[0]}" if numbers[0] == numbers[-1]
            else f"paragraphs {numbers[0]}–{numbers[-1]}"
        )
        if not path_titles:
            label = span.capitalize()
        elif len(groups) > 1:
            label = f"{' > '.join(path_titles)} ({span})"
        else:
            label = " > ".join(path_titles)
        units.append(ExtractedUnit("\n".join(text for _, text in group), label))
    return units