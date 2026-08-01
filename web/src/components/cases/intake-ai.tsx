"use client";

import { useState } from "react";
import { Check, Loader2, Sparkles, AlertCircle, CopyPlus } from "lucide-react";

interface IntakeAIAnalyzerProps {
  facts: string;
  title: string;
  desiredOutcome: string;
  onApprove: (key: string, content: string) => void;
  approvedKeys: string[];
}

interface AnalysisResult {
  rightsIssues: string[];
  duplicateCheck: { isSimilar: boolean; reference: string; reason: string };
  factFinding: string[];
  similarEvidence: string[];
  precedents: string;
}

export function IntakeAIAnalyzer({ facts, title, desiredOutcome, onApprove, approvedKeys }: IntakeAIAnalyzerProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  async function analyze() {
    setAnalyzing(true);
    // Simulate API call to RAG / LLM
    setTimeout(() => {
      setResult({
        rightsIssues: ["สิทธิชุมชน", "สิทธิในสิ่งแวดล้อม", "สิทธิทางสาธารณสุข"],
        duplicateCheck: { 
          isSimilar: true, 
          reference: "สม. 2568/0104", 
          reason: "เนื้อหาเกี่ยวกับผลกระทบด้านสุขภาพจากโรงงานในพื้นที่เดียวกัน" 
        },
        factFinding: [
          "ขอสำเนารายงาน EIA จากหน่วยงานรัฐ",
          "สอบถามความเห็นจากกรมควบคุมมลพิษ",
          "สัมภาษณ์ตัวแทนชุมชนเพิ่มเติมเกี่ยวกับผลกระทบที่เกิดขึ้น"
        ],
        similarEvidence: [
          "หนังสือรับรองผลตรวจสุขภาพจากโรงพยาบาล",
          "ภาพถ่ายผลกระทบจากฝุ่นและควัน",
          "บันทึกการประชุมรับฟังความคิดเห็น"
        ],
        precedents: "ในอดีต (รายงานผลการตรวจสอบที่ 112/2565) กสม. มีมติว่าการปล่อยมลพิษกระทบสิทธิชุมชนและเสนอแนะให้ระงับการประกอบการชั่วคราวจนกว่าจะแก้ไข ควรพิจารณารับเรื่องไว้ตรวจสอบและอาจประสานการคุ้มครองสิทธิคู่ขนาน"
      });
      setAnalyzing(false);
    }, 2500);
  }

  if (!facts && !title) {
    return (
      <div className="intake-ai-panel empty" style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px 24px", background: "rgba(255,255,255,0.6)", borderRadius: "16px", border: "1px dashed var(--line)", minHeight: "auto" }}>
        <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "#f1f5f9", color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles size={24} />
        </div>
        <div>
          <h3 style={{ fontSize: "15px", margin: 0, fontWeight: 700, color: "var(--muted)" }}>AI จะช่วยสรุปประเด็นเมื่อข้อมูลพร้อม</h3>
          <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--muted)" }}>กรุณากรอกข้อมูลชื่อเรื่องและข้อเท็จจริงในแบบฟอร์มด้านล่าง จากนั้นระบบจะพร้อมวิเคราะห์แบบ 360 องศา</p>
        </div>
      </div>
    );
  }

  if (analyzing) {
    return (
      <div className="intake-ai-panel loading">
        <Loader2 size={32} className="spin" />
        <h3>กำลังวิเคราะห์ข้อมูล...</h3>
        <p>ค้นหาประเด็นสิทธิเทียบเคียงและตรวจสอบความซ้ำซ้อนจากฐานข้อมูลคดี</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="intake-ai-panel ready" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", padding: "16px 24px", background: "linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)", borderRadius: "16px", border: "1px solid #bae6fd", minHeight: "auto", boxShadow: "0 4px 15px rgba(14, 165, 233, 0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "var(--teal)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px rgba(14, 165, 233, 0.3)" }}>
            <Sparkles size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: "16px", margin: 0, fontWeight: 700, color: "var(--ink)" }}>ผู้ช่วย AI พร้อมวิเคราะห์คำร้อง</h3>
            <p style={{ margin: "2px 0 0", fontSize: "14px", color: "var(--muted)" }}>วิเคราะห์ประเด็นสิทธิ การหาข้อเท็จจริง และตรวจสอบความซ้ำซ้อนจากฐานข้อมูลคดีแบบอัตโนมัติ</p>
          </div>
        </div>
        <button type="button" className="case-primary-button ai-btn" onClick={analyze} style={{ whiteSpace: "nowrap", padding: "10px 20px" }}>
          <Sparkles size={16} /> เริ่มวิเคราะห์คำร้องนี้
        </button>
      </div>
    );
  }

  const handleApprove = (key: string, content: string) => {
    onApprove(key, content);
  };

  return (
    <div className="intake-ai-panel results">
      <div className="panel-header">
        <Sparkles size={18} />
        <h3>ผลการวิเคราะห์จาก AI</h3>
      </div>
      
      <div className="result-group">
        <h4>1. ประเด็นสิทธิที่เกี่ยวข้อง</h4>
        <div className="tags">
          {result.rightsIssues.map(issue => (
            <span key={issue} className="issue-tag">{issue}</span>
          ))}
        </div>
        <ApproveButton 
          approved={approvedKeys.includes("rights")} 
          onClick={() => handleApprove("rights", result.rightsIssues.join(", "))} 
        />
      </div>

      <div className="result-group">
        <h4>2. ตรวจสอบความซ้ำซ้อน</h4>
        {result.duplicateCheck.isSimilar ? (
          <div className="alert-box">
            <AlertCircle size={16} />
            <div>
              <strong>พบเรื่องคล้ายคลึง: {result.duplicateCheck.reference}</strong>
              <p>{result.duplicateCheck.reason}</p>
            </div>
          </div>
        ) : (
          <p>ไม่พบเรื่องซ้ำซ้อนในระบบ</p>
        )}
        <ApproveButton 
          approved={approvedKeys.includes("duplicate")} 
          onClick={() => handleApprove("duplicate", `อ้างอิงเรื่องเดิม: ${result.duplicateCheck.reference}`)} 
        />
      </div>

      <div className="result-group">
        <h4>3. แนวทางการแสวงหาข้อเท็จจริง</h4>
        <ul>
          {result.factFinding.map((f, i) => <li key={i}>{f}</li>)}
        </ul>
        <ApproveButton 
          approved={approvedKeys.includes("factFinding")} 
          onClick={() => handleApprove("factFinding", result.factFinding.join("\\n"))} 
        />
      </div>

      <div className="result-group">
        <h4>4. ข้อเท็จจริงและหลักฐานที่คล้ายกัน</h4>
        <ul>
          {result.similarEvidence.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
        <ApproveButton 
          approved={approvedKeys.includes("evidence")} 
          onClick={() => handleApprove("evidence", result.similarEvidence.join(", "))} 
        />
      </div>

      <div className="result-group">
        <h4>5. แนวคำวินิจฉัย/ความเห็นเสนอแนะ</h4>
        <p className="precedent-text">{result.precedents}</p>
        <ApproveButton 
          approved={approvedKeys.includes("precedents")} 
          onClick={() => handleApprove("precedents", result.precedents)} 
        />
      </div>
    </div>
  );
}

function ApproveButton({ approved, onClick }: { approved: boolean, onClick: () => void }) {
  if (approved) return <button type="button" className="approve-btn approved" disabled><Check size={14} /> นำไปใช้แล้ว</button>;
  return (
    <button type="button" className="approve-btn" onClick={onClick}>
      <CopyPlus size={14} /> ยอมรับคำแนะนำนี้
    </button>
  );
}
