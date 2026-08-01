import { redirect } from "next/navigation";
import { CaseDashboard } from "@/components/cases/case-dashboard";
import { getCaseActor } from "@/lib/cases/auth";
import { listComplaintCases } from "@/lib/cases/repository";

export const dynamic = "force-dynamic";

export default async function CasesPage() {
  const actor = await getCaseActor();
  if (!actor) redirect("/cases/login");
  const cases = await listComplaintCases();
  return <main className="case-app"><CaseDashboard cases={cases} actor={actor} /></main>;
}
