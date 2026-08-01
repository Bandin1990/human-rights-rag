from __future__ import annotations

import hashlib
import re
from pathlib import Path


PDF_MAGIC = b"%PDF-"
ALLOWED_MARKDOWN_EXTENSIONS = {".md", ".markdown"}
SAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9ก-๙._ -]+")


class SecurityError(ValueError):
    pass


def sanitize_filename(file_name: str) -> str:
    name = Path(file_name).name.strip().replace("\x00", "")
    name = SAFE_FILENAME_RE.sub("_", name)
    name = re.sub(r"\s+", " ", name).strip(" .")
    if not name:
        raise SecurityError("ชื่อไฟล์ไม่ถูกต้อง")
    return name


def validate_pdf_upload(file_name: str, content: bytes, max_file_size_mb: int) -> str:
    safe_name = sanitize_filename(file_name)
    if not safe_name.lower().endswith(".pdf"):
        raise SecurityError("รองรับเฉพาะไฟล์ PDF")
    if len(content) > max_file_size_mb * 1024 * 1024:
        raise SecurityError(f"ไฟล์มีขนาดเกิน {max_file_size_mb} MB")
    if not content.startswith(PDF_MAGIC):
        raise SecurityError("ชนิดไฟล์ไม่ใช่ PDF ที่ถูกต้อง")
    return safe_name


def validate_markdown_upload(file_name: str, content: bytes, max_file_size_mb: int) -> str:
    safe_name = sanitize_filename(file_name)
    suffix = Path(safe_name).suffix.lower()
    if suffix not in ALLOWED_MARKDOWN_EXTENSIONS:
        raise SecurityError("รองรับเฉพาะไฟล์ Markdown (.md, .markdown)")
    if len(content) > max_file_size_mb * 1024 * 1024:
        raise SecurityError(f"ไฟล์มีขนาดเกิน {max_file_size_mb} MB")
    try:
        content.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise SecurityError("ไฟล์ Markdown ต้องเป็น UTF-8") from exc
    return safe_name


def safe_document_path(base_dir: Path, file_name: str) -> Path:
    safe_name = sanitize_filename(file_name)
    base = base_dir.resolve()
    target = (base / safe_name).resolve()
    if base not in target.parents and target != base:
        raise SecurityError("เส้นทางไฟล์ไม่ปลอดภัย")
    return target


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()
