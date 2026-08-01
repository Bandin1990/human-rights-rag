import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getAdminSupabaseClient } from "@/lib/supabase/admin";

const allowedStatuses = new Set([
  "draft",
  "pending_review",
  "approved",
  "processing",
  "published",
  "archived",
  "failed",
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let status = "";
  try {
    const body = (await req.json()) as { status?: unknown };
    status = typeof body.status === "string" ? body.status : "";
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  if (!allowedStatuses.has(status)) {
    return NextResponse.json({ error: "สถานะเอกสารไม่ถูกต้อง" }, { status: 400 });
  }

  const updateData: {
    status: string;
    published_at?: string;
    updated_at: string;
  } = { status, updated_at: new Date().toISOString() };
  if (status === "published") updateData.published_at = new Date().toISOString();

  const supabase = getAdminSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server missing Supabase configuration" }, { status: 500 });
  }

  const { error } = await supabase
    .from("documents")
    .update(updateData)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status });
}
