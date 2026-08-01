from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .models import DocumentMetadata, SearchResult, TextChunk


class VectorStoreError(RuntimeError):
    pass


class DocumentRegistry:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def load(self) -> dict[str, dict[str, Any]]:
        if not self.path.exists():
            return {}
        with self.path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        return dict(data.get("documents", {}))

    def save(self, documents: dict[str, dict[str, Any]]) -> None:
        tmp = self.path.with_suffix(".tmp")
        with tmp.open("w", encoding="utf-8") as f:
            json.dump({"documents": documents}, f, ensure_ascii=False, indent=2)
        tmp.replace(self.path)

    def add(self, metadata: DocumentMetadata) -> None:
        documents = self.load()
        documents[metadata.document_id] = metadata.to_dict()
        self.save(documents)

    def remove(self, document_id: str) -> None:
        documents = self.load()
        documents.pop(document_id, None)
        self.save(documents)

    def find_by_sha256(self, file_sha256: str) -> DocumentMetadata | None:
        for data in self.load().values():
            if data.get("file_sha256") == file_sha256:
                return DocumentMetadata.from_dict(data)
        return None

    def list_documents(self) -> list[DocumentMetadata]:
        return [DocumentMetadata.from_dict(d) for d in self.load().values()]


class ChromaVectorStore:
    def __init__(self, persist_dir: Path, collection_name: str) -> None:
        self.persist_dir = persist_dir
        self.collection_name = collection_name
        self.persist_dir.mkdir(parents=True, exist_ok=True)
        self._client = None
        self._collection = None

    @property
    def client(self):
        if self._client is None:
            try:
                import chromadb
            except ImportError as exc:
                raise VectorStoreError("ยังไม่ได้ติดตั้ง ChromaDB") from exc
            self._client = chromadb.PersistentClient(path=str(self.persist_dir))
        return self._client

    @property
    def collection(self):
        if self._collection is None:
            self._collection = self.client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"},
            )
        return self._collection

    def add_chunks(self, chunks: list[TextChunk], embeddings: list[list[float]]) -> None:
        if not chunks:
            return
        if len(chunks) != len(embeddings):
            raise ValueError("จำนวน chunks และ embeddings ไม่เท่ากัน")
        self.collection.add(
            ids=[chunk.chunk_id for chunk in chunks],
            documents=[chunk.text for chunk in chunks],
            metadatas=[_normalize_metadata(chunk.metadata) for chunk in chunks],
            embeddings=embeddings,
        )

    def search(
        self,
        query_embedding: list[float],
        top_k: int = 5,
        filters: dict[str, Any] | None = None,
    ) -> list[SearchResult]:
        filters = filters or {}
        rights_filter = _as_list(filters.get("rights_category"))
        where = build_chroma_where(filters)
        n_results = max(top_k * 5, top_k, 1) if rights_filter else max(top_k, 1)
        result = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where,
            include=["documents", "metadatas", "distances"],
        )
        ids = result.get("ids", [[]])[0]
        docs = result.get("documents", [[]])[0]
        metadatas = result.get("metadatas", [[]])[0]
        distances = result.get("distances", [[]])[0]
        search_results: list[SearchResult] = []
        for chunk_id, text, metadata, distance in zip(ids, docs, metadatas, distances):
            score = max(0.0, 1.0 - float(distance))
            search_results.append(
                SearchResult(
                    chunk_id=chunk_id,
                    text=text,
                    score=score,
                    metadata=dict(metadata or {}),
                )
            )
        if rights_filter:
            search_results = [
                item
                for item in search_results
                if _metadata_has_any_category(item.metadata, rights_filter)
            ]
        return search_results[:top_k]

    def delete_document(self, document_id: str) -> None:
        self.collection.delete(where={"document_id": document_id})

    def reset(self) -> None:
        try:
            self.client.delete_collection(self.collection_name)
        except Exception:
            pass
        self._collection = None

    def count(self) -> int:
        return int(self.collection.count())


def build_chroma_where(filters: dict[str, Any]) -> dict[str, Any] | None:
    clauses: list[dict[str, Any]] = []
    for key in ("year", "document_type", "document_id"):
        value = filters.get(key)
        if value not in (None, "", "ทั้งหมด"):
            clauses.append({key: int(value) if key == "year" else value})
    if not clauses:
        return None
    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}


def _as_list(value: Any) -> list[str]:
    if value in (None, "", "ทั้งหมด"):
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip() and item != "ทั้งหมด"]
    return [str(value).strip()]


def _split_categories(value: Any) -> set[str]:
    if value is None:
        return set()
    return {
        part.strip()
        for part in str(value).replace("|", ",").replace(";", ",").split(",")
        if part.strip()
    }


def _metadata_has_any_category(metadata: dict[str, Any], categories: list[str]) -> bool:
    available = _split_categories(metadata.get("rights_category"))
    return any(category in available for category in categories)


def _normalize_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for key, value in metadata.items():
        if value is None:
            normalized[key] = ""
        elif isinstance(value, (str, int, float, bool)):
            normalized[key] = value
        else:
            normalized[key] = str(value)
    return normalized
