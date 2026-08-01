from src.models import SearchResult
from src.rag import build_citations, build_prompt


def test_citations_are_built_from_metadata():
    result = SearchResult(
        chunk_id="c1",
        text="ข้อความต้นฉบับเกี่ยวกับสิทธิในการร้องเรียน",
        score=0.91,
        metadata={
            "document_id": "doc1",
            "title": "รายงานจำลอง",
            "file_name": "doc1.pdf",
            "page_number": 3,
        },
    )

    citations = build_citations([result])

    assert citations[0].title == "รายงานจำลอง"
    assert citations[0].page_number == 3
    assert citations[0].text == result.text


def test_prompt_instructs_context_only():
    prompt = build_prompt(
        "พบข้อเสนอแนะอะไร",
        [
            SearchResult(
                chunk_id="c1",
                text="ข้อเสนอแนะคือให้จัดช่องทางร้องเรียน",
                score=0.88,
                metadata={"title": "รายงานจำลอง", "page_number": 1},
            )
        ],
    )

    assert "ตอบจาก CONTEXT" in prompt
    assert "ห้ามสร้างชื่อเอกสาร" in prompt
    assert "ข้อเสนอแนะคือให้จัดช่องทางร้องเรียน" in prompt
