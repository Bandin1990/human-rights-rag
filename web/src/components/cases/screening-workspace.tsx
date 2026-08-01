"use client";

import { useState } from "react";
import { ComplaintCase } from "@/types/case";
import { Bot, FileText, Save, CheckCircle, Search } from "lucide-react";

export function ScreeningWorkspace({ complaint }: { complaint: ComplaintCase }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [similarCases, setSimilarCases] = useState<any[]>([]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      // 1. Analyze Screening
      const res = await fetch("/api/ai/screening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complaintId: complaint.id,
          facts: complaint.summary,
          desiredOutcome: complaint.desiredOutcome
        })
      });
      const data = await res.json();
      if (res.ok && data.screeningAnalysis) {
        setAnalysis(data.screeningAnalysis);
      }

      // 2. Fetch Similar Cases
      const simRes = await fetch("/api/ai/similar-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: complaint.summary })
      });
      const simData = await simRes.json();
      if (simRes.ok && simData.similarCases) {
        setSimilarCases(simData.similarCases);
      }
    } catch (error) {
      console.error(error);
      alert("Error analyzing case");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: "24px", marginTop: "24px" }}>
      {/* Left panel: Case Facts */}
      <div style={{ flex: 1, backgroundColor: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb", padding: "24px" }}>
        <h3 style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}><FileText size={18} /> ข้อเท็จจริง</h3>
        <div style={{ whiteSpace: "pre-wrap", color: "#374151", marginBottom: "24px" }}>
          {complaint.summary}
        </div>
        <h3 style={{ marginBottom: "16px", fontSize: "14px", color: "#4b5563" }}>ความประสงค์</h3>
        <div style={{ whiteSpace: "pre-wrap", color: "#374151" }}>
          {complaint.desiredOutcome || "-"}
        </div>
        
        {!analysis && (
          <button 
            onClick={handleAnalyze} 
            disabled={analyzing}
            className="case-btn primary"
            style={{ marginTop: "24px", width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: "8px" }}
          >
            {analyzing ? <div className="case-spinner" style={{ width: "16px", height: "16px", borderTopColor: "white" }}></div> : <Bot size={18} />}
            ให้ AI วิเคราะห์อำนาจหน้าที่
          </button>
        )}
      </div>

      {/* Right panel: AI Analysis & Editor */}
      <div style={{ flex: 1.5, backgroundColor: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb", padding: "24px" }}>
        <h3 style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "8px" }}><Bot size={18} /> การวิเคราะห์โดย AI</h3>
        
        {analysis ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ padding: "16px", backgroundColor: analysis.jurisdictionAnalysis.withinMandate ? "#d1fae5" : "#fee2e2", borderRadius: "8px", border: "1px solid", borderColor: analysis.jurisdictionAnalysis.withinMandate ? "#10b981" : "#ef4444" }}>
              <strong style={{ color: analysis.jurisdictionAnalysis.withinMandate ? "#065f46" : "#991b1b" }}>
                {analysis.jurisdictionAnalysis.withinMandate ? "อยู่ในอำนาจหน้าที่ กสม." : "ไม่อยู่ในอำนาจหน้าที่ กสม."}
              </strong>
              <ul style={{ marginTop: "8px", paddingLeft: "20px", color: "#374151", fontSize: "14px" }}>
                {analysis.jurisdictionAnalysis.reasons.map((r: string, idx: number) => <li key={idx}>{r}</li>)}
              </ul>
            </div>

            <div className="case-field">
              <label>ข้อเสนอแนะหลัก (AI)</label>
              <select className="case-input" defaultValue={analysis.recommendedOutcome}>
                <option value="accept_for_investigation">รับไว้ตรวจสอบ</option>
                <option value="protection">คุ้มครอง</option>
                <option value="assistance">ช่วยเหลือ</option>
                <option value="reject">ไม่รับเรื่อง</option>
                <option value="refer">ส่งต่อหน่วยงานอื่น</option>
              </select>
            </div>

            <div className="case-field">
              <label>ฐานกฎหมาย / มาตราที่เกี่ยวข้อง</label>
              <textarea className="case-input" rows={3} defaultValue={analysis.legalSources.join("\n")} />
            </div>
            
            <div className="case-field">
              <label>ประเด็นสิทธิ</label>
              <input type="text" className="case-input" defaultValue={analysis.rightsIssues.join(", ")} />
            </div>

            <div className="case-field">
              <label><Search size={14} style={{ display: "inline", marginRight: "4px" }} /> เรื่องร้องเรียนเดิมที่ใกล้เคียง (RAG Search)</label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {similarCases.length > 0 ? similarCases.map(c => (
                  <div key={c.id} style={{ padding: "12px", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "14px" }}>
                    <strong>{c.title}</strong>
                    <div style={{ color: "#6b7280", marginTop: "4px" }}>{c.summary?.substring(0, 100)}...</div>
                  </div>
                )) : <div style={{ fontSize: "14px", color: "#6b7280" }}>ไม่พบเรื่องเทียบเคียง</div>}
              </div>
            </div>

            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "16px", marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
              <button className="case-btn primary" onClick={() => alert('ส่งเข้าสู่ระบบ Approval เรียบร้อย')}>บันทึกและเสนอความเห็น (เข้า Workflow)</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px", color: "#9ca3af", flexDirection: "column", gap: "16px" }}>
            <Bot size={48} opacity={0.5} />
            <p>คลิกวิเคราะห์ด้านซ้ายเพื่อเริ่มต้น</p>
          </div>
        )}
      </div>
    </div>
  );
}
