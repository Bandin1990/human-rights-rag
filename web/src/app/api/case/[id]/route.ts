/**
 * Case Details API Route
 * Get case by ID and related cases
 */

import { NextRequest, NextResponse } from "next/server";
import { getNhrcRepository } from "@/lib/nhrc/repository";

// GET: Get case by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const repo = getNhrcRepository();
    const caseDoc = repo.getCaseWithContent(caseId);

    if (!caseDoc) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const related = repo.getRelatedCases(caseId, 10);
    const sameArea = repo.getCasesByArea(caseDoc.area_code || "A", 10);

    return NextResponse.json({
      success: true,
      case: caseDoc,
      related: {
        byKeywords: related,
        byArea: sameArea.filter((c) => c.case_id !== caseId),
      },
    });
  } catch (error) {
    console.error("Get case error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get case" },
      { status: 500 }
    );
  }
}
