/**
 * Hybrid Search API Route
 * Structured search over the NHRC case-note index (see src/lib/nhrc/repository.ts)
 */

import { NextRequest, NextResponse } from "next/server";
import { getNhrcRepository, SearchQuery } from "@/lib/nhrc/repository";

function buildQuery(searchParams: URLSearchParams): SearchQuery {
  return {
    query: searchParams.get("q") || undefined,
    areaCode: searchParams.get("area") || undefined,
    yearBuddhist: searchParams.get("year") ? parseInt(searchParams.get("year")!) : undefined,
    docType: (searchParams.get("type") || "all") as SearchQuery["docType"],
    category: searchParams.get("category") || undefined,
    topicId: searchParams.get("topic") || undefined,
    limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20,
    offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : 0,
  };
}

// GET: Search with query parameters
export async function GET(request: NextRequest) {
  try {
    const repo = getNhrcRepository();
    const results = repo.search(buildQuery(request.nextUrl.searchParams));

    return NextResponse.json({
      success: true,
      data: results.data,
      pagination: results.pagination,
      stats: repo.getStats(),
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ success: false, error: "Search failed" }, { status: 500 });
  }
}

// POST: Search with JSON body
export async function POST(request: NextRequest) {
  try {
    const query: SearchQuery = await request.json();
    const repo = getNhrcRepository();
    const results = repo.search(query);

    return NextResponse.json({
      success: true,
      data: results.data,
      pagination: results.pagination,
      stats: repo.getStats(),
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ success: false, error: "Search failed" }, { status: 500 });
  }
}
