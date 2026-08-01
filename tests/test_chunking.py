from src.chunking import split_pages_into_chunks
from src.models import DocumentMetadata, PageText


def test_chunking_keeps_metadata_and_page_number():
    metadata = DocumentMetadata(
        document_id="doc1",
        title="รายงานจำลอง",
        document_type="รายงาน",
        year=2024,
        rights_category="สิทธิชุมชน",
        file_name="sample.pdf",
    )
    pages = [
        PageText(
            document_id="doc1",
            page_number=2,
            text="หัวข้อการตรวจสอบ\n\nประชาชนร้องเรียนเรื่องการเข้าถึงบริการสาธารณะ\n\nข้อเสนอแนะให้หน่วยงานชี้แจง",
        )
    ]

    chunks = split_pages_into_chunks(pages, metadata, chunk_size=60, chunk_overlap=10)

    assert chunks
    assert all(chunk.metadata["document_id"] == "doc1" for chunk in chunks)
    assert all(chunk.metadata["page_number"] == 2 for chunk in chunks)
    assert all(len(chunk.text) <= 80 for chunk in chunks)


def test_chunking_rejects_invalid_overlap():
    metadata = DocumentMetadata("doc1", "t", "type", 2024, "cat", "a.pdf")
    pages = [PageText("doc1", 1, "ข้อความทดสอบ")]

    try:
        split_pages_into_chunks(pages, metadata, chunk_size=100, chunk_overlap=100)
    except ValueError as exc:
        assert "chunk_overlap" in str(exc)
    else:
        raise AssertionError("expected ValueError")
