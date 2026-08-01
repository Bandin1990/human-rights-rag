from __future__ import annotations

from pathlib import Path

from .models import PageText


class PdfReadError(RuntimeError):
    pass


def load_pdf_pages(path: Path, document_id: str, min_text_chars: int = 30) -> tuple[list[PageText], bool]:
    try:
        import fitz
    except ImportError as exc:
        raise PdfReadError("ยังไม่ได้ติดตั้ง PyMuPDF") from exc

    pages: list[PageText] = []
    try:
        with fitz.open(path) as pdf:
            for index, page in enumerate(pdf, start=1):
                text = normalize_pdf_text(page.get_text("text"))
                pages.append(PageText(document_id=document_id, page_number=index, text=text))
    except Exception as exc:  # PyMuPDF raises several exception types.
        raise PdfReadError(f"อ่าน PDF ไม่สำเร็จ: {exc}") from exc

    readable_chars = sum(len(page.text.strip()) for page in pages)
    needs_ocr = readable_chars < min_text_chars
    return pages, needs_ocr


def normalize_pdf_text(text: str) -> str:
    lines = [line.rstrip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    return "\n".join(lines).strip()
