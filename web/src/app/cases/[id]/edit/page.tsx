import { notFound, redirect } from "next/navigation";
import { getCaseActor } from "@/lib/cases/auth";
import { getComplaintCase } from "@/lib/cases/repository";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ComplaintIntakeForm } from "@/components/cases/complaint-intake-form";

export const dynamic = "force-dynamic";

export default async function EditCasePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getCaseActor();
  if (!actor) redirect("/cases/login");
  
  const { id } = await params;
  const complaint = await getComplaintCase(id);
  if (!complaint) notFound();
  
  // Basic auth check: only assigned officer (or demo) can edit
  if (complaint.assignedOfficer !== actor.name && !actor.demo) {
    redirect(`/cases/${id}`);
  }

  return (
    <main className="case-app intake-page">
      <div className="case-container">
        <Link href={`/cases/${id}`} className="case-back"><ChevronLeft size={16} /> กลับหน้าเรื่องร้องเรียน</Link>
        <div className="case-page-heading">
          <div>
            <span className="case-eyebrow">EDIT COMPLAINT</span>
            <h1>แก้ไขเรื่องร้องเรียน</h1>
            <p>ปรับปรุงข้อมูลคำร้อง หรือเพิ่มเติมรายละเอียดที่สำคัญ</p>
          </div>
          <span className="security-chip">ข้อมูลจะถูกอัปเดตเป็นเวอร์ชันล่าสุด</span>
        </div>
        <ComplaintIntakeForm initialData={complaint} />
      </div>
    </main>
  );
}
