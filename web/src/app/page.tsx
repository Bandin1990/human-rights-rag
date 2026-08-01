import { ChatWorkspace } from "@/components/chat-workspace";
import { searchKnowledge } from "@/lib/knowledge/repository";
export const dynamic = "force-dynamic";

export default async function Home() {
  const initial = await searchKnowledge();
  return <ChatWorkspace initial={initial} />;
}
