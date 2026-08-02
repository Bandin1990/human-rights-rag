"""
JSON-based Index for NHRC Knowledge Base

Simpler alternative to SQLite for use in Windows environments.
Stores index in JSON format with fast in-memory querying.
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass


class JSONIndex:
    """JSON-based index for structured document metadata"""

    def __init__(self, index_file: str = "data/nhrc_index.json"):
        """Initialize JSON index"""
        self.index_file = Path(index_file)
        self.index_file.parent.mkdir(parents=True, exist_ok=True)
        self.documents = {}

        # Load existing index if it exists
        if self.index_file.exists():
            self._load()

    def _load(self):
        """Load index from file"""
        try:
            with open(self.index_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.documents = {doc['document_id']: doc for doc in data}
        except Exception as e:
            print(f"Warning: Could not load index: {e}")
            self.documents = {}

    def _save(self):
        """Save index to file"""
        try:
            with open(self.index_file, 'w', encoding='utf-8') as f:
                json.dump(list(self.documents.values()), f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Warning: Could not save index: {e}")

    def add_document(self, metadata: Dict) -> bool:
        """Add document to index"""
        doc_id = metadata.get("document_id")
        if not doc_id or doc_id in self.documents:
            return False

        self.documents[doc_id] = metadata
        return True

    def add_documents_batch(self, metadata_list: List[Dict]) -> Tuple[int, int]:
        """Add multiple documents"""
        added = 0
        skipped = 0

        for metadata in metadata_list:
            if self.add_document(metadata):
                added += 1
            else:
                skipped += 1

        # Save after batch
        self._save()
        return added, skipped

    def search_by_filters(
        self,
        year: Optional[int] = None,
        year_buddhist: Optional[int] = None,
        year_range: Optional[Tuple[int, int]] = None,
        area_code: Optional[str] = None,
        doc_type: Optional[str] = None,
        keywords: Optional[List[str]] = None,
        limit: int = 50
    ) -> List[Dict]:
        """Search by structured filters"""
        results = []

        for doc in self.documents.values():
            # Apply filters
            if year is not None and doc.get("year") != year:
                continue

            if year_buddhist is not None and doc.get("year_buddhist") != year_buddhist:
                continue

            if year_range:
                doc_year = doc.get("year")
                if doc_year is None or not (year_range[0] <= doc_year <= year_range[1]):
                    continue

            if area_code and doc.get("area_code") != area_code:
                continue

            if doc_type and doc.get("document_type") != doc_type:
                continue

            if keywords:
                doc_keywords = set(doc.get("keywords", []))
                search_keywords = set(keywords)
                if not doc_keywords.intersection(search_keywords):
                    continue

            results.append(doc)

        return results[:limit]

    def search_case_by_id(self, case_id: str) -> Optional[Dict]:
        """Get case by ID"""
        for doc in self.documents.values():
            if doc.get("case_id") == case_id:
                return doc
        return None

    def get_statistics(self) -> Dict:
        """Get index statistics"""
        doc_types = {}
        area_counts = {}
        year_counts = {}
        cases_by_year = {}

        for doc in self.documents.values():
            doc_type = doc.get("document_type")
            if doc_type:
                doc_types[doc_type] = doc_types.get(doc_type, 0) + 1

            area = doc.get("area_code")
            if area:
                area_counts[area] = area_counts.get(area, 0) + 1

            year = doc.get("year")
            if year:
                year_counts[year] = year_counts.get(year, 0) + 1

            if doc_type == "case_note":
                year_b = doc.get("year_buddhist")
                if year_b:
                    cases_by_year[year_b] = cases_by_year.get(year_b, 0) + 1

        return {
            "total_documents": len(self.documents),
            "by_type": doc_types,
            "by_area": area_counts,
            "by_year": year_counts,
            "cases_by_year": cases_by_year
        }

    def delete_document(self, document_id: str) -> bool:
        """Delete document"""
        if document_id in self.documents:
            del self.documents[document_id]
            self._save()
            return True
        return False

    def export_index(self, output_file: str):
        """Export to JSON"""
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(list(self.documents.values()), f, ensure_ascii=False, indent=2)

    def rebuild_index(self, metadata_list: List[Dict]):
        """Rebuild index"""
        self.documents = {}
        self.add_documents_batch(metadata_list)
