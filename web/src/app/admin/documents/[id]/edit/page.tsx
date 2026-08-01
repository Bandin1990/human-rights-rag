import { AdminDocumentEditor } from "@/components/admin-document-editor";

export const dynamic = "force-dynamic";

export default async function AdminDocumentEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminDocumentEditor documentId={id} />;
}
