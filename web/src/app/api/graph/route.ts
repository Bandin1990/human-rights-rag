/**
 * Serves the topic-map graph (see setup_obsidian_index.py's _export_graph).
 * Static per-run data - areas, topics, case counts - no personal data.
 */
import { NextResponse } from "next/server";
import { getNhrcRepository } from "@/lib/nhrc/repository";

export async function GET() {
  const repo = getNhrcRepository();
  const graph = repo.getGraph();
  if (!graph) {
    return NextResponse.json({ error: "Graph not built yet" }, { status: 404 });
  }
  return NextResponse.json(graph);
}
