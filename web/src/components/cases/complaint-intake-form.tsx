"use client";

import { FormEvent, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, FileText, LockKeyhole, Save, UserRound, UsersRound, UploadCloud, FileSignature } from "lucide-react";
import type { ComplaintCreateInput, ComplaintCase } from "@/types/case";
import { IntakeAIAnalyzer } from "./intake-ai";

const initialForm: ComplaintCreateInput = {
  channel: "ระบบอิเล็กทรอนิกส์",
  title: "",
  facts: "",
  desiredOutcome: "",
  complainantName: "",
  respondentName: "",
  location: "",
  language: "th",
  rightsIssue: "",
  priority: "normal",
  classification: "RESTRICTED",
  protectIdentity: false,
  officerOpinion: "",
};

export function ComplaintIntakeForm({ initialData }: { initialData?: ComplaintCase }) {
  const router = useRouter();
  const [form, setForm] = useState<ComplaintCreateInput>(() => {
    if (!initialData) return initialForm;
    return {
      channel: initialData.channel,
      title: initialData.title,
      facts: initialData.summary, // map summary to facts
      desiredOutcome: initialData.desiredOutcome || "",
      complainantName: initialData.parties.find(p => p.role === "complainant")?.displayName || "",
      respondentName: initialData.parties.find(p => p.role === "respondent")?.displayName || "",
      location: initialData.location || "",
      language: initialData.language,
      rightsIssue: initialData.rightsIssues?.[0] || "",
      priority: initialData.priority,
      classification: initialData.classification,
      protectIdentity: initialData.parties.find(p => p.role === "complainant")?.protectedIdentity || false,
      officerOpinion: initialData.screening?.officerOpinion || "",
    };
  });
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [error, setError] = useState("");
  const [approvedAiKeys, setApprovedAiKeys] = useState<string[]>([]);
  
  const handleApproveAi = (key: string, content: string) => {
    setApprovedAiKeys(prev => [...prev, key]);
    
    // Auto-fill form fields based on AI output
    if (key === "rights") {
      setForm(curr => ({ ...curr, rightsIssue: content }));
    } else {
      // Append other recommendations to officer opinion
      setForm(curr => {
        const prefix = curr.officerOpinion ? curr.officerOpinion + "\n\n" : "";
        return { ...curr, officerOpinion: prefix + `[AI Recommendation - ${key}]\n${content}` };
      });
    }
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof ComplaintCreateInput>(key: K, value: ComplaintCreateInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const requiredValues = [form.title, form.facts, form.desiredOutcome, form.complainantName, form.respondentName, form.location, form.rightsIssue];
  const completed = requiredValues.filter((value) => value.trim()).length;
  const progress = Math.round((completed / requiredValues.length) * 100);

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setOcrLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      // 1. Upload file to Supabase Storage
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "การอัปโหลดไฟล์ล้มเหลว");
      
      // 2. Extract data via AI
      // For this demo, we simulate OCR text because we don't have a real OCR API hooked up before the LLM
      const fakeContent = `ผู้ร้อง: นายทดสอบ ระบบ\nเบอร์โทร: 0812345678\nเกิดเหตุเมื่อ: 1 มกราคม 2569\nสถานที่: กรุงเทพมหานคร\nถูกร้อง: เจ้าหน้าที่ตำรวจ\nพฤติการณ์: เจ้าหน้าที่ไม่รับแจ้งความและพูดจาข่มขู่\nความประสงค์: ขอให้ตรวจสอบการปฏิบัติหน้าที่`;
      
      const extractRes = await fetch("/api/ai/extract", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: fakeContent, sourceId: uploadData.storage_path }) 
      });
      const extractData = await extractRes.json();
      
      if (!extractRes.ok) throw new Error(extractData.error || "การสกัดข้อมูลด้วย AI ล้มเหลว");
      
      const ai = extractData.extractedData;
      setForm((curr) => ({
        ...curr,
        title: curr.title || (ai.allegationSummary ? ai.allegationSummary.substring(0, 50) + "..." : ""),
        facts: curr.facts || ai.allegationSummary || "",
        desiredOutcome: curr.desiredOutcome || ai.desiredOutcome || "",
        complainantName: curr.complainantName || ai.complainantName || "",
        respondentName: curr.respondentName || ai.respondentName || "",
        location: curr.location || ai.incidentLocation || "",
        rightsIssue: curr.rightsIssue || (ai.rightsIssues && ai.rightsIssues.length > 0 ? ai.rightsIssues[0] : ""),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการประมวลผลไฟล์");
    } finally {
      setOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acknowledged) return setError("กรุณายืนยันการตรวจชั้นข้อมูลและความถูกต้องก่อนบันทึก");
    setLoading(true);
    setError("");
    try {
      const isEdit = !!initialData;
      const url = isEdit ? `/api/cases/${initialData.id}` : "/api/cases";
      const method = isEdit ? "PUT" : "POST";
      const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "บันทึกเรื่องไม่สำเร็จ");
      router.push(`/cases/${payload.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกเรื่องไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="intake-container" onSubmit={submit}>
      <div className="intake-ai-banner" style={{ gridColumn: "1 / -1" }}>
        <IntakeAIAnalyzer 
          facts={form.facts} 
          title={form.title} 
          desiredOutcome={form.desiredOutcome} 
          onApprove={handleApproveAi}
          approvedKeys={approvedAiKeys}
        />
      </div>

      <div className="intake-main">

        <section className="case-form-section">
          <header>
            <span className="form-step">01</span>
            <div><h2>ข้อมูลต้นทาง</h2><p>ช่องทาง ภาษา และลักษณะความเร่งด่วน</p></div>
            <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
              <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} ref={fileInputRef} onChange={handleFileUpload} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={ocrLoading} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg-subtle)", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500 }}>
                <UploadCloud size={16} /> {ocrLoading ? "กำลังวิเคราะห์ด้วย AI..." : "นำเข้าข้อมูลจากไฟล์"}
              </button>
            </div>
          </header>
          <div className="case-form-grid three">
            <label>ช่องทางรับเรื่อง<select value={form.channel} onChange={(event) => set("channel", event.target.value)}><option>ยื่นต่อสำนักงาน</option><option>ยื่นต่อกรรมการ</option><option>ไปรษณีย์</option><option>ระบบอิเล็กทรอนิกส์</option><option>วาจา</option><option>โทรศัพท์</option><option>หน่วยงานของรัฐส่งมา</option><option>คณะกรรมการหยิบยก</option></select></label>
            <label>ภาษา<select value={form.language} onChange={(event) => set("language", event.target.value as ComplaintCreateInput["language"])}><option value="th">ภาษาไทย</option><option value="en">English</option><option value="th-en">ไทย–อังกฤษ</option></select></label>
            <label>ระดับความเร่งด่วน<select value={form.priority} onChange={(event) => set("priority", event.target.value as ComplaintCreateInput["priority"])}><option value="normal">ปกติ</option><option value="urgent">เร่งด่วน</option><option value="critical">วิกฤต/ต้องคุ้มครองทันที</option></select></label>
          </div>
          <label className="full-field">ชื่อเรื่อง<input required maxLength={220} value={form.title} onChange={(event) => set("title", event.target.value)} placeholder="สรุปให้เห็นประเด็นโดยไม่ใส่ข้อมูลส่วนบุคคลเกินจำเป็น" /></label>
        </section>

        <section className="case-form-section">
          <header><span className="form-step">02</span><div><h2>บุคคลและหน่วยงานที่เกี่ยวข้อง</h2><p>แยกผู้ร้อง ผู้เสียหาย และผู้ถูกร้องให้ชัดเจน</p></div><UsersRound /></header>
          <div className="case-form-grid two">
            <label>ชื่อผู้ร้อง<input required value={form.complainantName} onChange={(event) => set("complainantName", event.target.value)} placeholder="บุคคลหรือผู้ทำการแทน" /></label>
            <label>ผู้ถูกร้อง/หน่วยงาน<input required value={form.respondentName} onChange={(event) => set("respondentName", event.target.value)} /></label>
            <label>พื้นที่เกิดเหตุ<input required value={form.location} onChange={(event) => set("location", event.target.value)} placeholder="จังหวัด/พื้นที่" /></label>
            <label>ประเด็นสิทธิเบื้องต้น<input required value={form.rightsIssue} onChange={(event) => set("rightsIssue", event.target.value)} placeholder="เจ้าหน้าที่เป็นผู้ยืนยันภายหลัง" /></label>
          </div>
          <label className="check-field"><input type="checkbox" checked={form.protectIdentity} onChange={(event) => set("protectIdentity", event.target.checked)} /><span><b>ปกปิดชื่อผู้ร้องในหน้าจอปฏิบัติงานทั่วไป</b><small>ใช้เมื่อการเปิดเผยอาจกระทบความปลอดภัย ความเป็นส่วนตัว หรือการดำรงชีพ</small></span></label>
        </section>

        <section className="case-form-section">
          <header><span className="form-step">03</span><div><h2>ข้อเท็จจริงและความประสงค์</h2><p>บันทึกตามถ้อยคำต้นทาง แยกจากความเห็นของเจ้าหน้าที่</p></div><UserRound /></header>
          <label className="full-field">ข้อเท็จจริงและพฤติการณ์<textarea required rows={8} maxLength={12000} value={form.facts} onChange={(event) => set("facts", event.target.value)} placeholder="เกิดอะไรขึ้น เมื่อใด ที่ไหน ใครเกี่ยวข้อง และมีผลกระทบอย่างไร" /><small>{form.facts.length.toLocaleString("th-TH")} / 12,000 ตัวอักษร</small></label>
          <label className="full-field">ความประสงค์ให้ กสม. ดำเนินการ<textarea required rows={4} maxLength={4000} value={form.desiredOutcome} onChange={(event) => set("desiredOutcome", event.target.value)} /></label>
        </section>

        <section className="case-form-section privacy-section">
          <header><span className="form-step"><LockKeyhole size={17} /></span><div><h2>ชั้นข้อมูลและการยืนยัน</h2><p>ข้อมูลสำนวนไม่ถูกส่งเข้าสู่คลังความรู้สาธารณะ</p></div></header>
          <div className="classification-options">
            <label className={form.classification === "RESTRICTED" ? "selected" : ""}><input type="radio" name="classification" checked={form.classification === "RESTRICTED"} onChange={() => set("classification", "RESTRICTED")} /><span><b>RESTRICTED · ข้อมูลจำกัด</b><small>เรื่องร้องเรียน คู่กรณี และเอกสารภายในทั่วไป</small></span></label>
            <label className={form.classification === "HIGHLY_SENSITIVE" ? "selected" : ""}><input type="radio" name="classification" checked={form.classification === "HIGHLY_SENSITIVE"} onChange={() => set("classification", "HIGHLY_SENSITIVE")} /><span><b>HIGHLY SENSITIVE · อ่อนไหวสูง</b><small>เด็ก สุขภาพ ความรุนแรงทางเพศ พยานเสี่ยงภัย หรือข้อมูลชีวมิติ</small></span></label>
          </div>
          <label className="check-field confirm"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span><b>ตรวจข้อมูลต้นทางและชั้นข้อมูลแล้ว</b><small>การบันทึกจะสร้าง audit event และกรอบเวลาเสนอผลกลั่นกรอง 15 วัน</small></span></label>
        </section>
      </div>

      <aside className="intake-sidebar-group">
        <div className="intake-sidebar">
          <section className="intake-progress"><div className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><span>{progress}%</span></div><div><b>ความครบถ้วนเบื้องต้น</b><p>{completed} จาก {requiredValues.length} รายการจำเป็น</p></div></section>
          <section className="intake-checklist"><h3>ตรวจข้อมูลขั้นต่ำ</h3>{["ชื่อและข้อมูลผู้ร้อง", "ข้อเท็จจริงและพฤติการณ์", "ความประสงค์", "ผู้ถูกร้อง/หน่วยงาน", "พื้นที่และประเด็นสิทธิ"].map((label, index) => <div className={requiredValues[index] ? "done" : ""} key={label}><span>{requiredValues[index] ? <Check size={13} /> : index + 1}</span>{label}</div>)}</section>
          
          {/* Officer Opinion (Auto-filled by AI) */}
          <section className="case-form-section" style={{ padding: 0, border: 'none', background: 'transparent' }}>
            <label className="full-field" style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <FileSignature size={16} /> <b>ความเห็นเสนอแนะเบื้องต้น (สรุปโดยเจ้าหน้าที่)</b>
              </div>
              <textarea 
                rows={6} 
                value={form.officerOpinion} 
                onChange={(event) => set("officerOpinion", event.target.value)} 
                placeholder="นำคำแนะนำจาก AI มาปรับแก้ หรือเขียนความเห็นเสนอว่าควรรับไว้ตรวจสอบหรือไม่ อย่างไร..." 
                style={{ background: 'var(--bg-subtle)' }}
              />
            </label>
          </section>

          <section className="deadline-preview"><CalendarPreview /><div><b>กรอบเวลาเริ่มต้น</b><p>15 วันนับแต่รับมอบหมาย หากต้องแสวงหาข้อเท็จจริงเพิ่มเติมให้บันทึกเหตุและใช้กรอบ 45 วัน</p></div></section>
          {error && <p className="case-form-error" role="alert">{error}</p>}
          <button type="submit" className="case-primary-button intake-submit" disabled={loading}><Save size={17} /> {loading ? "กำลังบันทึก..." : "บันทึกและเริ่มกลั่นกรอง"}<ChevronRight size={16} /></button>
          <small className="submit-note">ระบบไม่ตัดสินว่ารับหรือไม่รับคำร้องอัตโนมัติ</small>
        </div>
      </aside>
    </form>
  );
}

function CalendarPreview() {
  return <span className="calendar-preview"><b>15</b><small>วัน</small></span>;
}
