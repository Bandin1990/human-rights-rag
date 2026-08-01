"use client";

import { useState } from "react";
import { Sparkles, CheckSquare, Plus, RefreshCw, AlertTriangle } from "lucide-react";
import type { ComplaintCase } from "@/types/case";

interface AiRecommendationData {
  similarCases: string[];
  rightsIssues: string[];
  requiredEvidence: string[];
  suggestedAction: string;
  rationale: string;
  isDemo?: boolean;
}

export function AiRecommendationsPanel({ complaintId }: { complaintId: string }) {
  const [data, setData] = useState<AiRecommendationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set());

  const fetchRecommendations = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/cases/${complaintId}/analyze`, { method: "POST" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "การประมวลผลล้มเหลว");
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ระบบ AI ขัดข้องชั่วคราว");
    } finally {
      setLoading(false);
    }
  };

  const toggleIssue = (issue: string) => {
    const next = new Set(selectedIssues);
    if (next.has(issue)) next.delete(issue);
    else next.add(issue);
    setSelectedIssues(next);
  };

  return (
    <section className="workspace-card ai-recommendations" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
      <div className="workspace-card-heading" style={{ background: "rgba(59, 130, 246, 0.1)", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <div>
          <span className="case-eyebrow" style={{ color: "var(--primary)" }}>AI ASSISTANT</span>
          <h2 style={{ display: "flex", alignItems: "center", gap: "6px", margin: 0, fontSize: "1rem" }}><Sparkles size={16} color="var(--primary)" /> วิเคราะห์แนวทางคดี</h2>
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {!data && !loading && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <p style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "16px" }}>
              ให้ระบบ AI ช่วยค้นหาเรื่องร้องเรียนเดิมที่อาจซ้ำซ้อน และแนะนำประเด็นสิทธิที่เกี่ยวข้อง
            </p>
            <button 
              type="button" 
              onClick={fetchRecommendations}
              className="case-primary-button" 
              style={{ width: "100%", justifyContent: "center" }}
            >
              <Sparkles size={16} /> เริ่มประมวลผลคำร้อง
            </button>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--muted)" }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 10px" }} />
            <p style={{ fontSize: "0.9rem" }}>กำลังประมวลผลข้อเท็จจริงและเทียบเคียงฐานข้อมูล...</p>
          </div>
        )}

        {error && (
          <div style={{ color: "var(--destructive)", padding: "10px", background: "rgba(239,68,68,0.1)", borderRadius: "6px", fontSize: "0.85rem", display: "flex", gap: "8px" }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {data && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--muted-foreground)", marginBottom: "8px", textTransform: "uppercase" }}>🔍 คดีเดิมที่คล้ายคลึงกัน</h3>
              {data.similarCases.length > 0 ? (
                <ul style={{ paddingLeft: "16px", fontSize: "0.9rem", margin: 0 }}>
                  {data.similarCases.map(c => <li key={c}>{c}</li>)}
                </ul>
              ) : <p style={{ fontSize: "0.9rem", color: "var(--muted)", margin: 0 }}>ไม่พบเรื่องร้องเรียนซ้ำซ้อนในระบบ</p>}
            </div>

            <div>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--muted-foreground)", marginBottom: "8px", textTransform: "uppercase" }}>⚖️ ประเด็นสิทธิที่เกี่ยวข้อง</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {data.rightsIssues.map(issue => (
                  <label key={issue} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem", cursor: "pointer", background: selectedIssues.has(issue) ? "rgba(59, 130, 246, 0.05)" : "transparent", padding: "6px 8px", borderRadius: "4px", border: "1px solid", borderColor: selectedIssues.has(issue) ? "var(--primary)" : "transparent" }}>
                    <input type="checkbox" checked={selectedIssues.has(issue)} onChange={() => toggleIssue(issue)} />
                    {issue}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--muted-foreground)", marginBottom: "8px", textTransform: "uppercase" }}>📁 หลักฐานที่ควรแสวงหาเพิ่ม</h3>
              <ul style={{ paddingLeft: "16px", fontSize: "0.9rem", margin: 0 }}>
                {data.requiredEvidence.map(ev => <li key={ev}>{ev}</li>)}
              </ul>
            </div>

            <div style={{ background: "var(--bg-subtle)", padding: "12px", borderRadius: "6px", border: "1px solid var(--border)" }}>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 600, margin: "0 0 4px 0" }}>ความเห็น: {data.suggestedAction}</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--muted-foreground)", margin: 0 }}>{data.rationale}</p>
            </div>
            
            {data.isDemo && (
              <small style={{ color: "var(--muted)", textAlign: "center", display: "block" }}>* ข้อมูลจำลอง (โหมด Demo)</small>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
