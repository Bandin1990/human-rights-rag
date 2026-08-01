import { redirect } from "next/navigation";
import { ExecutiveDashboard } from "@/components/cases/executive-dashboard";
import { getCaseActor } from "@/lib/cases/auth";
import { listComplaintCases } from "@/lib/cases/repository";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const actor = await getCaseActor();
  if (!actor) redirect("/cases/login");
  const cases = await listComplaintCases();
  return <main className="case-app"><ExecutiveDashboard cases={cases} actor={actor} /></main>;
}
