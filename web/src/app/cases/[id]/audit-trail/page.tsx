import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Shield, User, Bot, Clock } from "lucide-react";
import { getCaseActor } from "@/lib/cases/auth";
import { getComplaintCase } from "@/lib/cases/repository";

export const dynamic = "force-dynamic";

export default async function AuditTrailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getCaseActor();
  if (!actor) redirect("/cases/login");

  const { id } = await params;
  const complaint = await getComplaintCase(id);
  
  if (!complaint) {
    return (
      <main className="case-app">
        <div className="case-container">
          <h2>ไม่พบข้อมูลเรื่องร้องเรียน</h2>
          <Link href="/cases">กลับหน้ารายการงาน</Link>
        </div>
      </main>
    );
  }

  // Mock audit logs for the dashboard
  const auditLogs = [
    {
      id: "log-1",
      action: "AI_DRAFT_GENERATED",
      description: "AI สร้างร่างเนื้อหารายงานส่วน 'ความเห็นของคณะกรรมการ'",
      actor: "ระบบ AI (gpt-4o)",
      isAi: true,
      timestamp: "15 ก.ค. 2569 15:30",
    },
    {
      id: "log-2",
      action: "EVIDENCE_ADDED",
      description: "เพิ่มพยานหลักฐาน: 'บันทึกประจำวันสถานีตำรวจ (สำเนา)'",
      actor: "นายสมชาย (Officer)",
      isAi: false,
      timestamp: "15 ก.ค. 2569 14:15",
    },
    {
      id: "log-3",
      action: "STATUS_CHANGED",
      description: "เปลี่ยนสถานะคดีจาก 'Screening' เป็น 'Investigation'",
      actor: "คุณสมหญิง (Director)",
      isAi: false,
      timestamp: "14 ก.ค. 2569 09:00",
    },
    {
      id: "log-4",
      action: "CASE_CREATED",
      description: "สร้างคำร้องผ่านระบบอิเล็กทรอนิกส์",
      actor: "ผู้ร้องเรียน (System)",
      isAi: false,
      timestamp: "09 มิ.ย. 2569 09:20",
    }
  ];

  return (
    <main className="case-app audit-page">
      <div className="case-container" style={{ maxWidth: "1000px" }}>
        <Link href={`/cases/${id}`} className="case-back"><ChevronLeft size={16} /> กลับไปหน้าเรื่องร้องเรียน</Link>
        <div className="case-page-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <span className="case-eyebrow" style={{ display: "flex", alignItems: "center", gap: "6px" }}><Shield size={14} /> SECURITY & AUDIT</span>
            <h1>ประวัติการแก้ไขข้อมูลคดี (Audit Trail)</h1>
            <p>เรื่อง: {complaint.referenceNo || complaint.title}</p>
          </div>
          <span className="security-chip" style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}>ข้อมูลปกปิด (RESTRICTED)</span>
        </div>
        
        <div style={{ marginTop: "24px", backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb", fontWeight: "bold", color: "#374151" }}>
            บันทึกประวัติ (เรียงจากล่าสุด)
          </div>
          
          <div style={{ display: "flex", flexDirection: "column" }}>
            {auditLogs.map((log, index) => (
              <div key={log.id} style={{ 
                padding: "20px 24px", 
                borderBottom: index < auditLogs.length - 1 ? "1px solid #e5e7eb" : "none",
                display: "flex",
                gap: "24px"
              }}>
                <div style={{ width: "160px", color: "#6b7280", fontSize: "14px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Clock size={14} /> {log.timestamp}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ 
                      padding: "2px 8px", 
                      borderRadius: "12px", 
                      fontSize: "12px", 
                      fontWeight: "bold",
                      backgroundColor: log.action.includes("AI") ? "#ede9fe" : "#e0f2fe",
                      color: log.action.includes("AI") ? "#5b21b6" : "#0369a1",
                    }}>
                      {log.action}
                    </span>
                  </div>
                  <div style={{ fontSize: "16px", color: "#111827", marginBottom: "8px" }}>
                    {log.description}
                  </div>
                  <div style={{ fontSize: "14px", color: "#4b5563", display: "flex", alignItems: "center", gap: "6px" }}>
                    {log.isAi ? <Bot size={16} color="#8b5cf6" /> : <User size={16} color="#4b5563" />} 
                    ผู้ดำเนินการ: {log.actor}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
