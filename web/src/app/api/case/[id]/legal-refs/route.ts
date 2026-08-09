/**
 * AI-suggested legal references for a case note (see src/lib/nhrc/legal-refs.ts).
 *
 * Fetched client-side by components/legal-refs-box.tsx, not awaited in
 * case/[id]/page.tsx's server render - getLegalRefs() makes a live Claude
 * API call plus an external OpenThai lookup on every cache-miss, and
 * blocking the whole page behind that (previously several seconds on a
 * cold cache) is exactly the "ข้อมูลแสดงช้ามาก" the user reported.
 */
import { NextResponse } from "next/server";
import { getLegalRefs } from "@/lib/nhrc/legal-refs";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getLegalRefs(id);
  if (!result) {
    return NextResponse.json({ success: false, error: "AI unavailable" });
  }
  return NextResponse.json({ success: true, data: result });
}
