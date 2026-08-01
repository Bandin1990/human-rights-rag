from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class DocumentMetadata:
    document_id: str
    title: str
    document_type: str
    year: int
    rights_category: str
    file_name: str
    uploaded_at: str = field(default_factory=utc_now_iso)
    file_sha256: str = ""
    ocr_required: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "DocumentMetadata":
        return cls(
            document_id=str(data["document_id"]),
            title=str(data["title"]),
            document_type=str(data["document_type"]),
            year=int(data["year"]),
            rights_category=str(data["rights_category"]),
            file_name=str(data["file_name"]),
            uploaded_at=str(data.get("uploaded_at") or utc_now_iso()),
            file_sha256=str(data.get("file_sha256", "")),
            ocr_required=bool(data.get("ocr_required", False)),
        )


@dataclass(frozen=True)
class PageText:
    document_id: str
    page_number: int
    text: str


@dataclass(frozen=True)
class TextChunk:
    chunk_id: str
    document_id: str
    text: str
    metadata: dict[str, Any]


@dataclass(frozen=True)
class SearchResult:
    chunk_id: str
    text: str
    score: float
    metadata: dict[str, Any]


@dataclass(frozen=True)
class Citation:
    title: str
    file_name: str
    page_number: int
    text: str
    document_id: str


@dataclass(frozen=True)
class RagAnswer:
    answer: str
    citations: list[Citation]
    contexts: list[SearchResult]
    ollama_available: bool
