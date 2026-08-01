import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ComplaintIntakeForm } from "@/components/cases/complaint-intake-form";
import { canCreateComplaint, getCaseActor } from "@/lib/cases/auth";

export const dynamic = "force-dynamic";

export default async function NewComplaintPage() {
  const actor = await getCaseActor();
  if (!actor) redirect("/cases/login");
  if (!canCreateComplaint(actor)) redirect("/cases");
  return (
    <main className="case-app intake-page">
      <div className="case-container">
        <Link href="/cases" className="case-back"><ChevronLeft size={16} /> กลับหน้ารายการงาน</Link>
        <div className="case-page-heading">
          <div><span className="case-eyebrow">COMPLAINT INTAKE</span><h1>รับเรื่องร้องเรียนใหม่</h1><p>บันทึกข้อมูลต้นทางตามข้อ 13–16 และสร้างกรอบเวลา 15 วันโดยอัตโนมัติ</p></div>
          <span className="security-chip">บันทึกเป็นข้อมูลจำกัดโดยค่าเริ่มต้น</span>
        </div>
        <ComplaintIntakeForm />
      </div>
    </main>
  );
}
