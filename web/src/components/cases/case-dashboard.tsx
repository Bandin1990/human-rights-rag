"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, CalendarClock, ClipboardCheck, FilePenLine, Plus, Search, ShieldCheck, Users, Trash2 } from "lucide-react";
import { complaintStatusLabels, deadlineText, formatThaiDate, priorityLabels } from "@/lib/cases/presentation";
import { deleteCaseAction } from "@/app/cases/actions";
import type { CaseActor, ComplaintCase } from "@/types/case";

interface CaseDashboardProps { cases: ComplaintCase[]; actor: CaseActor }

export function CaseDashboard({ cases, actor }: CaseDashboardProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [isPending, startTransition] = useTransition();

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (window.confirm("คุณต้องการลบเรื่องร้องเรียนนี้ใช่หรือไม่?")) {
      startTransition(() => {
        deleteCaseAction(id);
      });
    }
  };

  const isOfficer = ["intake_officer", "screening_officer", "case_officer", "report_screener"].includes(actor.role);
  const visibleCases = isOfficer
    ? cases.filter(c => c.assignedOfficer === actor.name)
    : cases;

  const normalized = query.trim().toLocaleLowerCase("th");
  const filtered = visibleCases.filter((item) =>
    (status === "all" || item.status === status) &&
    (!normalized || [item.referenceNo, item.title, item.assignedOfficer, ...item.rightsIssues].join(" ").toLocaleLowerCase("th").includes(normalized)),
  );
  const urgent = visibleCases.filter((item) => item.priority !== "normal" || item.deadlines.some((deadline) => deadline.status === "due_soon" || deadline.status === "overdue"));
  const reports = visibleCases.filter((item) => item.status === "report_drafting").length;
  const review = visibleCases.filter((item) => ["supervisor_review", "committee_pending"].includes(item.status)).length;

  return (
    <div className="case-container">
      <section className="case-dashboard-hero">
        <div>
          <span className="case-eyebrow">CASE MANAGEMENT · RAG CONNECTED</span>
          <h1>ศูนย์งานเรื่องร้องเรียน</h1>
          <p>ติดตามกรอบเวลา ตรวจพยานหลักฐาน และจัดทำรายงานโดยค้นแหล่งอ้างอิงจากคลังความรู้เดียวกัน</p>
        </div>
        <div className="case-hero-actions">
          <span className="actor-chip"><ShieldCheck size={16} /><span>{actor.name}<small>{actor.demo ? "โหมดสาธิต · " : ""}{actor.role}</small></span></span>
          {(actor.demo || actor.role === "commissioner" || actor.role === "system_admin" || actor.role === "supervisor") && (
            <Link href="/cases/dashboard" className="case-secondary-button">แดชบอร์ดผู้บริหาร</Link>
          )}
          <Link href="/cases/new" className="case-primary-button"><Plus size={17} /> รับเรื่องใหม่</Link>
        </div>
      </section>

      <section className="case-metrics" aria-label="ภาพรวมงาน">
        <article><span className="metric-icon mint"><Users /></span><div><small>เรื่องที่เข้าถึงได้</small><b>{visibleCases.length}</b><span>ตามบทบาทและการมอบหมาย</span></div></article>
        <article><span className="metric-icon amber"><CalendarClock /></span><div><small>ใกล้/เกินกำหนด</small><b>{urgent.length}</b><span>ต้องตรวจเหตุและจัดลำดับงาน</span></div></article>
        <article><span className="metric-icon blue"><ClipboardCheck /></span><div><small>รอตรวจหรือมติ</small><b>{review}</b><span>ผู้บังคับบัญชาและคณะกรรมการ</span></div></article>
        <article><span className="metric-icon violet"><FilePenLine /></span><div><small>กำลังทำรายงาน</small><b>{reports}</b><span>ตรวจองค์ประกอบตามข้อ 43</span></div></article>
      </section>

      <div className="case-dashboard-grid">
        <section className="case-list-panel">
          <div className="case-panel-heading"><div><span className="case-eyebrow">MY WORKSPACE</span><h2>รายการงานที่รับผิดชอบ</h2></div><span>{filtered.length} เรื่อง</span></div>
          <div className="case-toolbar">
            <label className="case-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นเลขรับเรื่อง ชื่อเรื่อง หรือประเด็นสิทธิ" /></label>
            <select aria-label="กรองสถานะ" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">ทุกสถานะ</option>
              <option value="awaiting_complainant">รอข้อมูลผู้ร้อง</option>
              <option value="supervisor_review">รอผู้บังคับบัญชา</option>
              <option value="committee_pending">รอคณะกรรมการ</option>
              <option value="report_drafting">จัดทำรายงาน</option>
            </select>
          </div>
          <div className="case-list">
            {filtered.map((item) => {
              const deadline = item.deadlines.find((entry) => entry.status !== "completed");
              return (
                <div className="case-list-row" key={item.id} style={{ paddingRight: "16px", gridTemplateColumns: "minmax(0,1fr) 150px 160px auto" }}>
                  <Link href={`/cases/${item.id}`} style={{ display: 'contents' }}>
                    <div className="case-row-main">
                      <div className="case-row-kicker"><span>{item.referenceNo}</span><span className={`priority-${item.priority}`}>{priorityLabels[item.priority]}</span>{item.vulnerableGroup && <span className="vulnerable-chip">กลุ่มเปราะบาง</span>}</div>
                      <h3>{item.title}</h3>
                      <div className="case-rights">{item.rightsIssues.map((issue) => <span key={issue}>{issue}</span>)}</div>
                    </div>
                    <div className="case-row-owner"><small>ผู้รับผิดชอบ</small><b>{item.assignedOfficer}</b><span>{formatThaiDate(item.receivedAt)}</span></div>
                    <div className="case-row-state"><span className={`case-status status-${item.status}`}>{complaintStatusLabels[item.status]}</span>{deadline && <small className={`deadline-${deadline.status}`}>{deadlineText(deadline.dueAt)}</small>}</div>
                  </Link>
                  <div className="case-row-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Link href={`/cases/${item.id}?tab=report`} className="case-action-btn" title="แก้ไข" onClick={(e) => e.stopPropagation()} style={{ color: "var(--teal)", padding: "4px" }}>
                      <FilePenLine size={16} />
                    </Link>
                    <button type="button" onClick={(e) => handleDelete(item.id, e)} disabled={isPending} className="case-action-btn" title="ลบ" style={{ color: "var(--destructive)", padding: "4px", background: "transparent", border: "none", cursor: "pointer", opacity: isPending ? 0.5 : 1 }}>
                      <Trash2 size={16} />
                    </button>
                    <ArrowRight className="case-row-arrow" size={18} />
                  </div>
                </div>
              );
            })}
            {!filtered.length && <div className="case-empty"><Search /><h3>ไม่พบรายการที่ตรงกับตัวกรอง</h3><button type="button" onClick={() => { setQuery(""); setStatus("all"); }}>ล้างตัวกรอง</button></div>}
          </div>
        </section>

        <aside className="case-focus-panel">
          <div className="focus-heading"><AlertTriangle size={18} /><div><span className="case-eyebrow">ACTION NEEDED</span><h2>งานที่ต้องเร่ง</h2></div></div>
          <div className="focus-list">
            {urgent.slice(0, 4).map((item) => {
              const deadline = item.deadlines[0];
              return <Link href={`/cases/${item.id}`} key={item.id}><span className={`focus-dot priority-${item.priority}`} /><div><b>{item.referenceNo}</b><p>{deadline?.label || item.title}</p><small>{deadline ? `${deadlineText(deadline.dueAt)} · ${deadline.legalBasis}` : complaintStatusLabels[item.status]}</small></div></Link>;
            })}
          </div>
          <div className="ai-policy-note"><ShieldCheck size={18} /><div><b>AI ไม่เปลี่ยนสถานะงาน</b><p>คำแนะนำและร่างเอกสารทุกชิ้นต้องมีเจ้าหน้าที่ตรวจ ยอมรับ แก้ไข หรือปฏิเสธ</p></div></div>
        </aside>
      </div>
    </div>
  );
}
