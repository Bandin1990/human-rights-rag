import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getCaseActor } from "@/lib/cases/auth";
import { getComplaintCase } from "@/lib/cases/repository";
import { IntakeSideBySide } from "@/components/cases/intake-side-by-side";

export const dynamic = "force-dynamic";

export default async function IntakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Fetch the case based on ID
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
    <main className="case-app intake-page">
      <div className="case-container" style={{ maxWidth: "1200px" }}>
        <Link href={`/cases/${id}`} className="case-back"><ChevronLeft size={16} /> กลับไปหน้าเรื่องร้องเรียน</Link>
        <div className="case-page-heading">
          <div>
            <span className="case-eyebrow">AI INTAKE REVIEW</span>
            <h1>ตรวจสอบข้อมูลที่สกัดโดย AI</h1>
            <p>เทียบข้อมูลที่ AI สกัด กับเอกสารต้นฉบับ สำหรับเรื่อง: {complaint.referenceNo || complaint.title}</p>
          </div>
          <span className="security-chip">การตัดสินใจสุดท้ายต้องมาจากเจ้าหน้าที่</span>
        </div>
        
        <IntakeSideBySide complaint={complaint} />
      </div>
    </main>
  );
}
