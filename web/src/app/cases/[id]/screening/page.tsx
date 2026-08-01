import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getCaseActor } from "@/lib/cases/auth";
import { getComplaintCase } from "@/lib/cases/repository";
import { ScreeningWorkspace } from "@/components/cases/screening-workspace";

export const dynamic = "force-dynamic";

export default async function ScreeningPage({ params }: { params: Promise<{ id: string }> }) {
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

  return (
    <main className="case-app screening-page">
      <div className="case-container" style={{ maxWidth: "1200px" }}>
        <Link href={`/cases/${id}`} className="case-back"><ChevronLeft size={16} /> กลับไปหน้าเรื่องร้องเรียน</Link>
        <div className="case-page-heading">
          <div>
            <span className="case-eyebrow">AI SCREENING ASSISTANT</span>
            <h1>วิเคราะห์อำนาจหน้าที่และคัดกรองเรื่อง</h1>
            <p>เรื่อง: {complaint.referenceNo || complaint.title}</p>
          </div>
          <span className="security-chip">ข้อมูลจำกัด (RESTRICTED)</span>
        </div>
        
        <ScreeningWorkspace complaint={complaint} />
      </div>
    </main>
  );
}
