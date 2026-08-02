"""
Setup script for NHRC Obsidian Hybrid RAG

Parses the Obsidian vault and rebuilds the JSON index consumed by the
Next.js web app (data/nhrc_index.json).

StructuredIndex (SQLite) is not used here - it fails with a disk I/O error
on this machine's mount (see HANDOFF.md). JSONIndex is the supported path.

Usage:
    python setup_obsidian_index.py
"""

import json
import shutil
import sys
from collections import Counter
from itertools import combinations
from pathlib import Path

from src.obsidian_parser import ObsidianParser
from src.json_index import JSONIndex

AREA_MAPPING = {
    "A": "สิทธิพลเมืองและสิทธิทางการเมือง",
    "B": "สิทธิทางเศรษฐกิจ สังคม และวัฒนธรรม",
    "C": "สิทธิของกลุ่มบุคคล",
    "D": "สถานการณ์เชิงพื้นที่-เฉพาะ",
    "E": "เพิ่มเติมจากแท็กซอนอมีเดิม",
}


def _export_content_files(documents: list, content_dir: Path) -> None:
    """
    Write each document's full body to its own file under content_dir,
    keyed by document_id, and strip "content" out of the in-memory dicts.

    Keeps the metadata index small (bug #5): API routes that only need
    titles/filters/stats never load full case text, and a case-detail
    route can read a single file on demand instead of holding all 410
    documents' full text in memory.
    """
    content_dir.mkdir(parents=True, exist_ok=True)
    for doc in documents:
        content = doc.pop("content", "") or ""
        out_file = content_dir / f"{doc['document_id']}.txt"
        out_file.write_text(content, encoding="utf-8")


def _export_source_documents(documents: list, documents_dir: Path) -> int:
    """
    Copy each document's source PDF (found by the parser, if any) into
    documents_dir as <document_id>.pdf, and strip the internal "_pdf_source"
    field before the JSON index is written. Returns how many were copied.
    """
    documents_dir.mkdir(parents=True, exist_ok=True)
    copied = 0
    for doc in documents:
        source = doc.pop("_pdf_source", None)
        if not source:
            continue
        dest = documents_dir / f"{doc['document_id']}.pdf"
        try:
            shutil.copyfile(source, dest)
            copied += 1
        except OSError as e:
            print(f"   Warning: could not copy PDF for {doc['document_id']}: {e}")
    return copied


def _export_graph(documents: list, graph_path: Path) -> dict:
    """
    Build a small "topic map" graph: area nodes -> topic nodes (hierarchy),
    plus topic <-> topic edges when two topics share case notes (a genuine
    relatedness signal, not just folder structure). Deliberately excludes
    individual case notes as nodes - with ~285 of them the graph would be
    unreadable, and the point of this view is to browse by topic, not case.

    No personal data here - only topic/area names and case counts, never
    case_ids or case titles - so unlike the rest of data/, this file is safe
    to leave un-gitignored if that's ever wanted. It still isn't, for
    consistency with everything else this script generates.
    """
    topics = [d for d in documents if d.get("document_type") == "topic"]
    case_notes = [d for d in documents if d.get("document_type") == "case_note"]

    # topic_id -> set of case_ids filed under it
    topic_cases: dict = {t["document_id"]: set() for t in topics}
    for case in case_notes:
        for topic_id in case.get("topic_ids", []):
            if topic_id in topic_cases:
                topic_cases[topic_id].add(case["case_id"])

    active_topics = {tid: cases for tid, cases in topic_cases.items() if cases}
    topic_by_id = {t["document_id"]: t for t in topics}
    area_counts = Counter(c["area_code"] for c in case_notes if c.get("area_code"))

    nodes = []
    for area_code, area_name in AREA_MAPPING.items():
        if area_counts.get(area_code):
            nodes.append({
                "id": f"area_{area_code}",
                "type": "area",
                "label": area_name,
                "areaCode": area_code,
                "count": area_counts[area_code],
            })
    for topic_id, cases in active_topics.items():
        topic = topic_by_id[topic_id]
        nodes.append({
            "id": topic_id,
            "type": "topic",
            "label": topic["title"],
            "areaCode": topic.get("area_code"),
            "count": len(cases),
        })

    edges = []
    for topic_id in active_topics:
        area_code = topic_by_id[topic_id].get("area_code")
        if area_code and area_counts.get(area_code):
            edges.append({"source": f"area_{area_code}", "target": topic_id, "type": "hierarchy"})
    for (id_a, cases_a), (id_b, cases_b) in combinations(active_topics.items(), 2):
        shared = len(cases_a & cases_b)
        if shared > 0:
            edges.append({"source": id_a, "target": id_b, "type": "shared_cases", "weight": shared})

    graph = {"nodes": nodes, "edges": edges}
    graph_path.parent.mkdir(parents=True, exist_ok=True)
    graph_path.write_text(json.dumps(graph, ensure_ascii=False, indent=2), encoding="utf-8")
    return graph


def setup_nhrc_index(
    vault_path: str = r"D:\back up\รายงานและข้อเสนอแนะ กสม",
    index_file: str = "data/nhrc_index.json",
    content_dir: str = "data/nhrc_content",
    documents_dir: str = "data/nhrc_documents",
    graph_file: str = "data/nhrc_graph.json",
) -> bool:
    """
    Parse the Obsidian vault and rebuild the JSON index.

    Args:
        vault_path: Path to Obsidian vault
        index_file: Path to the metadata-only JSON index read by the web app
        content_dir: Directory of per-document full-text files

    Returns:
        True if successful
    """
    print("🚀 NHRC Hybrid RAG Setup\n")

    print("📚 Step 1: Parsing Obsidian vault...")
    try:
        parser = ObsidianParser(vault_path)
        documents = parser.parse_vault()
        print(f"   ✅ Parsed {len(documents)} documents\n")
    except Exception as e:
        print(f"   ❌ Error parsing vault: {e}")
        return False

    doc_types = {}
    for doc in documents:
        dtype = doc.get("document_type")
        doc_types[dtype] = doc_types.get(dtype, 0) + 1

    print("   📊 Document breakdown:")
    for dtype, count in sorted(doc_types.items()):
        print(f"      - {dtype}: {count}")
    print()

    print("✂️  Step 2: Splitting full text out of the metadata index...")
    _export_content_files(documents, Path(content_dir))
    print(f"   ✅ Wrote per-document text files to: {content_dir}\n")

    print("📄 Step 2b: Copying source PDFs (where found)...")
    copied = _export_source_documents(documents, Path(documents_dir))
    print(f"   ✅ Copied {copied} PDFs to: {documents_dir}\n")

    print("🕸️  Step 2c: Building topic map graph...")
    graph = _export_graph(documents, Path(graph_file))
    topic_nodes = sum(1 for n in graph["nodes"] if n["type"] == "topic")
    shared_edges = sum(1 for e in graph["edges"] if e["type"] == "shared_cases")
    print(f"   ✅ {topic_nodes} topics, {shared_edges} shared-case links -> {graph_file}\n")

    print("📝 Step 3: Rebuilding metadata-only JSON index...")
    try:
        index = JSONIndex(index_file)
        index.rebuild_index(documents)
        print(f"   ✅ Wrote {len(documents)} documents to: {index_file}\n")
    except Exception as e:
        print(f"   ❌ Error writing index: {e}")
        return False

    print("📊 Step 4: Index Statistics")
    stats = index.get_statistics()

    print(f"\n   Total documents: {stats['total_documents']}")
    print(f"   By type: {stats['by_type']}")
    print(f"   By area: {stats['by_area']}")

    if stats.get('cases_by_year'):
        print(f"\n   Cases by year (B.E.):")
        for year in sorted(stats['cases_by_year'].keys()):
            count = stats['cases_by_year'][year]
            print(f"      - {year}: {count} cases")

    print("\n✅ Setup complete!")
    print("\n📌 Next step:")
    print("   Wire /api/search/hybrid to ChromaDB for real semantic search (bug #6)")

    return True


def test_search(index_file: str = "data/nhrc_index.json"):
    """Sanity-check the rebuilt index"""
    print("\n\n🔍 Testing Search Functionality\n")

    index = JSONIndex(index_file)

    print("Test 1: Cases in Area A (สิทธิพลเมืองและการเมือง)")
    results = index.search_by_filters(area_code="A", doc_type="case_note", limit=5)
    print(f"   Found: {len(results)} results")
    for i, doc in enumerate(results[:3], 1):
        print(f"   {i}. [{doc['year_buddhist']}] {doc['title']}")

    print("\nTest 2: Cases from 2564")
    results = index.search_by_filters(year_buddhist=2564, doc_type="case_note", limit=5)
    print(f"   Found: {len(results)} results")
    for i, doc in enumerate(results[:3], 1):
        print(f"   {i}. {doc['case_id']}: {doc['title']}")

    print("\nTest 3: All topics/areas")
    results = index.search_by_filters(doc_type="topic", limit=10)
    print(f"   Found: {len(results)} topics")
    for i, doc in enumerate(results[:5], 1):
        print(f"   {i}. [{doc['area_code']}] {doc['title']}")

    print("\nTest 4: Get specific case by ID")
    case = index.search_case_by_id("128-2563")
    if case:
        print(f"   ✅ Found: {case['title']}")
        print(f"   Area: {case['area_code']}")
        print(f"   Keywords: {', '.join(case['keywords'][:5])}")
    else:
        print(f"   ❌ Case not found")

    print("\n✅ Search tests complete")


if __name__ == "__main__":
    success = setup_nhrc_index()

    if success:
        test_search()
        print("\n" + "=" * 60)
        print("📚 Ready to integrate with RAG pipeline!")
        print("=" * 60)
    else:
        print("\n❌ Setup failed")
        sys.exit(1)
