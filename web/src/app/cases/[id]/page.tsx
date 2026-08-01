import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, LockKeyhole } from "lucide-react";
import { CaseWorkspace } from "@/components/cases/case-workspace";
import { getCaseActor } from "@/lib/cases/auth";
import { classificationLabels, complaintStatusLabels } from "@/lib/cases/presentation";
import { getComplaintCase } from "@/lib/cases/repository";

export const dynamic = "force-dynamic";

export default async function CasePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const actor = await getCaseActor();
  if (!actor) redirect("/cases/login");
  const { id } = await params;
  const s = await searchParams;
  const initialTab = (s.tab as any) || "overview";
  const complaint = await getComplaintCase(id);
  if (!complaint) notFound();
  return (
    <main className="case-app case-detail-page">
      <div className="case-container">
        <Link href="/cases" className="case-back"><ChevronLeft size={16} /> กลับหน้ารายการงาน</Link>
        <header className="case-detail-heading">
          <div>
            <div className="case-title-meta"><span className={`case-status status-${complaint.status}`}>{complaintStatusLabels[complaint.status]}</span><span>{complaint.referenceNo}</span></div>
            <h1>{complaint.title}</h1>
            <p>{complaint.summary}</p>
          </div>
          <div className="classification-card"><LockKeyhole size={18} /><span>ชั้นข้อมูล<b>{classificationLabels[complaint.classification]}</b></span></div>
        </header>
        <CaseWorkspace complaint={complaint} actor={actor} initialTab={initialTab} />
      </div>
    </main>
  );
}
