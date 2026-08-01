import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Server missing SUPABASE_SECRET_KEY" }, { status: 500 });

  const { data, error } = await supabase
    .from("documents")
    .select("id,title,summary,status,access_scope,document_type,rights_categories,buddhist_year,page_count,updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const id =
    typeof payload === "object" && payload !== null && "id" in payload
      ? (payload as { id?: unknown }).id
      : undefined;
  if (typeof id !== "string" || !id.trim()) return NextResponse.json({ error: "Missing document id" }, { status: 400 });
  const supabase = getAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Server missing SUPABASE_SECRET_KEY" }, { status: 500 });
  const { data: files, error: fileLookupError } = await supabase
    .from("document_files")
    .select("storage_key")
    .eq("document_id", id)
    .eq("storage_provider", "supabase");
  if (fileLookupError) return NextResponse.json({ error: fileLookupError.message }, { status: 500 });
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let cleanupWarning: string | undefined;
  if (files?.length) {
    const cleanup = await supabase.storage
      .from("human-rights-source-files")
      .remove(files.map((file) => file.storage_key));
    if (cleanup.error) cleanupWarning = cleanup.error.message;
  }
  return NextResponse.json({ ok: true, cleanupWarning });
}
