import pytest

from src.config import AppConfig
from src.ingestion import ingest_document_bytes, ingest_pdf_bytes
from src.vector_store import DocumentRegistry


fitz = pytest.importorskip("fitz")


class FakeEmbedder:
    def embed_documents(self, texts):
        return [[1.0, float(len(text))] for text in texts]


class FakeStore:
    def __init__(self):
        self.chunks = []
        self.embeddings = []

    def add_chunks(self, chunks, embeddings):
        self.chunks.extend(chunks)
        self.embeddings.extend(embeddings)


def make_pdf_bytes(text: str) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), text)
    return doc.tobytes()


def test_ingestion_reads_pdf_and_indexes_chunks(tmp_path):
    config = AppConfig(
        documents_dir=tmp_path / "documents",
        chroma_dir=tmp_path / "chroma",
        metadata_path=tmp_path / "document_index.json",
    )
    config.ensure_dirs()
    registry = DocumentRegistry(config.metadata_path)
    store = FakeStore()

    result = ingest_pdf_bytes(
        content=make_pdf_bytes("Mock report\n\nRecommendation: improve public complaint channels."),
        original_file_name="../unsafe name.pdf",
        title="รายงานจำลอง",
        document_type="รายงานตรวจสอบ",
        year=2024,
        rights_category="สิทธิในการร้องเรียน",
        config=config,
        registry=registry,
        store=store,
        embedder=FakeEmbedder(),
        chunk_size=500,
        chunk_overlap=50,
    )

    assert result.chunk_count == 1
    assert not result.needs_ocr
    assert store.chunks[0].metadata["page_number"] == 1
    assert registry.find_by_sha256(result.metadata.file_sha256) is not None


def test_ingestion_detects_duplicate_pdf(tmp_path):
    config = AppConfig(
        documents_dir=tmp_path / "documents",
        chroma_dir=tmp_path / "chroma",
        metadata_path=tmp_path / "document_index.json",
    )
    config.ensure_dirs()
    registry = DocumentRegistry(config.metadata_path)
    store = FakeStore()
    content = make_pdf_bytes("Mock document with enough text layer content for duplicate detection.")

    first = ingest_pdf_bytes(
        content=content,
        original_file_name="sample.pdf",
        title="รายงานจำลอง",
        document_type="รายงาน",
        year=2024,
        rights_category="สิทธิชุมชน",
        config=config,
        registry=registry,
        store=store,
        embedder=FakeEmbedder(),
        chunk_size=500,
        chunk_overlap=50,
    )
    second = ingest_pdf_bytes(
        content=content,
        original_file_name="sample.pdf",
        title="รายงานจำลอง",
        document_type="รายงาน",
        year=2024,
        rights_category="สิทธิชุมชน",
        config=config,
        registry=registry,
        store=store,
        embedder=FakeEmbedder(),
        chunk_size=500,
        chunk_overlap=50,
    )

    assert first.metadata.document_id == second.metadata.document_id
    assert second.duplicate


def test_ingestion_reads_markdown_and_indexes_chunks(tmp_path):
    config = AppConfig(
        documents_dir=tmp_path / "documents",
        chroma_dir=tmp_path / "chroma",
        metadata_path=tmp_path / "document_index.json",
    )
    config.ensure_dirs()
    registry = DocumentRegistry(config.metadata_path)
    store = FakeStore()

    result = ingest_document_bytes(
        content="# รายงานจำลอง\n\nข้อเสนอแนะ: ควรปรับปรุงช่องทางรับเรื่องร้องเรียน".encode("utf-8"),
        original_file_name="../sample.md",
        title="บันทึกจำลอง",
        document_type="บันทึก",
        year=2024,
        rights_category="สิทธิชุมชน, สิทธิแรงงาน",
        config=config,
        registry=registry,
        store=store,
        embedder=FakeEmbedder(),
        chunk_size=500,
        chunk_overlap=50,
    )

    assert result.chunk_count == 1
    assert not result.needs_ocr
    assert result.metadata.file_name.endswith("_sample.md")
    assert store.chunks[0].metadata["page_number"] == 1
    assert "ข้อเสนอแนะ" in store.chunks[0].text
