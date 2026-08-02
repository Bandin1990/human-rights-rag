/**
 * Statistics API Route
 * Get index statistics (total documents, by type, by area, by year)
 */

import { NextRequest, NextResponse } from "next/server";
import { getNhrcRepository } from "@/lib/nhrc/repository";

// GET: Get overall statistics
export async function GET(request: NextRequest) {
  try {
    const repo = getNhrcRepository();
    const areaParam = request.nextUrl.searchParams.get("area");

    if (areaParam) {
      const casesInArea = repo.getCasesByArea(areaParam, 1000);
      return NextResponse.json({
        success: true,
        data: {
          totalInArea: casesInArea.length,
          casesInArea: casesInArea.length,
          topCases: casesInArea.slice(0, 5),
        },
      });
    }

    return NextResponse.json({ success: true, data: repo.getStats() });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get statistics" },
      { status: 500 }
    );
  }
}
