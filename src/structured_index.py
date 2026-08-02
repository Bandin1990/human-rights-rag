"""
Structured Index for NHRC Knowledge Base

Maintains indexed metadata for fast filtering and aggregation:
- Year-based queries
- Area/Category filtering
- Document type filtering
- Keyword/full-text search

Works in conjunction with ChromaDB embeddings for hybrid search.
"""

import json
import sqlite3
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime


@dataclass
class IndexedDocument:
    """Structured document metadata for indexing"""
    document_id: str
    case_id: Optional[str]
    file_name: str
    file_path: str
    document_type: str  # case_note, topic, project, general
    area_code: Optional[str]  # A, B, C, D, E
    area_name: Optional[str]
    year: Optional[int]  # gregorian
    year_buddhist: Optional[int]  # buddhist
    title: str
    keywords: List[str]
    uploaded_at: str
    page_count: int


class StructuredIndex:
    """Manages structured metadata index for fast queries"""

    def __init__(self, db_path: str = "data/index.db"):
        """
        Initialize structured index

        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self):
        """Initialize SQLite database with schema"""
        try:
            with sqlite3.connect(self.db_path, timeout=10) as conn:
                # Enable WAL mode for better concurrency
                conn.execute("PRAGMA journal_mode=WAL")

                conn.execute("""
                    CREATE TABLE IF NOT EXISTS documents (
                        document_id TEXT PRIMARY KEY,
                        case_id TEXT,
                        file_name TEXT NOT NULL,
                        file_path TEXT NOT NULL UNIQUE,
                        document_type TEXT NOT NULL,
                        area_code TEXT,
                        area_name TEXT,
                        year INTEGER,
                        year_buddhist INTEGER,
                        title TEXT NOT NULL,
                        keywords TEXT,  -- JSON array
                        uploaded_at TEXT,
                        page_count INTEGER,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP
                    )
                """)

                # Index for faster queries
                conn.execute("CREATE INDEX IF NOT EXISTS idx_year ON documents(year)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_area ON documents(area_code)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_type ON documents(document_type)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_case_id ON documents(case_id)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_title ON documents(title)")

                conn.commit()
        except Exception as e:
            print(f"Warning: Could not initialize SQLite: {e}")
            print("Falling back to JSON-based index")

    def add_document(self, metadata: Dict) -> bool:
        """
        Add document metadata to index

        Args:
            metadata: Document metadata dict from parser

        Returns:
            True if successful, False if already exists
        """
        try:
            doc = IndexedDocument(
                document_id=metadata.get("document_id"),
                case_id=metadata.get("case_id"),
                file_name=metadata.get("file_name"),
                file_path=metadata.get("file_path"),
                document_type=metadata.get("document_type"),
                area_code=metadata.get("area_code"),
                area_name=metadata.get("area_name"),
                year=metadata.get("year"),
                year_buddhist=metadata.get("year_buddhist"),
                title=metadata.get("title"),
                keywords=metadata.get("keywords", []),
                uploaded_at=metadata.get("uploaded_at"),
                page_count=metadata.get("page_count", 1)
            )

            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    doc.document_id,
                    doc.case_id,
                    doc.file_name,
                    doc.file_path,
                    doc.document_type,
                    doc.area_code,
                    doc.area_name,
                    doc.year,
                    doc.year_buddhist,
                    doc.title,
                    json.dumps(doc.keywords, ensure_ascii=False),
                    doc.uploaded_at,
                    doc.page_count
                ))
                conn.commit()

            return True

        except sqlite3.IntegrityError:
            return False  # Document already exists

    def add_documents_batch(self, metadata_list: List[Dict]) -> Tuple[int, int]:
        """
        Add multiple documents to index

        Args:
            metadata_list: List of metadata dicts

        Returns:
            Tuple of (added_count, skipped_count)
        """
        added = 0
        skipped = 0

        for metadata in metadata_list:
            if self.add_document(metadata):
                added += 1
            else:
                skipped += 1

        return added, skipped

    def search_by_filters(
        self,
        year: Optional[int] = None,
        year_range: Optional[Tuple[int, int]] = None,
        area_code: Optional[str] = None,
        doc_type: Optional[str] = None,
        keywords: Optional[List[str]] = None,
        limit: int = 50
    ) -> List[Dict]:
        """
        Search documents by structured filters

        Args:
            year: Specific year (gregorian)
            year_range: Year range (start, end)
            area_code: Single area code (A-E)
            doc_type: Document type (case_note, topic, etc.)
            keywords: List of keywords (match ANY)
            limit: Max results to return

        Returns:
            List of matching documents
        """
        query = "SELECT * FROM documents WHERE 1=1"
        params = []

        if year is not None:
            query += " AND year = ?"
            params.append(year)

        if year_range:
            query += " AND year BETWEEN ? AND ?"
            params.extend(year_range)

        if area_code:
            query += " AND area_code = ?"
            params.append(area_code)

        if doc_type:
            query += " AND document_type = ?"
            params.append(doc_type)

        query += f" LIMIT {limit}"

        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(query, params)
            rows = cursor.fetchall()

        results = []
        for row in rows:
            doc = dict(row)
            doc["keywords"] = json.loads(doc["keywords"])

            # Filter by keywords if provided
            if keywords:
                doc_keywords_set = set(doc["keywords"])
                search_keywords_set = set(keywords)
                if not doc_keywords_set.intersection(search_keywords_set):
                    continue

            results.append(doc)

        return results

    def search_case_by_id(self, case_id: str) -> Optional[Dict]:
        """
        Get case by case ID

        Args:
            case_id: Case ID (e.g., "128-2563")

        Returns:
            Document dict or None if not found
        """
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                "SELECT * FROM documents WHERE case_id = ?",
                (case_id,)
            )
            row = cursor.fetchone()

        if row:
            doc = dict(row)
            doc["keywords"] = json.loads(doc["keywords"])
            return doc

        return None

    def get_statistics(self) -> Dict:
        """
        Get index statistics

        Returns:
            Dict with various statistics
        """
        with sqlite3.connect(self.db_path) as conn:
            # Total documents
            cursor = conn.execute("SELECT COUNT(*) as count FROM documents")
            total_docs = cursor.fetchone()[0]

            # By document type
            cursor = conn.execute(
                "SELECT document_type, COUNT(*) as count FROM documents GROUP BY document_type"
            )
            by_type = {row[0]: row[1] for row in cursor.fetchall()}

            # By area code
            cursor = conn.execute(
                "SELECT area_code, COUNT(*) as count FROM documents WHERE area_code IS NOT NULL GROUP BY area_code"
            )
            by_area = {row[0]: row[1] for row in cursor.fetchall()}

            # By year
            cursor = conn.execute(
                "SELECT year, COUNT(*) as count FROM documents WHERE year IS NOT NULL GROUP BY year ORDER BY year"
            )
            by_year = {str(row[0]): row[1] for row in cursor.fetchall()}

            # Case count by year (buddhist)
            cursor = conn.execute(
                "SELECT year_buddhist, COUNT(*) as count FROM documents WHERE document_type='case_note' GROUP BY year_buddhist ORDER BY year_buddhist"
            )
            cases_by_year = {str(row[0]): row[1] for row in cursor.fetchall()}

        return {
            "total_documents": total_docs,
            "by_type": by_type,
            "by_area": by_area,
            "by_year": by_year,
            "cases_by_year": cases_by_year
        }

    def get_area_name(self, area_code: str) -> Optional[str]:
        """Get full area name for area code"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT area_name FROM documents WHERE area_code = ? LIMIT 1",
                (area_code,)
            )
            row = cursor.fetchone()

        return row[0] if row else None

    def delete_document(self, document_id: str) -> bool:
        """Delete document from index"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "DELETE FROM documents WHERE document_id = ?",
                (document_id,)
            )
            conn.commit()
            return cursor.rowcount > 0

    def rebuild_index(self, metadata_list: List[Dict]):
        """
        Rebuild entire index from metadata list

        Args:
            metadata_list: List of document metadata dicts
        """
        # Drop existing table
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("DROP TABLE IF EXISTS documents")
            conn.commit()

        # Recreate and repopulate
        self._init_db()
        self.add_documents_batch(metadata_list)

    def export_index(self, output_file: str):
        """Export index to JSON for backup"""
        docs = self.search_by_filters(limit=10000)
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(docs, f, ensure_ascii=False, indent=2)

    def import_index(self, input_file: str):
        """Import index from JSON"""
        with open(input_file, 'r', encoding='utf-8') as f:
            docs = json.load(f)
        self.rebuild_index(docs)


# Example usage
if __name__ == "__main__":
    from obsidian_parser import ObsidianParser

    vault_path = r"D:\back up\รายงานและข้อเสนอแนะ กสม"
    parser = ObsidianParser(vault_path)
    index = StructuredIndex("data/nhrc_index.db")

    # Parse and index
    print("📚 Parsing Obsidian vault...")
    documents = parser.parse_vault()

    print(f"📝 Adding {len(documents)} documents to index...")
    added, skipped = index.add_documents_batch(documents)
    print(f"✅ Added: {added}, Skipped: {skipped}\n")

    # Show statistics
    stats = index.get_statistics()
    print("📊 Index Statistics:")
    print(f"  Total documents: {stats['total_documents']}")
    print(f"  By type: {stats['by_type']}")
    print(f"  By area: {stats['by_area']}")
    print(f"  Cases by year: {stats['cases_by_year']}\n")

    # Example searches
    print("🔍 Example Searches:")

    # Search by area
    print("\n1. Cases in Area A (สิทธิพลเมือง):")
    results = index.search_by_filters(area_code="A", limit=5)
    for doc in results:
        if doc["document_type"] == "case_note":
            print(f"   - {doc['case_id']}: {doc['title']}")

    # Search by year
    print("\n2. Cases in 2564:")
    results = index.search_by_filters(year=2021, limit=5)
    for doc in results:
        if doc["document_type"] == "case_note":
            print(f"   - {doc['case_id']}: {doc['title']}")

    # Search topics
    print("\n3. All topics:")
    results = index.search_by_filters(doc_type="topic", limit=10)
    for doc in results:
        print(f"   - [{doc['area_code']}] {doc['title']}")

    # Export for inspection
    print("\n📤 Exporting index...")
    index.export_index("obsidian_index.json")
    print("✅ Exported to: obsidian_index.json")
