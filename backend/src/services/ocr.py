# OCR for scanned PDF pages using PyMuPDF to render pages and Tesseract to read them.

import io
import logging
from functools import lru_cache
from pathlib import Path

from src.config import OCR_LANGUAGES, TESSERACT_CMD

OCR_DPI = 300
# Word confidence below this (0-100) marks a page as unreliable.
OCR_CONFIDENCE_THRESHOLD = 60.0


@lru_cache(maxsize=1)
def ocr_available() -> bool:
    # True only when both Python packages import and the Tesseract binary runs.
    try:
        import fitz  # noqa: F401
        import pytesseract
    except ImportError:
        return False
    if TESSERACT_CMD:
        pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
    try:
        pytesseract.get_tesseract_version()
    except Exception:
        logging.warning("Tesseract is not available; scanned PDF pages cannot be OCR'd.")
        return False
    return True


def ocr_pages(path: str | Path, page_indexes: list[int]) -> dict[int, tuple[str, float | None]]:
    # Return {page_index: (text, mean_word_confidence)} for the requested zero-based pages.
    # A page that fails to OCR is omitted so the caller can treat it as unreadable.
    import fitz
    import pytesseract
    from PIL import Image

    results: dict[int, tuple[str, float | None]] = {}
    with fitz.open(str(path)) as document:
        for index in page_indexes:
            try:
                pixmap = document[index].get_pixmap(dpi=OCR_DPI)
                image = Image.open(io.BytesIO(pixmap.tobytes("png")))
                data = pytesseract.image_to_data(image, lang=OCR_LANGUAGES, output_type=pytesseract.Output.DICT)
            except Exception:
                logging.exception("OCR failed for page %d of %s", index + 1, path)
                continue
            results[index] = _text_and_confidence(data)
    return results


def _text_and_confidence(data: dict) -> tuple[str, float | None]:
    # Rebuild lines from Tesseract word data and average the confidence of recognised words.
    lines: dict[tuple[int, int, int], list[str]] = {}
    confidences: list[float] = []
    for i, word in enumerate(data["text"]):
        word = (word or "").strip()
        conf = float(data["conf"][i])
        if not word or conf < 0:
            continue
        key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
        lines.setdefault(key, []).append(word)
        confidences.append(conf)
    text = "\n".join(" ".join(words) for words in lines.values())
    confidence = sum(confidences) / len(confidences) if confidences else None
    return text, confidence
