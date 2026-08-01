"use client";

import { useState } from "react";
import { ComplaintCase } from "@/types/case";
import { Bot, Save, Wand2 } from "lucide-react";

export function ReportStudioWorkspace({ complaint }: { complaint: ComplaintCase }) {
  const [activeSection, setActiveSection] = useState("background");

  // Format evidence into a bulleted list for actions taken
  const formatActionsTaken = () => {
    if (!complaint.evidence || complaint.evidence.length === 0) return "- ไม่พบประวัติการแสวงหาข้อเท็จจริงในระบบ";
    return complaint.evidence.map((ev: any, idx: number) => 
      `${idx + 1}. เมื่อวันที่ ${ev.obtainedAt} ได้รับข้อมูลจาก ${ev.sourceName} (ประเภท: ${ev.type})`
    ).join("\n");
  };

  const [sections, setSections] = useState({
    background: complaint.summary || "",
    actions_taken: formatActionsTaken(),
    facts: "",
    opinion: "",
    recommendations: ""
  });
  const [generating, setGenerating] = useState(false);
  const [rewriting, setRewriting] = useState(false);

  const sectionsList = [
    { id: "background", name: "1. ความเป็นมา" },
    { id: "actions_taken", name: "2. การดำเนินการ" },
    { id: "facts", name: "3. ข้อเท็จจริงที่ได้จากการตรวจสอบ" },
    { id: "opinion", name: "4. ความเห็นของคณะกรรมการสิทธิมนุษยชนแห่งชาติ" },
    { id: "recommendations", name: "5. ข้อเสนอแนะของคณะกรรมการสิทธิมนุษยชนแห่งชาติ" }
  ];

  const handleDraftWithAI = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/draft-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionType: activeSection,
          caseData: {
            title: complaint.title,
            summary: complaint.summary,
            rightsIssues: complaint.rightsIssues,
            desiredOutcome: complaint.desiredOutcome,
            evidence: complaint.evidence,
            legalBasis: complaint.screening?.legalBasis || ""
          }
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSections(prev => ({ ...prev, [activeSection]: data.draftContent }));
      } else {
        alert("Error: " + data.error);
      }
    } catch (error) {
      console.error(error);
      alert("Failed to generate draft");
    } finally {
      setGenerating(false);
    }
  };

  const handleRewrite = async () => {
    if (!sections[activeSection as keyof typeof sections]) return;
    setRewriting(true);
    try {
      const res = await fetch("/api/ai/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sections[activeSection as keyof typeof sections],
          instruction: "ปรับให้เป็นภาษาราชการระดับสูง ที่ใช้ในรายงานผลการตรวจสอบของ กสม. 2"
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSections(prev => ({ ...prev, [activeSection]: data.rewrittenText }));
      } else {
        alert("Error: " + data.error);
      }
    } catch (error) {
      console.error(error);
      alert("Failed to rewrite text");
    } finally {
      setRewriting(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: "24px", marginTop: "24px", height: "calc(100vh - 200px)" }}>
      {/* Left panel: Sections list */}
      <div style={{ width: "300px", backgroundColor: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb", padding: "16px", overflowY: "auto" }}>
        <h3 style={{ fontSize: "16px", marginBottom: "16px", color: "#374151" }}>โครงสร้างรายงาน (กสม. 2)</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {sectionsList.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              style={{
                padding: "12px",
                textAlign: "left",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                backgroundColor: activeSection === s.id ? "#eff6ff" : "transparent",
                color: activeSection === s.id ? "#1e40af" : "#4b5563",
                fontWeight: activeSection === s.id ? "bold" : "normal",
                lineHeight: "1.4"
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Right panel: Editor */}
      <div style={{ flex: 1, backgroundColor: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "18px", margin: 0, color: "#111827" }}>
            {sectionsList.find(s => s.id === activeSection)?.name}
          </h3>
          <div style={{ display: "flex", gap: "12px" }}>
            <button 
              onClick={handleRewrite} 
              disabled={rewriting || !sections[activeSection as keyof typeof sections]}
              className="case-btn outline"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              {rewriting ? <div className="case-spinner" style={{ width: "14px", height: "14px" }}></div> : <Wand2 size={16} />}
              AI ปรับภาษา
            </button>
            <button 
              onClick={handleDraftWithAI} 
              disabled={generating}
              className="case-btn outline"
              style={{ display: "flex", alignItems: "center", gap: "6px", color: "#8b5cf6", borderColor: "#8b5cf6" }}
            >
              {generating ? <div className="case-spinner" style={{ width: "14px", height: "14px", borderTopColor: "#8b5cf6" }}></div> : <Bot size={16} />}
              AI ร่างเนื้อหาส่วนนี้
            </button>
            <button className="case-btn primary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Save size={16} /> บันทึก
            </button>
          </div>
        </div>
        
        <div style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column" }}>
          <textarea 
            value={sections[activeSection as keyof typeof sections]}
            onChange={(e) => setSections(prev => ({ ...prev, [activeSection]: e.target.value }))}
            placeholder={`พิมพ์เนื้อหา หรือกด "AI ร่างเนื้อหาส่วนนี้"`}
            style={{ 
              width: "100%", 
              flex: 1, 
              padding: "16px", 
              border: "1px solid #e5e7eb", 
              borderRadius: "6px",
              resize: "none",
              fontSize: "16px",
              lineHeight: "1.6",
              fontFamily: "Bai Jamjuree, sans-serif"
            }}
          />
        </div>
      </div>
    </div>
  );
}

