"use client";

import { useState, useTransition, useRef } from "react";
import { CalendarClock, ClipboardCheck, FileCheck2, FilePenLine, History, LockKeyhole, MapPin, Scale, ShieldAlert, UserRoundCheck, UsersRound, SendToBack, Plus, Trash2, Pencil } from "lucide-react";
import { deadlineText, formatThaiDate } from "@/lib/cases/presentation";
import { ReportStudio } from "@/components/cases/report-studio";
import { AiRecommendationsPanel } from "@/components/cases/ai-recommendations";
import { addEvidenceAction, updateEvidenceAction, removeEvidenceAction, editEvidenceAction, updateScreeningAction } from "@/app/cases/actions";
import type { CaseActor, ComplaintCase } from "@/types/case";

type WorkspaceTab = "overview" | "screening" | "investigation" | "report" | "followup" | "audit";

interface CaseWorkspaceProps { complaint: ComplaintCase; actor: CaseActor; initialTab?: WorkspaceTab; }

const tabs: Array<{ id: WorkspaceTab; label: string; icon: typeof ClipboardCheck }> = [
  { id: "overview", label: "ภาพรวมสำนวน", icon: History },
  { id: "screening", label: "กลั่นกรอง", icon: ClipboardCheck },
  { id: "investigation", label: "ตรวจสอบและหลักฐาน", icon: FileCheck2 },
  { id: "report", label: "Report Studio", icon: FilePenLine },
  { id: "audit", label: "ประวัติการเข้าถึง (Audit)", icon: History },
];

export function CaseWorkspace({ complaint, actor, initialTab = "overview" }: CaseWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  return (
    <section className="case-workspace">
      <nav className="workspace-tabs" aria-label="พื้นที่ทำงานสำนวน">
        {tabs.map((tab) => { const Icon = tab.icon; return <button type="button" className={activeTab === tab.id ? "active" : ""} aria-current={activeTab === tab.id ? "page" : undefined} onClick={() => setActiveTab(tab.id)} key={tab.id}><Icon size={17} />{tab.label}</button>; })}
        {complaint.report.status === "final" && complaint.report.outcome === "violation" && (
          <button type="button" className={activeTab === "followup" ? "active" : ""} aria-current={activeTab === "followup" ? "page" : undefined} onClick={() => setActiveTab("followup")}><SendToBack size={17} />ติดตามผล</button>
        )}
      </nav>

      {activeTab === "overview" && <Overview complaint={complaint} actor={actor} />}
      {activeTab === "screening" && <Screening complaint={complaint} onSaved={() => setActiveTab("investigation")} />}
      {activeTab === "investigation" && <Investigation complaint={complaint} onSaved={() => setActiveTab("report")} />}
      {activeTab === "report" && <ReportStudio complaint={complaint} actor={actor} />}
      {activeTab === "followup" && <FollowUp complaint={complaint} />}
      {activeTab === "audit" && <AuditTimeline complaint={complaint} actor={actor} />}
    </section>
  );
}

function Overview({ complaint, actor }: { complaint: ComplaintCase; actor: CaseActor }) {
  const canEdit = complaint.assignedOfficer === actor.name || actor.demo;
  const isPendingApproval = ["supervisor_review", "committee_pending"].includes(complaint.status);

  return (
    <div className="workspace-grid">
      <div className="workspace-main-column">
        <section className="workspace-card case-facts-card">
          <div className="workspace-card-heading">
            <div><span className="case-eyebrow">CASE FACTS</span><h2>ข้อเท็จจริงต้นทาง</h2></div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {isPendingApproval && (
                <a href={`/cases/${complaint.id}/approval`} className="case-primary-button" style={{ textDecoration: "none", padding: "6px 12px", fontSize: "0.85rem" }}>
                  <ClipboardCheck size={14} /> พิจารณาอนุมัติ
                </a>
              )}
              {canEdit && (
                <a href={`/cases/${complaint.id}/edit`} className="edit-case-btn" style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85rem", color: "var(--accent-primary)", padding: "4px 8px", borderRadius: "4px", border: "1px solid var(--accent-primary)", textDecoration: "none" }}>
                  <FilePenLine size={14} /> แก้ไขข้อมูล
                </a>
              )}
              <Scale />
            </div>
          </div>
          <p className="fact-summary">{complaint.summary}</p>
          <dl className="case-fact-grid">
            <div><dt><MapPin size={14} /> พื้นที่</dt><dd>{complaint.location}</dd></div>
            <div><dt>ช่องทางรับเรื่อง</dt><dd>{complaint.channel}</dd></div>
            <div><dt>วันที่รับเรื่อง</dt><dd>{formatThaiDate(complaint.receivedAt, true)}</dd></div>
            <div><dt>ความประสงค์</dt><dd>{complaint.desiredOutcome}</dd></div>
          </dl>
        </section>
        <section className="workspace-card"><div className="workspace-card-heading"><div><span className="case-eyebrow">CASE TIMELINE</span><h2>ลำดับการดำเนินงาน</h2></div><History /></div><div className="case-timeline">{complaint.timeline.map((event) => <article key={event.id}><span className={`timeline-marker type-${event.type}`} /><div><time>{formatThaiDate(event.occurredAt, true)}</time><h3>{event.title}</h3><p>{event.description}</p><small>{event.actor}</small></div></article>)}{!complaint.timeline.length && <p className="workspace-empty-text">ยังไม่มีเหตุการณ์เพิ่มเติมในสำนวน</p>}</div></section>
      </div>
      <aside className="workspace-side-column">
        <section className="workspace-card"><div className="workspace-card-heading compact"><div><span className="case-eyebrow">DEADLINES</span><h2>กรอบเวลา</h2></div><CalendarClock /></div><div className="deadline-list">{complaint.deadlines.map((deadline) => <article className={`deadline-card ${deadline.status}`} key={deadline.id}><span>{deadlineText(deadline.dueAt)}</span><h3>{deadline.label}</h3><time>{formatThaiDate(deadline.dueAt, true)}</time><small>{deadline.legalBasis} · {deadline.owner}</small></article>)}{!complaint.deadlines.length && <p className="workspace-empty-text">ไม่มีกำหนดงานที่เปิดอยู่</p>}</div></section>
        <section className="workspace-card"><div className="workspace-card-heading compact"><div><span className="case-eyebrow">PARTIES</span><h2>บุคคลและหน่วยงาน</h2></div><UsersRound /></div><div className="party-list">{complaint.parties.map((party) => <article key={party.id}><span className="party-icon"><UserRoundCheck size={16} /></span><div><small>{party.role}</small><b>{party.displayName}</b>{party.organization && <span>{party.organization}</span>}{party.protectedIdentity && <em>ปกปิดตัวตน</em>}</div></article>)}</div></section>
      </aside>
    </div>
  );
}

function Screening({ complaint, onSaved }: { complaint: ComplaintCase; onSaved?: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [factsComplete, setFactsComplete] = useState(complaint.screening.factsComplete);
  const [requestClear, setRequestClear] = useState(complaint.screening.requestClear);
  const [withinMandate, setWithinMandate] = useState(complaint.screening.withinMandate);
  const [sufficientBasis, setSufficientBasis] = useState(complaint.screening.sufficientBasis);
  const [officerOpinion, setOfficerOpinion] = useState(complaint.screening.officerOpinion);
  const [legalBasis, setLegalBasis] = useState(complaint.screening.legalBasis);
  const [allegations, setAllegations] = useState(complaint.allegations.join("\\n"));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      updateScreeningAction(complaint.id, {
        factsComplete, requestClear, withinMandate, sufficientBasis, officerOpinion, legalBasis
      }, allegations.split("\\n").filter(a => a.trim().length > 0));
      if (onSaved) onSaved();
    });
  };

  const applyAi = () => {
    setFactsComplete(true);
    setRequestClear(true);
    setWithinMandate(true);
    setSufficientBasis(true);
    setOfficerOpinion("รับพิจารณาเป็นเรื่องร้องเรียน เนื่องจากมีมูลความจริงและเป็นไปตามอำนาจหน้าที่");
    setLegalBasis("มาตรา 22 พ.ร.ป. ว่าด้วยคณะกรรมการสิทธิมนุษยชนแห่งชาติ พ.ศ. 2560");
    if (!allegations) setAllegations("สิทธิในกระบวนการยุติธรรม - การเข้าถึงกระบวนการยุติธรรม");
  };

  return (
    <div className="workspace-grid screening-workspace">
      <div className="workspace-main-column">
        <form onSubmit={handleSave}>
          <section className="workspace-card">
            <div className="workspace-card-heading">
              <div><span className="case-eyebrow">COMPLETENESS & BASIS</span><h2>รายการตรวจกลั่นกรอง</h2></div>
              <ClipboardCheck />
            </div>
            
            <div className="screening-checks" style={{ display: "grid", gap: "10px", marginTop: "16px", gridTemplateColumns: "1fr 1fr" }}>
              <label className="check-field"><input type="checkbox" checked={factsComplete} onChange={(e) => setFactsComplete(e.target.checked)} /><span><b>ข้อเท็จจริงครบถ้วนและชัดเจน</b></span></label>
              <label className="check-field"><input type="checkbox" checked={requestClear} onChange={(e) => setRequestClear(e.target.checked)} /><span><b>ความประสงค์ระบุชัดเจน</b></span></label>
              <label className="check-field"><input type="checkbox" checked={withinMandate} onChange={(e) => setWithinMandate(e.target.checked)} /><span><b>อยู่ในหน้าที่และอำนาจ</b></span></label>
              <label className="check-field"><input type="checkbox" checked={sufficientBasis} onChange={(e) => setSufficientBasis(e.target.checked)} /><span><b>มีมูลเบื้องต้นเพียงพอ</b></span></label>
            </div>
            
            <div className="screening-opinion" style={{ marginTop: "24px" }}>
              <label className="full-field"><b>ความเห็นเจ้าหน้าที่</b>
                <textarea rows={4} value={officerOpinion} onChange={(e) => setOfficerOpinion(e.target.value)} style={{ width: "100%", marginTop: "8px" }} />
              </label>
              <label className="full-field" style={{ marginTop: "12px" }}><b>ฐานระเบียบ/กฎหมาย</b>
                <input value={legalBasis} onChange={(e) => setLegalBasis(e.target.value)} style={{ width: "100%", marginTop: "8px" }} />
              </label>
            </div>
          </section>

          <section className="workspace-card" style={{ marginTop: "20px" }}>
            <div className="workspace-card-heading">
              <div><span className="case-eyebrow">ALLEGATIONS</span><h2>ข้อกล่าวอ้างที่ต้องพิจารณา</h2></div>
              <Scale />
            </div>
            <label className="full-field" style={{ marginTop: "16px" }}>
              <textarea rows={4} value={allegations} onChange={(e) => setAllegations(e.target.value)} placeholder="พิมพ์ข้อกล่าวอ้าง 1 รายการต่อ 1 บรรทัด" style={{ width: "100%" }} />
            </label>
            
            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button type="submit" className="case-primary-button" disabled={isPending}>
                {isPending ? "กำลังบันทึก..." : "บันทึกผลกลั่นกรอง"}
              </button>
              <button type="button" className="case-secondary-button" onClick={applyAi} disabled={isPending}>
                ✨ ดึงข้อเสนอจาก AI
              </button>
            </div>
          </section>
        </form>
      </div>
      <aside className="workspace-side-column">
        <AiRecommendationsPanel complaintId={complaint.id} />
        
        <section className="workspace-card screening-guardrail" style={{ marginTop: "1rem" }}>
          <ShieldAlert />
          <h2>ขอบเขต AI ในขั้นกลั่นกรอง</h2>
          <p>AI ช่วยตรวจรายการข้อมูลที่ขาดและเสนอประเด็นสิทธิได้ แต่ห้ามตัดสินว่ารับหรือไม่รับคำร้อง และห้ามเปลี่ยนสถานะเอง</p>
          <ul><li>ข้อเสนอ AI ต้องมีหลักฐานจากคลัง</li><li>เจ้าหน้าที่ต้องยืนยันทุกประเด็น</li><li>มติสำคัญต้องมาจากผู้มีอำนาจ</li></ul>
        </section>
      </aside>
    </div>
  );
}

function Investigation({ complaint, onSaved }: { complaint: ComplaintCase; onSaved?: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEvidenceId, setEditingEvidenceId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  
  const editingEvidence = editingEvidenceId ? complaint.evidence.find((e) => e.id === editingEvidenceId) : null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    const title = formData.get("title") as string;
    const type = formData.get("type") as "document" | "statement" | "image" | "audio" | "video" | "digital";
    const source = formData.get("source") as string;
    const attachment = formData.get("attachment") as File;
    const hasFile = attachment && attachment.size > 0;
    
    const finalTitle = hasFile ? `${title} 📎` : title;

    const selectedSupports = formData.getAll("supports") as string[];
    const supports = selectedSupports.length > 0 ? selectedSupports : ["สนับสนุนข้อกล่าวหาทั่วไป"];
    
    startTransition(() => {
      if (editingEvidenceId) {
        // Remove attachment emoji if not replaced, or add it if replaced
        const titleWithoutEmoji = title.replace(" 📎", "");
        let titleToSave = hasFile ? `${titleWithoutEmoji} 📎` : titleWithoutEmoji;
        if (!hasFile && editingEvidence?.title.includes(" 📎")) {
          titleToSave = `${titleWithoutEmoji} 📎`;
        }
        editEvidenceAction(complaint.id, editingEvidenceId, { title: titleToSave, type, source, supports });
      } else {
        addEvidenceAction(complaint.id, { title: finalTitle, type, source, supports });
      }
      setShowAddForm(false);
      setEditingEvidenceId(null);
    });
  };

  const handleStatusChange = (evidenceId: string, status: "pending" | "verified" | "disputed") => {
    startTransition(() => {
      updateEvidenceAction(complaint.id, evidenceId, status);
    });
  };

  const handleDeleteEvidence = (evidenceId: string) => {
    if (!window.confirm("คุณต้องการลบพยานหลักฐานนี้ใช่หรือไม่?")) return;
    startTransition(() => {
      removeEvidenceAction(complaint.id, evidenceId);
    });
  };

  return (
    <div className="workspace-stack">
      <section className="workspace-card">
        <div className="workspace-card-heading">
          <div><span className="case-eyebrow">EVIDENCE MATRIX</span><h2>พยานหลักฐานกับประเด็นตรวจสอบ</h2></div>
          <button type="button" onClick={() => { setEditingEvidenceId(null); setShowAddForm(!showAddForm); }} className="case-primary-button" style={{ padding: "8px 12px", fontSize: "11px" }}>
            <Plus size={14} /> นำเข้าข้อมูล
          </button>
        </div>
        
        {(showAddForm || editingEvidenceId) && (
          <form key={editingEvidenceId || "new"} ref={formRef} onSubmit={handleAdd} className="case-form-section" style={{ marginBottom: "20px", background: "var(--paper)", border: "1px dashed var(--teal)", padding: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 150px 1fr", gap: "10px", marginBottom: "12px" }}>
              <label><b>ชื่อหลักฐาน</b><input name="title" required defaultValue={editingEvidence ? editingEvidence.title.replace(" 📎", "") : ""} placeholder="เช่น สำเนาบัตรฯ, ภาพถ่ายที่เกิดเหตุ" className="full-field" /></label>
              <label><b>ประเภท</b>
                <select name="type" defaultValue={editingEvidence ? editingEvidence.type : "document"} className="full-field">
                  <option value="document">เอกสาร</option>
                  <option value="statement">พยานบุคคล (ถ้อยคำ)</option>
                  <option value="image">ภาพถ่าย</option>
                  <option value="video">วิดีโอ</option>
                  <option value="digital">ข้อมูลอิเล็กทรอนิกส์</option>
                </select>
              </label>
              <label><b>แหล่งที่มา</b><input name="source" required defaultValue={editingEvidence?.source || ""} placeholder="เช่น ผู้ร้องส่งให้, ขอจากหน่วยงาน X" className="full-field" /></label>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label><b>ประเด็นที่รองรับ (ข้อกล่าวอ้าง)</b></label>
              <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
                {complaint.allegations.map((allegation, i) => (
                  <label key={i} className="check-field" style={{ fontSize: "12px" }}>
                    <input type="checkbox" name="supports" value={allegation} defaultChecked={editingEvidence ? editingEvidence.supports.includes(allegation) : false} />
                    <span>{allegation}</span>
                  </label>
                ))}
                {complaint.allegations.length === 0 && <small style={{ color: "var(--muted)" }}>ไม่มีข้อกล่าวอ้างที่ระบุไว้ในขั้นตอนกลั่นกรอง</small>}
              </div>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label><b>ไฟล์แนบ (พยานหลักฐาน)</b>
                <input type="file" name="attachment" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4,.mp3" className="full-field" style={{ background: "#fff", padding: "8px", border: "1px dashed #cbd5e1" }} />
              </label>
              <small style={{ display: "block", color: "var(--muted)", fontSize: "10px", marginTop: "4px" }}>รองรับไฟล์ PDF, Word, รูปภาพ, เสียง และวิดีโอ (ไฟล์จะถูกเก็บในโซนปลอดภัย ไม่เข้า Public RAG)</small>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => { setShowAddForm(false); setEditingEvidenceId(null); }} className="case-secondary-button">ยกเลิก</button>
              <button type="submit" disabled={isPending} className="case-primary-button">{isPending ? "กำลังบันทึก..." : (editingEvidenceId ? "บันทึกการแก้ไข" : "เพิ่มพยานหลักฐาน")}</button>
            </div>
          </form>
        )}

        <div className="evidence-table-wrap" style={{ opacity: isPending ? 0.6 : 1, transition: "opacity 0.2s" }}>
          <table className="evidence-table">
            <thead>
              <tr>
                <th>รหัส</th>
                <th>รายการหลักฐาน</th>
                <th>แหล่งที่มา</th>
                <th>ประเด็นที่รองรับ</th>
                <th>การรับรอง</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {complaint.evidence.map((item) => (
                <tr key={item.id}>
                  <td><b>{item.code}</b><small>{item.type}</small></td>
                  <td>{item.title}<small>{formatThaiDate(item.obtainedAt)}</small></td>
                  <td>{item.source}</td>
                  <td><div className="evidence-supports">{item.supports.map((support) => <span key={support}>{support}</span>)}</div></td>
                  <td>
                    <select 
                      value={item.verification} 
                      onChange={(e) => handleStatusChange(item.id, e.target.value as ComplaintCase["evidence"][number]["verification"])}
                      disabled={isPending}
                      className={`verification-${item.verification}`}
                      style={{ border: "1px solid transparent", cursor: "pointer", outline: "none", width: "100%", padding: "4px 8px" }}
                    >
                      <option value="pending" className="verification-pending">รอตรวจ</option>
                      <option value="verified" className="verification-verified">ตรวจแล้ว</option>
                      <option value="disputed" className="verification-disputed">มีข้อโต้แย้ง</option>
                    </select>
                  </td>
                  <td style={{ display: "flex", gap: "8px" }}>
                    <button type="button" onClick={() => { setEditingEvidenceId(item.id); setShowAddForm(false); }} disabled={isPending} style={{ color: "var(--muted)", background: "transparent", border: "none", cursor: "pointer", fontSize: "14px" }} title="แก้ไขพยานหลักฐาน">
                      <Pencil size={16} />
                    </button>
                    <button type="button" onClick={() => handleDeleteEvidence(item.id)} disabled={isPending} style={{ color: "var(--destructive)", background: "transparent", border: "none", cursor: "pointer", fontSize: "14px" }} title="ลบพยานหลักฐาน">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {complaint.evidence.length === 0 && <p className="workspace-empty-text">ยังไม่มีพยานหลักฐานในสำนวน</p>}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--line)", alignItems: "center" }}>
          <div>
            <a href={`/cases/${complaint.id}/evidence`} className="case-secondary-button" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <FileCheck2 size={16} /> เปิดกระดานพยานหลักฐาน (Evidence Board)
            </a>
          </div>
          <button type="button" className="case-primary-button" onClick={onSaved}>
            บันทึกและไปขั้นตอนถัดไป (Report Studio)
          </button>
        </div>
      </section>
      <div className="investigation-summary-grid">
        <section className="workspace-card"><span className="case-eyebrow">INVESTIGATION ISSUES</span><h2>ประเด็นตรวจสอบ</h2><ol className="allegation-list">{complaint.allegations.map((allegation) => <li key={allegation}>{allegation}</li>)}</ol></section>
        <section className="workspace-card evidence-safety"><LockKeyhole /><div><h2>หลักฐานไม่เข้า Public RAG</h2><p>ไฟล์สำนวนและ embedding ต้องอยู่ในพื้นที่จำกัดแยกจาก documents/document_sections รายงานจะเข้าสู่คลังได้เมื่อเห็นชอบ ปกปิดข้อมูล และอนุมัติเผยแพร่แล้วเท่านั้น</p></div></section>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
        <button type="button" className="case-primary-button" onClick={() => onSaved && onSaved()}>
          ดำเนินการขั้นถัดไป (ร่างรายงาน)
        </button>
      </div>
    </div>
  );
}

function FollowUp({ complaint }: { complaint: ComplaintCase }) {
  return (
    <div className="workspace-stack">
      <section className="workspace-card">
        <div className="workspace-card-heading">
          <div><span className="case-eyebrow">POST-REPORT TRACKING</span><h2>การติดตามผลตามข้อเสนอแนะ</h2></div>
          <SendToBack />
        </div>
        <div className="evidence-table-wrap">
          <table className="evidence-table">
            <thead>
              <tr>
                <th>ข้อเสนอแนะ</th>
                <th>หน่วยงานที่รับผิดชอบ</th>
                <th>ครบกำหนด</th>
                <th>สถานะ</th>
                <th>ความคืบหน้า</th>
              </tr>
            </thead>
            <tbody>
              {complaint.followUps.map((fu) => (
                <tr key={fu.id}>
                  <td><b>{fu.recommendationText}</b></td>
                  <td>{fu.agencyName}</td>
                  <td>{formatThaiDate(fu.dueDate)}</td>
                  <td>
                    <span className={`case-status status-${fu.status === 'implemented' ? 'closed' : fu.status === 'partially_implemented' ? 'accepted' : fu.status === 'ignored' ? 'not_accepted' : 'received'}`}>
                      {fu.status === 'implemented' ? 'ปฏิบัติตามแล้ว' : fu.status === 'partially_implemented' ? 'ปฏิบัติบางส่วน' : fu.status === 'ignored' ? 'เพิกเฉย' : 'รอดำเนินการ'}
                    </span>
                  </td>
                  <td>{fu.notes}<small>อัปเดต: {formatThaiDate(fu.updatedAt)}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!complaint.followUps.length && <p className="workspace-empty-text">ยังไม่มีรายการติดตามผลในระบบ</p>}
        </div>
      </section>
    </div>
  );
}

function AuditTimeline({ complaint, actor }: { complaint: ComplaintCase; actor: CaseActor }) {
  const events = [...(complaint.timeline || [])].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  const eventLabels: Record<ComplaintCase["timeline"][number]["type"], string> = {
    intake: "รับเรื่อง",
    screening: "กลั่นกรอง",
    investigation: "ตรวจสอบ",
    evidence: "พยานหลักฐาน",
    report: "รายงาน",
    decision: "คำวินิจฉัย",
    ai: "ระบบ AI",
  };
  const canManage = actor.demo || complaint.assignedOfficer === actor.name;

  return (
    <div className="workspace-grid audit-workspace">
      <div className="workspace-main-column">
        <section className="workspace-card audit-card">
          <div className="workspace-card-heading audit-card-heading">
            <div>
              <span className="case-eyebrow">AUDIT TRAIL</span>
              <h2>ประวัติการเข้าถึงและการเปลี่ยนแปลง</h2>
              <p>บันทึกกิจกรรมในสำนวน เรียงจากรายการล่าสุด</p>
            </div>
            <span className="audit-count">{events.length} รายการ</span>
          </div>
          <div className="audit-timeline" aria-label="บันทึกกิจกรรมในสำนวน">
            {events.map((event) => {
              const label = eventLabels[event.type];
              return (
              <article className="timeline-event" key={event.id}>
                <time className="audit-time">{formatThaiDate(event.occurredAt, true)}</time>
                <span className={`audit-marker type-${event.type}`} aria-hidden="true" />
                <div className="timeline-content">
                  <div className="audit-event-heading">
                    <span className={`audit-event-type type-${event.type}`}>{label}</span>
                    <h3>{event.title}</h3>
                  </div>
                  <p>{event.description}</p>
                  <div className="timeline-meta">
                    <UserRoundCheck size={14} />
                    <span>ผู้ดำเนินการ: {event.actor}</span>
                  </div>
                </div>
              </article>
              );
            })}
            {!events.length && <p className="workspace-empty-text">ยังไม่มีประวัติกิจกรรมในสำนวนนี้</p>}
          </div>
        </section>
      </div>
      <aside className="workspace-side-column">
        <section className="workspace-card audit-security-card">
          <div className="workspace-card-heading compact">
            <div>
              <span className="case-eyebrow">ACCESS CONTEXT</span>
              <h2>สิทธิ์และการคุ้มครองข้อมูล</h2>
            </div>
            <LockKeyhole size={20} />
          </div>
          <p className="audit-security-intro">ข้อมูลในสำนวนนี้ถูกจำกัดตามบทบาทผู้ใช้งานและระดับชั้นข้อมูลของคดี</p>
          <dl className="audit-security-list">
            <div>
              <dt>บทบาทปัจจุบัน</dt>
              <dd>{actor.role}</dd>
            </div>
            <div>
              <dt>สิทธิ์ในสำนวน</dt>
              <dd className={canManage ? "is-granted" : "is-readonly"}>{canManage ? "จัดการสำนวนได้" : "อ่านข้อมูลได้เท่านั้น"}</dd>
            </div>
            <div>
              <dt>ชั้นข้อมูล</dt>
              <dd>{complaint.classification}</dd>
            </div>
          </dl>
          <p className="audit-security-note"><LockKeyhole size={15} /> กิจกรรมสำคัญในสำนวนควรตรวจสอบย้อนกลับได้</p>
        </section>
      </aside>
    </div>
  );
}

