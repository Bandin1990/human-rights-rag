"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, Check, CheckCircle2, Clock3, ExternalLink, FileCheck2, History, LockKeyhole, Save, Send, ShieldCheck, Sparkles } from "lucide-react";
import { RagResearchPanel } from "@/components/cases/rag-research-panel";
import { formatThaiDate, reportStatusLabels } from "@/lib/cases/presentation";
import type { CaseActor, ComplaintCase, InvestigationReport, ReportOutcome, ReportSectionKey, ReportType } from "@/types/case";
import { REPORT_SECTION_DEFINITIONS_NHRC2, REPORT_SECTION_DEFINITIONS_NHRC3 } from "@/types/case";
import type { Citation } from "@/types/document";

interface ReportStudioProps { complaint: ComplaintCase; actor: CaseActor }

const outcomeLabels: Record<ReportOutcome, string> = {
  pending: "ยังไม่ระบุผลที่เสนอ",
  violation: "เสนอว่ามีการละเมิดสิทธิมนุษยชน",
  no_violation: "เสนอว่าไม่มีการละเมิดสิทธิมนุษยชน",
  terminated_withdrawal: "เสนอให้ยุติเรื่อง (ผู้ร้องขอถอนคำร้อง)",
  terminated_court: "เสนอให้ยุติเรื่อง (เรื่องอยู่ในชั้นศาล)",
  terminated_other: "เสนอให้ยุติเรื่อง (เหตุอื่นๆ ตามระเบียบ)",
};

export function ReportStudio({ complaint, actor }: ReportStudioProps) {
  const [report, setReport] = useState<InvestigationReport>(complaint.report);
  const [saving, setSaving] = useState<"draft" | "submit_to_head" | "submit_to_director" | "submit_to_exec" | "submit_to_comm" | "approve_final" | "revise" | null>(null);
  const [autoDrafting, setAutoDrafting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const locked = !actor.demo && !["case_officer", "supervisor", "report_screener"].includes(actor.role) || !["draft", "revision_requested"].includes(report.status);
  const completeSections = report.sections.filter((section) => section.content.trim().length >= 20).length;
  const targetCitations = report.type === "NHRC2" ? "nhrc_opinion" : "proceedings";
  const legalCitations = report.sections.find((section) => section.key === targetCitations)?.citations.length || 0;
  const ready = completeSections === report.sections.length && legalCitations > 0 && report.outcome !== "pending";

  function handleTypeChange(type: ReportType) {
    if (locked) return;
    const defs = type === "NHRC2" ? REPORT_SECTION_DEFINITIONS_NHRC2 : REPORT_SECTION_DEFINITIONS_NHRC3;
    const newSections = defs.map(def => {
      const existing = report.sections.find(s => s.key === def.key);
      return existing ? { ...existing, title: def.title, requirement: def.requirement } : { id: `section-${def.key}`, ...def, content: "", citations: [] };
    });
    setReport(current => ({ ...current, type, sections: newSections }));
  }

  function updateContent(key: ReportSectionKey, content: string) {
    setReport((current) => ({ ...current, sections: current.sections.map((section) => section.key === key ? { ...section, content } : section) }));
    setMessage(null);
  }

  function addCitation(target: ReportSectionKey, citation: Citation) {
    setReport((current) => ({
      ...current,
      sections: current.sections.map((section) => section.key !== target || section.citations.some((item) => item.sectionId === citation.sectionId)
        ? section
        : { ...section, citations: [...section.citations, citation] }),
    }));
    setMessage({ type: "success", text: "เพิ่ม citation ในร่างแล้ว กรุณาอ่านต้นฉบับและตรวจบริบทก่อนบันทึก" });
  }

  function removeCitation(target: ReportSectionKey, sectionId: string) {
    setReport((current) => ({ ...current, sections: current.sections.map((section) => section.key === target ? { ...section, citations: section.citations.filter((citation) => citation.sectionId !== sectionId) } : section) }));
  }

  async function save(intent: "draft" | "submit_to_head" | "submit_to_director" | "submit_to_exec" | "submit_to_comm" | "approve_final" | "revise") {
    setSaving(intent);
    setMessage(null);
    try {
      const response = await fetch(`/api/cases/${complaint.id}/report`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ outcome: report.outcome, sections: report.sections, intent }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "บันทึกรายงานไม่สำเร็จ");
      setReport(payload);
      let successMsg = `บันทึกร่างรายงานฉบับที่ ${payload.version} แล้ว`;
      if (intent === "submit_to_head") successMsg = "ส่งร่างให้หัวหน้ากลุ่มตรวจแล้ว";
      if (intent === "submit_to_director") successMsg = "ส่งร่างให้ ผอ. สำนักตรวจแล้ว";
      if (intent === "submit_to_exec") successMsg = "ส่งร่างให้ผู้บริหารพิจารณาแล้ว";
      if (intent === "submit_to_comm") successMsg = "เสนอ กสม. พิจารณาแล้ว";
      if (intent === "approve_final") successMsg = "กสม. อนุมัติเห็นชอบรายงานฉบับสมบูรณ์แล้ว";
      setMessage({ type: "success", text: successMsg });
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "บันทึกรายงานไม่สำเร็จ" });
    } finally {
      setSaving(null);
    }
  }

  async function handleAutoDraft() {
    setAutoDrafting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/cases/${complaint.id}/report/auto-draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ aiRecommendations: [], reportType: report.type })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "สร้างร่างรายงานอัตโนมัติไม่สำเร็จ");
      
      setReport((current) => {
        const next = { ...current, outcome: payload.outcome };
        if (payload.sections) {
          next.sections = current.sections.map(section => ({
            ...section,
            content: payload.sections[section.key] || section.content
          }));
        }
        return next;
      });
      setMessage({ type: "success", text: "ร่างรายงานด้วย AI สำเร็จแล้ว กรุณาตรวจสอบและแก้ไขให้ถูกต้อง" });
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "สร้างร่างรายงานอัตโนมัติไม่สำเร็จ" });
    } finally {
      setAutoDrafting(false);
    }
  }

  return (
    <div className="report-studio">
      <section className="report-studio-toolbar">
        <div><span className="case-eyebrow">INVESTIGATION REPORT · RULE 43</span><h2>ร่างรายงานผลการตรวจสอบ</h2><p>ฉบับที่ {report.version || "ยังไม่บันทึก"} · แก้ไขล่าสุด {formatThaiDate(report.updatedAt, true)} โดย {report.updatedBy}</p></div>
        <div style={{ marginLeft: "auto", marginRight: "1rem" }}>
          <select disabled={locked || Boolean(saving) || autoDrafting} value={report.type || "NHRC2"} onChange={e => handleTypeChange(e.target.value as ReportType)} style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border)" }}>
            <option value="NHRC2">กสม. 2 (รายงานการตรวจสอบ)</option>
            <option value="NHRC3">กสม. 3 (รายงานข้อเสนอแนะ)</option>
          </select>
        </div>
        <div className="report-toolbar-actions">
          <span className={`report-status report-${report.status}`}>{reportStatusLabels[report.status]}</span>
          <button type="button" className="case-secondary-button" disabled={Boolean(saving) || locked || autoDrafting} onClick={handleAutoDraft}><Sparkles size={16} />{autoDrafting ? "กำลังร่าง..." : "ร่างด้วย AI"}</button>
          <button type="button" className="case-secondary-button" disabled={Boolean(saving) || locked} onClick={() => save("draft")}><Save size={16} />{saving === "draft" ? "กำลังบันทึก..." : "บันทึกร่าง"}</button>
          
          {report.status === "draft" && (
            <button type="button" className="case-primary-button" disabled={Boolean(saving) || locked || !ready} onClick={() => save("submit_to_head")}><Send size={16} />{saving === "submit_to_head" ? "กำลังส่ง..." : "เสนอหัวหน้ากลุ่ม"}</button>
          )}
          {report.status === "group_head_review" && (
            <button type="button" className="case-primary-button" disabled={Boolean(saving) || !ready} onClick={() => save("submit_to_director")}><Send size={16} />{saving === "submit_to_director" ? "กำลังส่ง..." : "เสนอ ผอ. สำนัก"}</button>
          )}
          {report.status === "bureau_director_review" && (
            <button type="button" className="case-primary-button" disabled={Boolean(saving) || !ready} onClick={() => save("submit_to_exec")}><Send size={16} />{saving === "submit_to_exec" ? "กำลังส่ง..." : "เสนอผู้บริหาร"}</button>
          )}
          {report.status === "executive_review" && (
            <button type="button" className="case-primary-button" disabled={Boolean(saving) || !ready} onClick={() => save("submit_to_comm")}><Send size={16} />{saving === "submit_to_comm" ? "กำลังส่ง..." : "เสนอ กสม."}</button>
          )}
          {report.status === "commissioner_review" && (
            <button type="button" className="case-primary-button" style={{ background: "var(--success)", borderColor: "var(--success)" }} disabled={Boolean(saving) || !ready} onClick={() => save("approve_final")}><CheckCircle2 size={16} />{saving === "approve_final" ? "กำลังอนุมัติ..." : "กสม. เห็นชอบ"}</button>
          )}
          {report.status === "final" && (
            <button type="button" className="case-primary-button" style={{ background: "#2563eb", borderColor: "#2563eb" }} onClick={() => alert("กำลัง Export รายงานเป็น Word (.docx)...")}><ExternalLink size={16} /> Export to Word</button>
          )}
        </div>
      </section>

      {message && <div className={`report-message ${message.type}`} role={message.type === "error" ? "alert" : "status"}>{message.type === "success" ? <CheckCircle2 /> : <AlertCircle />}<span>{message.text}</span></div>}
      {locked && <div className="report-lock-note"><LockKeyhole size={17} /><span><b>รายงานอยู่ในขั้น {reportStatusLabels[report.status]}</b> ต้องรับกลับมาแก้ไขหรือมีสิทธิในขั้นตอนปัจจุบันก่อนจึงจะแก้เนื้อหาได้</span></div>}

      <div className="report-studio-grid">
        <aside className="report-outline">
          <div className="report-progress"><div><span>{completeSections}/{report.sections.length}</span><small>ส่วนครบถ้วน</small></div><div className="progress-track"><span style={{ width: `${(completeSections / report.sections.length) * 100}%` }} /></div></div>
          <nav aria-label="โครงรายงาน">{report.sections.map((section, index) => <a href={`#report-${section.key}`} key={section.key}><span className={section.content.trim().length >= 20 ? "complete" : ""}>{section.content.trim().length >= 20 ? <Check size={12} /> : index + 1}</span><div><b>{section.title}</b><small>{section.citations.length ? `${section.citations.length} citation` : "ยังไม่มี citation"}</small></div></a>)}</nav>
          <section className="report-readiness"><h3><FileCheck2 size={16} /> ความพร้อมส่งตรวจ</h3><div className={completeSections === report.sections.length ? "done" : ""}>{completeSections === report.sections.length ? <Check /> : <Clock3 />}เนื้อหาครบ {report.sections.length} ส่วน</div><div className={legalCitations > 0 ? "done" : ""}>{legalCitations > 0 ? <Check /> : <Clock3 />}มี citation กฎหมาย</div><div className={report.outcome !== "pending" ? "done" : ""}>{report.outcome !== "pending" ? <Check /> : <Clock3 />}ระบุผลที่เสนอ</div></section>
          <section className="version-note"><History size={15} /><p>ทุกครั้งที่บันทึกจะสร้าง version ใหม่ ฉบับเดิมไม่ถูกเขียนทับ</p></section>
        </aside>

        <div className="report-editor">
          <section className="report-outcome-card"><div><span className="case-eyebrow">PROPOSED OUTCOME</span><h3>ผลการตรวจสอบที่เจ้าหน้าที่เสนอ</h3><p>เป็นความเห็นในร่าง ไม่ใช่มติหรือคำวินิจฉัยของคณะกรรมการ</p></div><select disabled={locked} value={report.outcome} onChange={(event) => setReport((current) => ({ ...current, outcome: event.target.value as ReportOutcome }))}>{Object.entries(outcomeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></section>

          {report.sections.map((section, index) => <section className="report-section-card" id={`report-${section.key}`} key={section.key}>
            <header><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{section.title}</h3><p>{section.requirement}</p></div>{section.content.trim().length >= 20 && <CheckCircle2 className="section-complete" />}</header>
            <textarea disabled={locked} rows={section.key === "analysis" || section.key === "measures" ? 10 : 7} value={section.content} onChange={(event) => updateContent(section.key, event.target.value)} placeholder="เรียบเรียงจากหลักฐานที่เจ้าหน้าที่เลือกและตรวจสอบแล้ว โดยแยกข้อเท็จจริงออกจากความเห็น..." />
            <div className="section-footer"><span>{section.content.length.toLocaleString("th-TH")} ตัวอักษร</span><span>{section.citations.length} แหล่งอ้างอิง</span></div>
            {section.citations.length > 0 && <div className="section-citations"><h4>แหล่งอ้างอิงที่ผูกกับส่วนนี้</h4>{section.citations.map((citation, citationIndex) => <article key={citation.sectionId}><span>[{citationIndex + 1}]</span><div><Link href={`/documents/${citation.documentId}#${citation.sectionId}`} target="_blank"><b>{citation.title}</b><ExternalLink size={12} /></Link><p>{citation.excerpt}</p><small>{citation.page ? `หน้า ${citation.page}` : citation.anchor || "ไม่ระบุตำแหน่ง"}</small></div>{!locked && <button type="button" onClick={() => removeCitation(section.key, citation.sectionId)}>นำออก</button>}</article>)}</div>}
          </section>)}
        </div>
      </div>

      <RagResearchPanel complaintId={complaint.id} disabled={locked} onAddCitation={addCitation} />
      <section className="report-human-loop"><ShieldCheck /><div><b>Human-in-the-loop</b><p>ผลจาก RAG มีสถานะ “generated” จนกว่าเจ้าหน้าที่จะเปิดอ่านต้นฉบับ ตรวจบริบท และเลือกใช้ในร่าง การส่งรายงานเป็นการกระทำของผู้ใช้และถูกบันทึกเป็น version/audit event</p></div></section>
    </div>
  );
}
