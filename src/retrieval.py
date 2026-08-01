from __future__ import annotations

from typing import Any

from .embeddings import SentenceTransformerEmbedder
from .models import SearchResult
from .vector_store import ChromaVectorStore


class DocumentRetriever:
    def __init__(self, store: ChromaVectorStore, embedder: SentenceTransformerEmbedder) -> None:
        self.store = store
        self.embedder = embedder

    def search(
        self,
        query: str,
        top_k: int = 5,
        filters: dict[str, Any] | None = None,
    ) -> list[SearchResult]:
        query = query.strip()
        if not query:
            return []
        query_embedding = self.embedder.embed_query(query)
        return self.store.search(query_embedding=query_embedding, top_k=top_k, filters=filters)
