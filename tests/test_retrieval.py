from src.models import SearchResult
from src.retrieval import DocumentRetriever
from src.vector_store import build_chroma_where


class FakeEmbedder:
    def embed_query(self, text):
        return [float(len(text))]


class FakeStore:
    def __init__(self):
        self.last_filters = None

    def search(self, query_embedding, top_k=5, filters=None):
        self.last_filters = filters
        return [
            SearchResult(
                chunk_id="c1",
                text="พบข้อมูลเรื่องสิทธิชุมชน",
                score=0.75,
                metadata={"year": 2024, "document_type": "รายงาน"},
            )
        ][:top_k]


def test_retriever_embeds_query_and_passes_filters():
    store = FakeStore()
    retriever = DocumentRetriever(store, FakeEmbedder())

    results = retriever.search("สิทธิชุมชน", top_k=1, filters={"year": 2024})

    assert results[0].score == 0.75
    assert store.last_filters == {"year": 2024}


def test_chroma_where_combines_filters():
    where = build_chroma_where(
        {"year": "2024", "document_type": "รายงาน", "rights_category": "สิทธิชุมชน"}
    )

    assert where == {
        "$and": [
            {"year": 2024},
            {"document_type": "รายงาน"},
        ]
    }
