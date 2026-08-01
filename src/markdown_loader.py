from __future__ import annotations

from pathlib import Path

from .models import PageText


class MarkdownReadError(RuntimeError):
    pass


def load_markdown(path: Path, document_id: str) -> tuple[list[PageText], bool]:
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        raise MarkdownReadError("ไฟล์ Markdown ต้องเป็น UTF-8") from exc
    except Exception as exc:
        raise MarkdownReadError(f"อ่าน Markdown ไม่สำเร็จ: {exc}") from exc

    normalized = normalize_markdown_text(text)
    needs_ocr = False
    return [PageText(document_id=document_id, page_number=1, text=normalized)], needs_ocr


def normalize_markdown_text(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n").strip()
