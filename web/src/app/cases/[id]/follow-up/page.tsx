import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Building, Calendar, CheckCircle } from "lucide-react";
import { getCaseActor } from "@/lib/cases/auth";
import { getComplaintCase } from "@/lib/cases/repository";

export const dynamic = "force-dynamic";

export default async function FollowUpPage({ params }: { params: Promise<{ id: string }> }) {
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

  const tasks = [
    {
      id: "tsk-001",
      agencyName: "สำนักงานตำรวจแห่งชาติ",
      assignedAction: "รายงานผลการตั้งคณะกรรมการสอบสวนทางวินัยเจ้าหน้าที่ตำรวจที่เกี่ยวข้อง",
      deadlineDate: "2026-08-15",
      status: "pending",
      statusText: "รอดำเนินการ",
    },
    {
      id: "tsk-002",
      agencyName: "กระทรวงยุติธรรม",
      assignedAction: "พิจารณาให้ความคุ้มครองพยานในคดี",
      deadlineDate: "2026-07-20",
      status: "completed",
      statusText: "ดำเนินการแล้ว",
      responseSummary: "กรมคุ้มครองสิทธิฯ ได้จัดชุดเจ้าหน้าที่ดูแลความปลอดภัยผู้ร้องเรียนเรียบร้อยแล้ว",
    }
  ];

  return (
    <main className="case-app followup-page">
      <div className="case-container" style={{ maxWidth: "1000px" }}>
        <Link href={`/cases/${id}`} className="case-back"><ChevronLeft size={16} /> กลับไปหน้าเรื่องร้องเรียน</Link>
        <div className="case-page-heading">
          <div>
            <span className="case-eyebrow">FOLLOW-UP</span>
            <h1>ติดตามผลการดำเนินการ</h1>
            <p>เรื่อง: {complaint.referenceNo || complaint.title}</p>
          </div>
        </div>
        
        <div style={{ marginTop: "24px", display: "grid", gap: "16px" }}>
          {tasks.map(task => (
            <div key={task.id} style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", fontWeight: "bold", color: "#111827" }}>
                  <Building size={18} color="#6b7280" />
                  {task.agencyName}
                </div>
                <span style={{ 
                  padding: "4px 12px", 
                  borderRadius: "16px", 
                  fontSize: "12px", 
                  fontWeight: "bold",
                  backgroundColor: task.status === 'completed' ? '#d1fae5' : '#fef3c7',
                  color: task.status === 'completed' ? '#065f46' : '#92400e'
                }}>
                  {task.statusText}
                </span>
              </div>
              
              <div style={{ marginBottom: "16px", color: "#374151" }}>
                <strong>ข้อเสนอแนะให้ดำเนินการ: </strong>
                {task.assignedAction}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "#6b7280", marginBottom: task.responseSummary ? "16px" : "0" }}>
                <Calendar size={14} /> กำหนดรายงานผล: {task.deadlineDate}
              </div>

              {task.responseSummary && (
                <div style={{ padding: "12px", backgroundColor: "#f9fafb", borderRadius: "6px", borderLeft: "4px solid #10b981", fontSize: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#065f46", marginBottom: "4px", fontWeight: "bold" }}>
                    <CheckCircle size={14} /> ผลการดำเนินการ (รับแจ้งเมื่อ {task.deadlineDate})
                  </div>
                  <div style={{ color: "#374151" }}>
                    {task.responseSummary}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
