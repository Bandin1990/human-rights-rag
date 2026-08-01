import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getComplaintCase, getApprovalWorkflowState } from "@/lib/cases/repository";
import ApprovalForm from "./approval-form";

export const dynamic = "force-dynamic";

function getRoleName(status: string) {
  switch (status) {
    case 'draft': return 'รอส่งพิจารณา';
    case 'submitted_for_review': return 'พนักงานเจ้าหน้าที่';
    case 'approved_by_supervisor': return 'ผู้อำนวยการกลุ่ม';
    case 'approved_by_director': return 'คณะกรรมการ กสม.';
    case 'sent_back': return 'ตีกลับให้แก้ไข';
    default: return 'ไม่ทราบสถานะ';
  }
}

export default async function ApprovalPage({ params }: { params: Promise<{ id: string }> }) {
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

  const workflowState = await getApprovalWorkflowState(id);
  const assessments = workflowState.assessments || [];
  
  let currentRole = "ผู้อำนวยการกลุ่ม";
  let currentStatus = "รอพิจารณา";
  
  if (assessments.length > 0) {
    const lastAssessment = assessments[assessments.length - 1];
    if (lastAssessment.status === 'submitted_for_review') {
      currentRole = 'ผู้อำนวยการกลุ่ม';
      currentStatus = 'รอพิจารณาโดยผู้อำนวยการกลุ่ม';
    } else if (lastAssessment.status === 'approved_by_supervisor') {
      currentRole = 'คณะกรรมการ กสม.';
      currentStatus = 'รอพิจารณาโดยกรรมการ';
    } else if (lastAssessment.status === 'sent_back') {
      currentRole = 'พนักงานเจ้าหน้าที่';
      currentStatus = 'รอกลับไปแก้ไข';
    }
  }

  return (
    <main className="case-app approval-page">
      <div className="case-container" style={{ maxWidth: "1000px" }}>
        <Link href={`/cases/${id}`} className="case-back"><ChevronLeft size={16} /> กลับไปหน้าเรื่องร้องเรียน</Link>
        <div className="case-page-heading">
          <div>
            <span className="case-eyebrow">APPROVAL WORKFLOW</span>
            <h1>พิจารณาอนุมัติ</h1>
            <p>เรื่อง: {complaint.referenceNo || complaint.title}</p>
          </div>
          <span className="security-chip">การตัดสินใจสุดท้ายต้องมาจากเจ้าหน้าที่</span>
        </div>
        
        <div style={{ display: "flex", gap: "24px", marginTop: "24px" }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ marginBottom: "16px" }}>สถานะการพิจารณา</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              
              {workflowState.recommendation && (
                <div style={{ padding: "16px", borderRadius: "8px", border: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <strong style={{ color: '#6b7280' }}>AI Assistant</strong>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>ความมั่นใจ: {(workflowState.recommendation.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ fontSize: "14px", color: "#374151" }}>ข้อเสนอแนะ: {workflowState.recommendation.recommendedOutcome === 'accept_for_investigation' ? 'รับไว้ตรวจสอบ' : workflowState.recommendation.recommendedOutcome}</div>
                  <div style={{ fontSize: "14px", color: "#4b5563", marginTop: "4px" }}>ประเด็นสิทธิ: {workflowState.recommendation.rightsIssues?.join(', ')}</div>
                </div>
              )}

              {assessments.map((step, idx) => (
                <div key={step.id || idx} style={{ 
                  padding: "16px", 
                  borderRadius: "8px", 
                  border: "1px solid", 
                  borderColor: step.status.includes('approved') ? '#10b981' : step.status === 'sent_back' ? '#ef4444' : '#3b82f6',
                  backgroundColor: step.status.includes('approved') ? '#f0fdf4' : step.status === 'sent_back' ? '#fef2f2' : '#eff6ff'
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <strong style={{ color: step.status.includes('approved') ? '#065f46' : step.status === 'sent_back' ? '#991b1b' : '#1e40af' }}>
                      {getRoleName(step.status)}
                    </strong>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>
                      {new Date(step.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ fontSize: "14px", color: "#374151" }}>ความเห็น: {step.officerOpinion}</div>
                </div>
              ))}
              
              {assessments.length === 0 && (
                <div style={{ color: '#6b7280', fontSize: '14px', fontStyle: 'italic' }}>ยังไม่มีการพิจารณาจากพนักงานเจ้าหน้าที่</div>
              )}
            </div>
          </div>

          <ApprovalForm complaintId={id} currentRole={currentRole} />
        </div>
      </div>
    </main>
  );
}
