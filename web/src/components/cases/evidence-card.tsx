"use client";

import { useState } from "react";
import { FileText, Headphones, Bot, ChevronDown, ChevronUp, FileSearch } from "lucide-react";

export function EvidenceCard({ item, allegations }: { item: any, allegations: string }) {
  const [expanded, setExpanded] = useState(false);
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const isAudio = item.type === "audio";

  const handleRunAI = async () => {
    setLoading(true);
    try {
      if (isAudio) {
        // Run Transcription
        const res = await fetch("/api/ai/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: item.id })
        });
        const data = await res.json();
        if (res.ok) {
          setInsights({ type: "transcript", content: data.transcriptionText });
        } else {
          alert("Error: " + data.error);
        }
      } else {
        // Run Summarization
        const res = await fetch("/api/ai/summarize-evidence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: item.content || "ไม่มีข้อมูลเนื้อหาเบื้องต้น", allegations, type: item.type })
        });
        const data = await res.json();
        if (res.ok) {
          setInsights({ type: "summary", data: data.evidenceInsights });
        } else {
          alert("Error: " + data.error);
        }
      }
      setExpanded(true);
    } catch (error) {
      console.error(error);
      alert("Failed to run AI");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
      <div style={{ padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: "flex", gap: "16px" }}>
          <div style={{ width: "40px", height: "40px", backgroundColor: "#f3f4f6", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280" }}>
            {isAudio ? <Headphones size={20} /> : <FileText size={20} />}
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: "16px", color: "#111827", display: "flex", alignItems: "center", gap: "8px" }}>
              {item.title}
              {item.verification === "verified" && <span style={{ fontSize: "12px", backgroundColor: "#d1fae5", color: "#065f46", padding: "2px 6px", borderRadius: "4px", fontWeight: "normal" }}>ตรวจสอบแล้ว</span>}
            </h4>
            <div style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
              ได้มาจาก: {item.source} • วันที่: {item.obtainedAt}
            </div>
            {item.supports?.length > 0 && (
              <div style={{ fontSize: "12px", color: "#4b5563", marginTop: "8px", display: "flex", gap: "8px" }}>
                <span>สนับสนุนข้อกล่าวหา:</span>
                {item.supports.map((a: string, i: number) => (
                  <span key={i} style={{ backgroundColor: "#f3f4f6", padding: "2px 8px", borderRadius: "12px" }}>{a}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div>
          {expanded ? <ChevronUp size={20} color="#9ca3af" /> : <ChevronDown size={20} color="#9ca3af" />}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "16px", borderTop: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
          
          {/* Action Bar */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
            <button 
              onClick={handleRunAI} 
              disabled={loading}
              className="case-btn outline"
              style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#fff", cursor: "pointer", padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db" }}
            >
              {loading ? <div className="case-spinner" style={{ width: "16px", height: "16px", borderTopColor: "#3b82f6" }}></div> : <Bot size={16} color="#3b82f6" />}
              {isAudio ? "AI ถอดเสียง (Transcription)" : "AI สรุปข้อเท็จจริง (Summarize)"}
            </button>
            <button className="case-btn outline" style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#fff", cursor: "pointer", padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db" }}>
              <FileSearch size={16} /> ดูไฟล์ต้นฉบับ
            </button>
          </div>

          {/* AI Insights Area */}
          {insights && insights.type === "transcript" && (
            <div style={{ backgroundColor: "#fff", border: "1px solid #bfdbfe", borderRadius: "6px", padding: "16px" }}>
              <h5 style={{ margin: "0 0 12px 0", color: "#1e40af", display: "flex", alignItems: "center", gap: "6px" }}><Bot size={16} /> AI Transcript</h5>
              <div style={{ whiteSpace: "pre-wrap", fontSize: "14px", color: "#374151", lineHeight: "1.6" }}>
                {insights.content}
              </div>
            </div>
          )}

          {insights && insights.type === "summary" && (
            <div style={{ backgroundColor: "#fff", border: "1px solid #bfdbfe", borderRadius: "6px", padding: "16px" }}>
              <h5 style={{ margin: "0 0 12px 0", color: "#1e40af", display: "flex", alignItems: "center", gap: "6px" }}><Bot size={16} /> AI Summary Insights</h5>
              
              <div style={{ marginBottom: "16px" }}>
                <strong style={{ fontSize: "14px", color: "#4b5563" }}>สรุป:</strong>
                <p style={{ fontSize: "14px", margin: "4px 0 0 0", color: "#111827" }}>{insights.data.summary}</p>
              </div>

              {insights.data.relevanceToAllegations && insights.data.relevanceToAllegations.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <strong style={{ fontSize: "14px", color: "#4b5563" }}>การวิเคราะห์ข้อกล่าวหา:</strong>
                  <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px", fontSize: "14px" }}>
                    {insights.data.relevanceToAllegations.map((rel: any, idx: number) => (
                      <li key={idx}>
                        <span style={{ color: rel.supports ? "#10b981" : "#ef4444", fontWeight: "bold" }}>
                          {rel.supports ? "[สนับสนุน]" : "[หักล้าง]"}
                        </span> {rel.allegation} — {rel.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insights.data.timeline && insights.data.timeline.length > 0 && (
                <div>
                  <strong style={{ fontSize: "14px", color: "#4b5563" }}>ลำดับเหตุการณ์:</strong>
                  <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px", fontSize: "14px" }}>
                    {insights.data.timeline.map((t: any, idx: number) => (
                      <li key={idx}><strong>{t.date}:</strong> {t.event}</li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  );
}
