"use client";

import { useState, useTransition } from "react";
import { Check, X, ArrowRightCircle } from "lucide-react";
import { handleApprovalAction } from "./actions";

export default function ApprovalForm({ 
  complaintId, 
  currentRole 
}: { 
  complaintId: string; 
  currentRole: string; 
}) {
  const [opinion, setOpinion] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (action: 'approve' | 'reject' | 'send_committee') => {
    setError(null);
    if (!opinion.trim()) {
      setError("กรุณาระบุความเห็นก่อนดำเนินการ");
      return;
    }

    startTransition(async () => {
      const res = await handleApprovalAction(complaintId, action, opinion);
      if (res.error) {
        setError(res.error);
      } else {
        setOpinion("");
        // Success
      }
    });
  };

  return (
    <div style={{ flex: 1, backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "24px" }}>
      <h3 style={{ marginBottom: "16px" }}>พิจารณา (สำหรับ {currentRole})</h3>
      
      {error && <div style={{ color: "#ef4444", marginBottom: "16px", fontSize: "14px", padding: "12px", backgroundColor: "#fef2f2", borderRadius: "6px" }}>{error}</div>}

      <div className="case-field">
        <label>ความเห็น / ข้อเสนอแนะเพิ่มเติม</label>
        <textarea 
          className="case-input" 
          rows={4} 
          placeholder="ระบุความเห็น..." 
          value={opinion}
          onChange={(e) => setOpinion(e.target.value)}
          disabled={isPending}
        />
      </div>

      <div style={{ display: "flex", gap: "12px", marginTop: "24px", flexDirection: "column" }}>
        <button 
          className="case-btn primary" 
          style={{ justifyContent: "center" }}
          onClick={() => handleSubmit('approve')}
          disabled={isPending}
        >
          <Check size={18} style={{ marginRight: "8px" }} /> {isPending ? "กำลังบันทึก..." : "เห็นชอบและส่งต่อ"}
        </button>
        <button 
          className="case-btn outline" 
          style={{ justifyContent: "center", color: "#ef4444", borderColor: "#ef4444" }}
          onClick={() => handleSubmit('reject')}
          disabled={isPending}
        >
          <X size={18} style={{ marginRight: "8px" }} /> ตีกลับให้แก้ไข
        </button>
        <button 
          className="case-btn outline" 
          style={{ justifyContent: "center" }}
          onClick={() => handleSubmit('send_committee')}
          disabled={isPending}
        >
          <ArrowRightCircle size={18} style={{ marginRight: "8px" }} /> ส่งเข้าที่ประชุม กสม.
        </button>
      </div>
    </div>
  );
}
