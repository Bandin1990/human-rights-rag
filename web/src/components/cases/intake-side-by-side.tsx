"use client";

import { useState } from "react";
import { ComplaintCase } from "@/types/case";
import { FileText, Save, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export function IntakeSideBySide({ complaint }: { complaint: ComplaintCase }) {
  const [saving, setSaving] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  
  // This is a mockup of the extracted data for Phase 1 testing
  const [extractedData, setExtractedData] = useState({
    title: { value: complaint.title || "", status: "accepted", confidence: 0.95, excerpt: "เรื่อง ขอร้องเรียนกรณีถูกละเมิดสิทธิ" },
    complainantName: { value: complaint.parties?.find(p => p.role === "complainant")?.displayName || "นายทดสอบ ระบบ", status: "generated", confidence: 0.98, excerpt: "ข้าพเจ้า นายทดสอบ ระบบ" },
    respondentName: { value: complaint.parties?.find(p => p.role === "respondent")?.displayName || "เจ้าหน้าที่ตำรวจ", status: "generated", confidence: 0.85, excerpt: "การปฏิบัติหน้าที่ของ เจ้าหน้าที่ตำรวจ" },
    location: { value: complaint.location || "กรุงเทพมหานคร", status: "generated", confidence: 0.90, excerpt: "เหตุเกิดที่ กรุงเทพมหานคร" },
    facts: { value: complaint.summary || "เจ้าหน้าที่ไม่รับแจ้งความและพูดจาข่มขู่", status: "generated", confidence: 0.88, excerpt: "พฤติการณ์: เจ้าหน้าที่ไม่รับแจ้งความและพูดจาข่มขู่" },
    desiredOutcome: { value: complaint.desiredOutcome || "ขอให้ตรวจสอบการปฏิบัติหน้าที่", status: "generated", confidence: 0.92, excerpt: "ความประสงค์: ขอให้ตรวจสอบการปฏิบัติหน้าที่" },
    rightsIssue: { value: complaint.rightsIssues?.[0] || "สิทธิในกระบวนการยุติธรรม", status: "generated", confidence: 0.80, excerpt: null },
  });

  const handleSave = async () => {
    setSaving(true);
    // Simulate save to extracted_fields and field_provenance
    setTimeout(() => {
      setSaving(false);
      alert("บันทึกข้อมูลเรียบร้อยแล้ว");
    }, 1000);
  };

  const handleAccept = (field: keyof typeof extractedData) => {
    setExtractedData(prev => ({
      ...prev,
      [field]: { ...prev[field], status: "accepted" }
    }));
  };

  const handleReject = (field: keyof typeof extractedData) => {
    setExtractedData(prev => ({
      ...prev,
      [field]: { ...prev[field], status: "rejected", value: "" }
    }));
  };

  const handleChange = (field: keyof typeof extractedData, newValue: string) => {
    setExtractedData(prev => ({
      ...prev,
      [field]: { ...prev[field], value: newValue, status: "edited" }
    }));
  };

  const renderField = (label: string, fieldKey: keyof typeof extractedData, type: "text" | "textarea" = "text") => {
    const field = extractedData[fieldKey];
    const isEditing = activeField === fieldKey;
    
    let statusColor = "#6b7280";
    let statusBg = "transparent";
    if (field.status === "accepted") { statusColor = "#059669"; statusBg = "#d1fae5"; }
    else if (field.status === "rejected") { statusColor = "#dc2626"; statusBg = "#fee2e2"; }
    else if (field.status === "edited") { statusColor = "#d97706"; statusBg = "#fef3c7"; }

    return (
      <div 
        className="case-field" 
        style={{ 
          padding: "12px", 
          backgroundColor: isEditing ? "#f8fafc" : "white", 
          border: isEditing ? "1px solid var(--teal)" : "1px solid #e2e8f0",
          borderRadius: "8px",
          transition: "all 0.2s"
        }}
        onClick={() => setActiveField(fieldKey)}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
          <label style={{ margin: 0, fontWeight: 600 }}>{label}</label>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {field.status === "generated" && field.confidence && (
              <span style={{ fontSize: "12px", color: "#6b7280" }}>
                AI มั่นใจ {Math.round(field.confidence * 100)}%
              </span>
            )}
            {field.status !== "generated" && (
              <span style={{ fontSize: "11px", padding: "2px 6px", borderRadius: "12px", backgroundColor: statusBg, color: statusColor, fontWeight: 600, textTransform: "uppercase" }}>
                {field.status}
              </span>
            )}
          </div>
        </div>

        {type === "text" ? (
          <input 
            type="text" 
            value={field.value} 
            onChange={e => handleChange(fieldKey, e.target.value)}
            className="case-input"
            style={{ borderColor: field.status === "rejected" ? "#fca5a5" : "" }}
          />
        ) : (
          <textarea 
            value={field.value} 
            onChange={e => handleChange(fieldKey, e.target.value)}
            className="case-input" 
            rows={3}
            style={{ borderColor: field.status === "rejected" ? "#fca5a5" : "" }}
          />
        )}

        {field.status === "generated" && (
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <button 
              onClick={(e) => { e.stopPropagation(); handleAccept(fieldKey); }}
              style={{ flex: 1, padding: "6px", backgroundColor: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "4px" }}
            >
              <CheckCircle size={14} /> รับข้อมูลนี้
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); handleReject(fieldKey); }}
              style={{ flex: 1, padding: "6px", backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "4px" }}
            >
              <XCircle size={14} /> ปฏิเสธ
            </button>
          </div>
        )}
      </div>
    );
  };

  // Helper to highlight active excerpt in the document
  const highlightText = (text: string, excerpt: string | null, isActive: boolean) => {
    if (!excerpt || !isActive) return text;
    const parts = text.split(excerpt);
    if (parts.length === 1) return text;
    return (
      <>
        {parts[0]}
        <mark style={{ backgroundColor: "#fef08a", padding: "2px", borderRadius: "2px" }}>{excerpt}</mark>
        {parts[1]}
      </>
    );
  };

  const rawDocumentText = `เรื่อง ขอร้องเรียนกรณีถูกละเมิดสิทธิ
เรียน คณะกรรมการสิทธิมนุษยชนแห่งชาติ

ข้าพเจ้า นายทดสอบ ระบบ ขอร้องเรียนเรื่องการปฏิบัติหน้าที่ของ เจ้าหน้าที่ตำรวจ 
เหตุเกิดที่ กรุงเทพมหานคร เมื่อวันที่ 1 มกราคม 2569

พฤติการณ์: เจ้าหน้าที่ไม่รับแจ้งความและพูดจาข่มขู่

ความประสงค์: ขอให้ตรวจสอบการปฏิบัติหน้าที่

จึงเรียนมาเพื่อโปรดพิจารณา`;

  const activeExcerpt = activeField ? extractedData[activeField as keyof typeof extractedData]?.excerpt : null;

  return (
    <div style={{ display: "flex", gap: "24px", marginTop: "24px", height: "calc(100vh - 200px)" }}>
      {/* Left panel: Document Viewer */}
      <div style={{ flex: 1, backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px solid var(--line)", display: "flex", flexDirection: "column", boxShadow: "var(--shadow-sm)" }}>
        <div style={{ padding: "16px", borderBottom: "1px solid var(--line)", backgroundColor: "#fff", display: "flex", alignItems: "center", gap: "8px", borderTopLeftRadius: "12px", borderTopRightRadius: "12px" }}>
          <FileText size={18} color="var(--teal-dark)" />
          <strong style={{ color: "var(--ink)" }}>เอกสารต้นฉบับ / ข้อความที่ถอดได้</strong>
        </div>
        <div style={{ flex: 1, padding: "32px", overflowY: "auto", fontFamily: "var(--font-bai-jamjuree)" }}>
          <div style={{ whiteSpace: "pre-wrap", color: "#334155", lineHeight: 1.8, fontSize: "15px", backgroundColor: "white", padding: "32px", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            {highlightText(rawDocumentText, activeExcerpt, !!activeExcerpt)}
          </div>
          {activeExcerpt && (
            <div style={{ marginTop: "16px", padding: "12px", backgroundColor: "#fffbeb", border: "1px solid #fef3c7", borderRadius: "8px", fontSize: "13px", color: "#b45309", display: "flex", gap: "8px" }}>
              <AlertCircle size={16} />
              <div>
                <strong>AI อ้างอิงจากประโยค:</strong><br/>
                "{activeExcerpt}"
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right panel: AI Extraction Form */}
      <div style={{ flex: 1, backgroundColor: "#fff", borderRadius: "12px", border: "1px solid var(--line)", display: "flex", flexDirection: "column", boxShadow: "var(--shadow-sm)" }}>
        <div style={{ padding: "16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f8fafc", borderTopLeftRadius: "12px", borderTopRightRadius: "12px" }}>
          <div>
            <strong style={{ color: "var(--ink)" }}>ข้อมูลที่ AI สกัด</strong>
            <span style={{ fontSize: "12px", color: "var(--teal-dark)", marginLeft: "8px", backgroundColor: "var(--mint)", padding: "4px 8px", borderRadius: "20px", fontWeight: 600 }}>Phase 1 Mock</span>
          </div>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="case-primary-button"
            style={{ padding: "8px 16px", fontSize: "14px" }}
          >
            {saving ? <div className="case-spinner" style={{ width: "16px", height: "16px", borderTopColor: "white" }}></div> : <Save size={16} />}
            บันทึกการตรวจสอบ
          </button>
        </div>
        <div style={{ flex: 1, padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", backgroundColor: "#fff" }}>
          
          {renderField("หัวเรื่อง", "title", "text")}
          
          <div style={{ display: "flex", gap: "16px" }}>
            <div style={{ flex: 1 }}>{renderField("ผู้ร้องเรียน", "complainantName", "text")}</div>
            <div style={{ flex: 1 }}>{renderField("ผู้ถูกร้อง", "respondentName", "text")}</div>
          </div>

          {renderField("สถานที่เกิดเหตุ", "location", "text")}
          {renderField("ข้อเท็จจริง / พฤติการณ์", "facts", "textarea")}
          {renderField("ความประสงค์", "desiredOutcome", "textarea")}
          {renderField("ประเด็นสิทธิมนุษยชนที่เกี่ยวข้อง", "rightsIssue", "text")}

        </div>
      </div>
    </div>
  );
}
