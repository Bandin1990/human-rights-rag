from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass

from .models import Citation, RagAnswer, SearchResult


SYSTEM_PROMPT = """คุณเป็นผู้ช่วยสืบค้นเอกสารสิทธิมนุษยชนภาษาไทย
ให้ตอบจาก CONTEXT ที่ให้มาเท่านั้น ห้ามใช้ความรู้ภายนอก
หาก CONTEXT ไม่มีคำตอบ ให้ตอบว่า "ไม่พบข้อมูลจากเอกสารที่นำเข้า"
ห้ามสร้างชื่อเอกสาร เลขหน้า หรือแหล่งอ้างอิงเอง
ตอบเป็นภาษาไทย กระชับ และระบุความไม่แน่ใจเมื่อหลักฐานไม่พอ"""


@dataclass
class OllamaClient:
    base_url: str
    model_name: str
    timeout_seconds: int = 120

    def is_available(self) -> bool:
        try:
            with urllib.request.urlopen(f"{self.base_url}/api/tags", timeout=5) as response:
                return response.status == 200
        except Exception:
            return False

    def generate(self, prompt: str) -> str:
        payload = json.dumps(
            {
                "model": self.model_name,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.1},
            }
        ).encode("utf-8")
        request = urllib.request.Request(
            f"{self.base_url}/api/generate",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                data = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"Ollama ตอบกลับด้วยสถานะ {exc.code}") from exc
        except Exception as exc:
            raise RuntimeError(f"เรียก Ollama ไม่สำเร็จ: {exc}") from exc
        return str(data.get("response", "")).strip()


class RagService:
    def __init__(self, ollama: OllamaClient) -> None:
        self.ollama = ollama

    def answer(self, question: str, contexts: list[SearchResult]) -> RagAnswer:
        citations = build_citations(contexts)
        if not contexts:
            return RagAnswer(
                answer="ไม่พบข้อมูลจากเอกสารที่นำเข้า",
                citations=[],
                contexts=[],
                ollama_available=self.ollama.is_available(),
            )
        available = self.ollama.is_available()
        if not available:
            return RagAnswer(
                answer="ยังไม่สามารถเรียก Ollama ได้ แต่สามารถดูข้อความที่ค้นพบด้านล่างเพื่อพิจารณาเอง",
                citations=citations,
                contexts=contexts,
                ollama_available=False,
            )
        prompt = build_prompt(question, contexts)
        answer = self.ollama.generate(prompt)
        if not answer:
            answer = "ไม่พบข้อมูลจากเอกสารที่นำเข้า"
        return RagAnswer(answer=answer, citations=citations, contexts=contexts, ollama_available=True)


def build_prompt(question: str, contexts: list[SearchResult]) -> str:
    context_text = "\n\n".join(
        f"[C{index}] เอกสาร: {item.metadata.get('title', '')} | หน้า {item.metadata.get('page_number', '')}\n{item.text}"
        for index, item in enumerate(contexts, start=1)
    )
    return f"{SYSTEM_PROMPT}\n\nCONTEXT:\n{context_text}\n\nคำถาม: {question.strip()}\n\nคำตอบ:"


def build_citations(contexts: list[SearchResult]) -> list[Citation]:
    citations: list[Citation] = []
    seen: set[tuple[str, int, str]] = set()
    for item in contexts:
        page = int(item.metadata.get("page_number", 0) or 0)
        key = (str(item.metadata.get("document_id", "")), page, item.text)
        if key in seen:
            continue
        seen.add(key)
        citations.append(
            Citation(
                title=str(item.metadata.get("title", "")),
                file_name=str(item.metadata.get("file_name", "")),
                page_number=page,
                text=item.text,
                document_id=str(item.metadata.get("document_id", "")),
            )
        )
    return citations
