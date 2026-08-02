"""
Hybrid Search for NHRC Knowledge Base

Combines structured index with semantic search (ChromaDB):
1. Structured query first (fast, filtered results)
2. Semantic search (relevant to meaning)
3. Combine and rank results

Enables:
- Faceted filtering (year, area, type)
- Full-text + semantic search
- Better relevance ranking
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import json


@dataclass
class SearchResult:
    """Single search result with metadata and scores"""
    document_id: str
    case_id: Optional[str]
    title: str
    document_type: str
    area_code: Optional[str]
    year: Optional[int]
    year_buddhist: Optional[int]
    similarity_score: float
    structured_match: bool
    snippet: str


class HybridSearch:
    """Hybrid search combining structured index + semantic search"""

    def __init__(self, structured_index, vector_store):
        """
        Initialize hybrid search

        Args:
            structured_index: StructuredIndex instance
            vector_store: ChromaDB vector store instance
        """
        self.index = structured_index
        self.vector_store = vector_store

    def search(
        self,
        query: str,
        year: Optional[int] = None,
        year_range: Optional[Tuple[int, int]] = None,
        area_code: Optional[str] = None,
        doc_type: Optional[str] = None,
        top_k: int = 10,
        weight_structured: float = 0.3,
        weight_semantic: float = 0.7
    ) -> List[SearchResult]:
        """
        Hybrid search combining structured and semantic queries

        Args:
            query: Search query (Thai text)
            year: Specific year filter
            year_range: Year range filter
            area_code: Area code filter (A-E)
            doc_type: Document type filter
            top_k: Number of results to return
            weight_structured: Weight for structured match (0-1)
            weight_semantic: Weight for semantic similarity (0-1)

        Returns:
            List of SearchResult objects sorted by combined score
        """
        results = {}

        # Step 1: Structured search first
        structured_results = self.index.search_by_filters(
            year=year,
            year_range=year_range,
            area_code=area_code,
            doc_type=doc_type,
            limit=top_k * 2  # Get more to refine later
        )

        # Step 2: Semantic search
        try:
            semantic_results = self.vector_store.search(
                query=query,
                top_k=top_k * 2
            )
        except:
            semantic_results = []

        # Step 3: Combine results
        # Create dict for deduplication and scoring
        result_dict = {}

        # Add structured results (high priority)
        for doc in structured_results:
            doc_id = doc["document_id"]
            result_dict[doc_id] = {
                "document": doc,
                "structured_score": 1.0,
                "semantic_score": 0.0,
                "structured_match": True
            }

        # Add/update semantic results
        for sem_result in semantic_results:
            doc_id = sem_result.get("document_id") or sem_result.get("id")

            # Get document metadata from index
            if doc_id not in result_dict:
                # Try to find in index
                case_id = sem_result.get("case_id")
                if case_id:
                    doc = self.index.search_case_by_id(case_id)
                    if doc:
                        result_dict[doc_id] = {
                            "document": doc,
                            "structured_score": 0.0,
                            "semantic_score": sem_result.get("distance", 0),
                            "structured_match": False
                        }
            else:
                # Update semantic score
                result_dict[doc_id]["semantic_score"] = sem_result.get("distance", 0)

        # Step 4: Calculate combined scores and create results
        final_results = []

        for doc_id, scores in result_dict.items():
            doc = scores["document"]

            # Normalize scores (0-1, higher is better)
            struct_score = scores["structured_score"]
            sem_score = min(1.0, 1.0 - scores["semantic_score"])  # Convert distance to similarity

            # Weighted combination
            combined_score = (
                weight_structured * struct_score +
                weight_semantic * sem_score
            )

            # Create snippet
            snippet = self._create_snippet(
                doc.get("title", ""),
                query,
                length=150
            )

            result = SearchResult(
                document_id=doc_id,
                case_id=doc.get("case_id"),
                title=doc.get("title", ""),
                document_type=doc.get("document_type", ""),
                area_code=doc.get("area_code"),
                year=doc.get("year"),
                year_buddhist=doc.get("year_buddhist"),
                similarity_score=combined_score,
                structured_match=scores["structured_match"],
                snippet=snippet
            )

            final_results.append(result)

        # Sort by combined score
        final_results.sort(key=lambda x: x.similarity_score, reverse=True)

        return final_results[:top_k]

    def search_by_area(
        self,
        area_code: str,
        query: Optional[str] = None,
        year_range: Optional[Tuple[int, int]] = None,
        top_k: int = 20
    ) -> List[SearchResult]:
        """
        Search within specific area

        Args:
            area_code: Area code (A-E)
            query: Optional text query for semantic search
            year_range: Year range filter
            top_k: Number of results

        Returns:
            List of SearchResult objects
        """
        results = self.index.search_by_filters(
            area_code=area_code,
            year_range=year_range,
            limit=top_k * 2
        )

        if not query:
            # Return structured results only
            final_results = []
            for doc in results:
                result = SearchResult(
                    document_id=doc["document_id"],
                    case_id=doc.get("case_id"),
                    title=doc.get("title", ""),
                    document_type=doc.get("document_type", ""),
                    area_code=doc.get("area_code"),
                    year=doc.get("year"),
                    year_buddhist=doc.get("year_buddhist"),
                    similarity_score=1.0,
                    structured_match=True,
                    snippet=""
                )
                final_results.append(result)

            return final_results[:top_k]

        # With query: combine structured + semantic
        return self.search(
            query=query,
            area_code=area_code,
            year_range=year_range,
            top_k=top_k
        )

    def search_by_case_id(self, case_id: str) -> Optional[SearchResult]:
        """Get case by ID"""
        doc = self.index.search_case_by_id(case_id)
        if not doc:
            return None

        return SearchResult(
            document_id=doc["document_id"],
            case_id=doc.get("case_id"),
            title=doc.get("title", ""),
            document_type=doc.get("document_type", ""),
            area_code=doc.get("area_code"),
            year=doc.get("year"),
            year_buddhist=doc.get("year_buddhist"),
            similarity_score=1.0,
            structured_match=True,
            snippet=""
        )

    def get_related_cases(self, case_id: str, top_k: int = 5) -> List[SearchResult]:
        """Get cases related to specific case"""
        # Find the case
        doc = self.index.search_case_by_id(case_id)
        if not doc:
            return []

        # Get keywords from case
        keywords = doc.get("keywords", [])
        if not keywords:
            return []

        # Search for cases with similar keywords and same area
        results = self.index.search_by_filters(
            area_code=doc.get("area_code"),
            keywords=keywords,
            doc_type="case_note",
            limit=top_k + 1  # +1 to exclude self
        )

        final_results = []
        for r in results:
            if r["document_id"] == case_id:
                continue  # Skip self

            result = SearchResult(
                document_id=r["document_id"],
                case_id=r.get("case_id"),
                title=r.get("title", ""),
                document_type=r.get("document_type", ""),
                area_code=r.get("area_code"),
                year=r.get("year"),
                year_buddhist=r.get("year_buddhist"),
                similarity_score=0.8,
                structured_match=True,
                snippet=""
            )
            final_results.append(result)

        return final_results[:top_k]

    def get_statistics(self) -> Dict:
        """Get search index statistics"""
        return self.index.get_statistics()

    def _create_snippet(self, text: str, query: str, length: int = 150) -> str:
        """Create snippet with query highlighted"""
        if not text or len(text) < 50:
            return text[:length]

        # Try to find query in text and create snippet around it
        query_lower = query.lower()
        text_lower = text.lower()
        pos = text_lower.find(query_lower)

        if pos > 0:
            start = max(0, pos - 50)
            end = min(len(text), pos + length)
            snippet = text[start:end]
            if start > 0:
                snippet = "..." + snippet
            if end < len(text):
                snippet = snippet + "..."
            return snippet

        return text[:length] + "..." if len(text) > length else text


# Example usage
if __name__ == "__main__":
    from structured_index import StructuredIndex
    # from vector_store import VectorStore  # Would import ChromaDB wrapper

    index = StructuredIndex("data/nhrc_index.db")

    # For now, just test structured search
    print("🔍 Testing Hybrid Search Interface:")

    stats = index.get_statistics()
    print(f"\n📊 Index has {stats['total_documents']} documents")
    print(f"   By type: {stats['by_type']}")
    print(f"   By area: {stats['by_area']}\n")

    # Example: search by area
    print("📌 Cases in Area A (พลเมืองและการเมือง):")
    results = index.search_by_filters(area_code="A", doc_type="case_note", limit=5)
    for i, doc in enumerate(results, 1):
        print(f"   {i}. [{doc['year_buddhist']}] {doc['title']}")

    print("\n✅ Hybrid search module ready for integration with ChromaDB")
