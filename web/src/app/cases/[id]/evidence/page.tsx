import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { getCaseActor } from "@/lib/cases/auth";
import { getComplaintCase } from "@/lib/cases/repository";
import { EvidenceCard } from "@/components/cases/evidence-card";

export const dynamic = "force-dynamic";

export default async function EvidenceBoardPage({ params }: { params: Promise<{ id: string }> }) {
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

  const evidenceItems = complaint.evidence;
  const allegations = complaint.allegations.join(", ");

  return (
    <main className="case-app evidence-page">
      <div className="case-container" style={{ maxWidth: "1200px" }}>
        <Link href={`/cases/${id}`} className="case-back"><ChevronLeft size={16} /> กลับไปหน้าเรื่องร้องเรียน</Link>
        <div className="case-page-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <span className="case-eyebrow">EVIDENCE & FACT-FINDING</span>
            <h1>กระดานพยานหลักฐาน</h1>
            <p>เรื่อง: {complaint.referenceNo || complaint.title}</p>
          </div>
          <button className="case-btn primary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Plus size={16} /> เพิ่มพยานหลักฐาน
          </button>
        </div>
        
        <div style={{ marginTop: "24px", display: "grid", gap: "24px", gridTemplateColumns: "1fr" }}>
          {evidenceItems.map(item => (
            <EvidenceCard key={item.id} item={item} allegations={allegations} />
          ))}
        </div>
      </div>
    </main>
  );
}
