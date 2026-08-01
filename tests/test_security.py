import pytest

from src.security import (
    SecurityError,
    safe_document_path,
    sanitize_filename,
    validate_markdown_upload,
    validate_pdf_upload,
)


def test_validate_pdf_rejects_non_pdf_extension():
    with pytest.raises(SecurityError):
        validate_pdf_upload("report.txt", b"%PDF- fake", max_file_size_mb=1)


def test_validate_pdf_rejects_wrong_magic_bytes():
    with pytest.raises(SecurityError):
        validate_pdf_upload("report.pdf", b"not a pdf", max_file_size_mb=1)


def test_safe_document_path_stays_inside_base(tmp_path):
    path = safe_document_path(tmp_path, "../รายงาน.pdf")

    assert path.parent == tmp_path.resolve()
    assert path.name == "รายงาน.pdf"


def test_sanitize_filename_removes_unsafe_chars():
    assert sanitize_filename("a/b\\c?.pdf") == "c_.pdf"


def test_validate_markdown_accepts_utf8_markdown():
    safe_name = validate_markdown_upload("notes.md", "# หัวข้อ\n\nเนื้อหา".encode("utf-8"), max_file_size_mb=1)

    assert safe_name == "notes.md"


def test_validate_markdown_rejects_non_markdown_extension():
    with pytest.raises(SecurityError):
        validate_markdown_upload("notes.txt", b"# heading", max_file_size_mb=1)


def test_validate_markdown_rejects_non_utf8_content():
    with pytest.raises(SecurityError):
        validate_markdown_upload("notes.md", b"\xff\xfe\x00", max_file_size_mb=1)
