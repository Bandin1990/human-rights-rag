import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { CaseLoginForm } from "@/components/cases/case-login-form";
import { getCaseActor, isCaseDemoMode } from "@/lib/cases/auth";

export const dynamic = "force-dynamic";

export default async function CaseLoginPage() {
  if (isCaseDemoMode()) redirect("/cases");
  if (await getCaseActor()) redirect("/cases");
  return (
    <main className="case-login-page">
      <section className="case-login-card">
        <span className="case-login-icon"><ShieldCheck /></span>
        <span className="case-eyebrow">RESTRICTED CASE WORKSPACE</span>
        <h1>เข้าสู่ระบบงานเรื่องร้องเรียน</h1>
        <p>ใช้บัญชีองค์กรที่ได้รับบทบาทและการมอบหมายรายสำนวนเท่านั้น</p>
        <CaseLoginForm />
        <small>การเปิดดู ดาวน์โหลด และแก้ไขข้อมูลสำนวนจะถูกบันทึกเพื่อตรวจสอบย้อนหลัง</small>
      </section>
    </main>
  );
}
