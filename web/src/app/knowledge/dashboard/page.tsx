import { StatsDashboard } from "@/components/dashboard/StatsDashboard";

export const metadata = {
  title: "สถิติ - NHRC RAG",
  description: "สถิติฐานความรู้สิทธิมนุษยชน",
};

export default function DashboardPage() {
  return <StatsDashboard />;
}
