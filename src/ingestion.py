from __future__ import annotations

from dataclasses import replace
from dataclasses import dataclass
from pathlib import Path

from .chunking import split_pages_into_chunks
from .config import AppConfig
from .embeddings import SentenceTransformerEmbedder
from .markdown_loader import load_markdown
from .models import DocumentMetadata
from .pdf_loader import load_pdf_pages
from .ocr import run_ocrmypdf
from .security import (
    safe_document_path,
    sha256_bytes,
    validate_markdown_upload,
    validate_pdf_upload,
)
from .vector_store import ChromaVectorStore, DocumentRegistry


@dataclass(frozen=True)
class IngestionResult:
    metadata: DocumentMetadata
    chunk_count: int
    needs_ocr: bool
    duplicate: bool = False


def ingest_document_bytes(
    *,
    content: bytes,
    original_file_name: str,
    title: str,
    document_type: str,
    year: int,
    rights_category: str,
    config: AppConfig,
    registry: DocumentRegistry,
    store: ChromaVectorStore,
    embedder: SentenceTransformerEmbedder,
    chunk_size: int,
    chunk_overlap: int,
) -> IngestionResult:
    suffix = Path(original_file_name).suffix.lower()
    if suffix in {".md", ".markdown"}:
        return ingest_markdown_bytes(
            content=content,
            original_file_name=original_file_name,
            title=title,
            document_type=document_type,
            year=year,
            rights_category=rights_category,
            config=config,
            registry=registry,
            store=store,
            embedder=embedder,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )
    return ingest_pdf_bytes(
        content=content,
        original_file_name=original_file_name,
        title=title,
        document_type=document_type,
        year=year,
        rights_category=rights_category,
        config=config,
        registry=registry,
        store=store,
        embedder=embedder,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )


def ingest_pdf_bytes(
    *,
    content: bytes,
    original_file_name: str,
    title: str,
    document_type: str,
    year: int,
    rights_category: str,
    config: AppConfig,
    registry: DocumentRegistry,
    store: ChromaVectorStore,
    embedder: SentenceTransformerEmbedder,
    chunk_size: int,
    chunk_overlap: int,
) -> IngestionResult:
    safe_name = validate_pdf_upload(original_file_name, content, config.max_file_size_mb)
    file_hash = sha256_bytes(content)
    existing = registry.find_by_sha256(file_hash)
    if existing:
        return IngestionResult(existing, chunk_count=0, needs_ocr=False, duplicate=True)

    document_id = file_hash[:16]
    stored_file_name = f"{document_id}_{safe_name}"
    target_path = safe_document_path(config.documents_dir, stored_file_name)
    target_path.write_bytes(content)

    metadata = DocumentMetadata(
        document_id=document_id,
        title=title.strip() or safe_name,
        document_type=document_type.strip() or "ไม่ระบุ",
        year=int(year),
        rights_category=rights_category.strip() or "ไม่ระบุ",
        file_name=stored_file_name,
        file_sha256=file_hash,
    )
    pages, needs_ocr = load_pdf_pages(target_path, document_id=document_id)
    if needs_ocr:
        registry.add(replace(metadata, ocr_required=True))
        return IngestionResult(metadata, chunk_count=0, needs_ocr=True)

    chunks = split_pages_into_chunks(
        pages,
        metadata,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    embeddings = embedder.embed_documents([chunk.text for chunk in chunks])
    store.add_chunks(chunks, embeddings)
    registry.add(metadata)
    return IngestionResult(metadata, chunk_count=len(chunks), needs_ocr=False)


def ingest_markdown_bytes(
    *,
    content: bytes,
    original_file_name: str,
    title: str,
    document_type: str,
    year: int,
    rights_category: str,
    config: AppConfig,
    registry: DocumentRegistry,
    store: ChromaVectorStore,
    embedder: SentenceTransformerEmbedder,
    chunk_size: int,
    chunk_overlap: int,
) -> IngestionResult:
    safe_name = validate_markdown_upload(original_file_name, content, config.max_file_size_mb)
    file_hash = sha256_bytes(content)
    existing = registry.find_by_sha256(file_hash)
    if existing:
        return IngestionResult(existing, chunk_count=0, needs_ocr=False, duplicate=True)

    document_id = file_hash[:16]
    stored_file_name = f"{document_id}_{safe_name}"
    target_path = safe_document_path(config.documents_dir, stored_file_name)
    target_path.write_bytes(content)

    metadata = DocumentMetadata(
        document_id=document_id,
        title=title.strip() or safe_name,
        document_type=document_type.strip() or "ไม่ระบุ",
        year=int(year),
        rights_category=rights_category.strip() or "ไม่ระบุ",
        file_name=stored_file_name,
        file_sha256=file_hash,
    )
    pages, needs_ocr = load_markdown(target_path, document_id=document_id)
    chunks = split_pages_into_chunks(
        pages,
        metadata,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    embeddings = embedder.embed_documents([chunk.text for chunk in chunks])
    store.add_chunks(chunks, embeddings)
    registry.add(metadata)
    return IngestionResult(metadata, chunk_count=len(chunks), needs_ocr=needs_ocr)


def ocr_and_index_document(
    document_id: str,
    *,
    config: AppConfig,
    registry: DocumentRegistry,
    store: ChromaVectorStore,
    embedder: SentenceTransformerEmbedder,
    chunk_size: int,
    chunk_overlap: int,
    languages: str = "tha+eng",
) -> IngestionResult:
    documents = registry.load()
    data = documents.get(document_id)
    if not data:
        raise RuntimeError("ไม่พบเอกสารนี้ใน registry")

    metadata = DocumentMetadata.from_dict(data)
    source_path = safe_document_path(config.documents_dir, metadata.file_name)
    if not source_path.exists():
        raise RuntimeError("ไม่พบไฟล์ PDF ต้นฉบับ")

    ocr_file_name = f"{source_path.stem}_ocr.pdf"
    ocr_path = safe_document_path(config.documents_dir, ocr_file_name)
    run_ocrmypdf(source_path, ocr_path, languages=languages)

    pages, still_needs_ocr = load_pdf_pages(ocr_path, document_id=document_id)
    updated_metadata = replace(
        metadata,
        file_name=ocr_file_name,
        ocr_required=still_needs_ocr,
    )
    registry.add(updated_metadata)
    if still_needs_ocr:
        return IngestionResult(updated_metadata, chunk_count=0, needs_ocr=True)

    store.delete_document(document_id)
    chunks = split_pages_into_chunks(
        pages,
        updated_metadata,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    embeddings = embedder.embed_documents([chunk.text for chunk in chunks])
    store.add_chunks(chunks, embeddings)
    return IngestionResult(updated_metadata, chunk_count=len(chunks), needs_ocr=False)


def delete_document(
    document_id: str,
    *,
    config: AppConfig,
    registry: DocumentRegistry,
    store: ChromaVectorStore,
) -> None:
    documents = registry.load()
    data = documents.get(document_id)
    store.delete_document(document_id)
    if data:
        path = safe_document_path(config.documents_dir, str(data.get("file_name", "")))
        if path.exists():
            path.unlink()
    registry.remove(document_id)


def rebuild_index(
    *,
    config: AppConfig,
    registry: DocumentRegistry,
    store: ChromaVectorStore,
    embedder: SentenceTransformerEmbedder,
    chunk_size: int,
    chunk_overlap: int,
) -> int:
    documents = registry.list_documents()
    store.reset()
    total_chunks = 0
    for metadata in documents:
        path = safe_document_path(config.documents_dir, metadata.file_name)
        if not Path(path).exists():
            continue
        suffix = path.suffix.lower()
        if suffix in {".md", ".markdown"}:
            pages, needs_ocr = load_markdown(path, document_id=metadata.document_id)
        else:
            pages, needs_ocr = load_pdf_pages(path, document_id=metadata.document_id)
        if needs_ocr:
            continue
        chunks = split_pages_into_chunks(
            pages,
            metadata,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )
        embeddings = embedder.embed_documents([chunk.text for chunk in chunks])
        store.add_chunks(chunks, embeddings)
        total_chunks += len(chunks)
    return total_chunks
