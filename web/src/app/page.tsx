import { NhrcWorkspace } from "@/components/nhrc-workspace";
import { getNhrcRepository } from "@/lib/nhrc/repository";
export const dynamic = "force-dynamic";

export default async function Home() {
  const repo = getNhrcRepository();
  const initial = repo.search({ docType: "case_note", limit: 30 });
  const byCategory = repo.getStats().byCategory;
  return <NhrcWorkspace initial={initial} byCategory={byCategory} />;
}
