"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Bot, Check, ExternalLink, Plus, Quote, Search, ShieldCheck, Sparkles } from "lucide-react";
import type { Citation } from "@/types/document";
import type { ReportSectionKey } from "@/types/case";

interface RagAnswer {
  answer: string;
  citations: Citation[];
  disclaimer: string;
  mode?: string;
  model?: string;
  redacted?: boolean;
}

interface RagResearchPanelProps {
  complaintId: string;
  disabled: boolean;
  onAddCitation: (target: ReportSectionKey, citation: Citation) => void;
}

export function RagResearchPanel({ complaintId, disabled, onAddCitation }: RagResearchPanelProps) {
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<ReportSectionKey>("legal_framework");
  const [answer, setAnswer] = useState<RagAnswer | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 3) return;
    setLoading(true);
    setError("");
    setAnswer(null);
    try {
      const response = await fetch(`/api/cases/${complaintId}/rag`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "ค้นคลังความรู้ไม่สำเร็จ");
      setAnswer(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ค้นคลังความรู้ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  function attachCitation(citation: Citation) {
    onAddCitation(target, citation);
    setAdded((current) => current.includes(citation.sectionId) ? current : [...current, citation.sectionId]);
  }

  return (
    <section className="rag-research-panel">
      <header className="rag-panel-heading">
        <span className="rag-icon"><Sparkles /></span>
        <div><span>PUBLIC KNOWLEDGE RAG</span><h2>ค้นกฎหมายและรายงานอ้างอิง</h2><p>ค้นจากคลังสาธารณะเท่านั้น ไม่ดึงไฟล์หรือ embedding ของสำนวนเข้าสู่ public search</p></div>
        <span className="human-review-chip"><ShieldCheck size={14} /> ต้องตรวจโดยมนุษย์</span>
      </header>
      <form className="rag-search-form" onSubmit={search}>
        <div className="rag-query"><Search size={18} /><textarea value={query} onChange={(event) => setQuery(event.target.value)} placeholder="เช่น หลักสิทธิในสุขภาพและการไม่เลือกปฏิบัติต่อแรงงานข้ามชาติ (ไม่ใส่ชื่อ เบอร์โทร หรือข้อมูลระบุตัวบุคคล)" /></div>
        <div className="rag-actions"><label>นำ citation ไปยัง<select value={target} onChange={(event) => setTarget(event.target.value as ReportSectionKey)}><option value="legal_framework">กฎหมายและหลักสิทธิ</option><option value="analysis">ความเห็นและเหตุผล</option><option value="measures">มาตรการ/ข้อเสนอแนะ</option></select></label><button type="submit" disabled={loading || query.trim().length < 3}><Sparkles size={16} />{loading ? "กำลังค้นหลักฐาน..." : "ค้นจากคลังความรู้"}</button></div>
      </form>
      {error && <p className="case-form-error" role="alert">{error}</p>}
      {answer && <div className="rag-answer">
        <div className="rag-answer-label"><Bot size={18} /><span>ผลช่วยค้น · <b>{answer.mode || "evidence"}</b></span>{answer.redacted && <em>ระบบปกปิดข้อมูลระบุตัวบุคคลก่อนค้นแล้ว</em>}</div>
        <p>{answer.answer}</p>
        <small>{answer.disclaimer}</small>
        <div className="rag-citations"><h3><Quote size={16} /> แหล่งอ้างอิงที่ตรวจพบ {answer.citations.length} รายการ</h3>{answer.citations.map((citation, index) => <article key={citation.sectionId}><div><span>[{index + 1}]</span><div><Link href={`/documents/${citation.documentId}#${citation.sectionId}`} target="_blank"><b>{citation.title}</b><ExternalLink size={13} /></Link><p>“{citation.excerpt}”</p><small>{citation.page ? `หน้า ${citation.page}` : citation.anchor ? `หัวข้อ ${citation.anchor}` : "ไม่ระบุตำแหน่ง"}</small></div></div><button type="button" disabled={disabled || added.includes(citation.sectionId)} onClick={() => attachCitation(citation)}>{added.includes(citation.sectionId) ? <><Check size={14} /> เพิ่มแล้ว</> : <><Plus size={14} /> ใช้อ้างอิง</>}</button></article>)}</div>
      </div>}
    </section>
  );
}
