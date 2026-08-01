from __future__ import annotations

from dataclasses import dataclass


@dataclass
class SentenceTransformerEmbedder:
    model_name: str

    def __post_init__(self) -> None:
        self._model = None

    @property
    def model(self):
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
            except ImportError as exc:
                raise RuntimeError("ยังไม่ได้ติดตั้ง sentence-transformers") from exc
            self._model = SentenceTransformer(self.model_name)
        return self._model

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        embeddings = self.model.encode(texts, normalize_embeddings=True)
        return embeddings.tolist()

    def embed_query(self, text: str) -> list[float]:
        return self.embed_documents([text])[0]
