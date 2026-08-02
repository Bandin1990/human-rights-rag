/**
 * AI-suggested legal references for a case note (see src/lib/nhrc/legal-refs.ts).
 * The case detail page calls the shared function directly server-side;
 * this route exists for client-side refresh/retry if needed later.
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
