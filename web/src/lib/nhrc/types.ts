/**
 * Client-safe types and constants for the NHRC knowledge base.
 * No Node built-ins here (no `fs`/`path`) - this file is imported by both
 * server code (repository.ts) and client components (nhrc-workspace.tsx),
 * and pulling fs/path into a client bundle breaks the build.
 */

// Fixed document-category taxonomy shown in the UI filter. Only the first
// two currently have vault content; the rest are placeholders for document
// sets the user plans to add to Obsidian later (see HANDOFF.md).
export const DOCUMENT_CATEGORIES = [
  "รายงานตรวจสอบ/ข้อเสนอแนะ กสม.",
  "งานวิจัย",
  "รายงานประเมินสถานการณ์",
  "กฎหมายสิทธิมนุษยชนระหว่างประเทศและเอกสารตีความ",
  "คลังความรู้ด้านสิทธิมนุษยชน",
  "กฎหมายไทย",
  "คำพิพากษาศาลต่างประเทศ",
  "คำพิพากษาศาลไทย",
] as const;

export interface NhrcDocument {
  document_id: string;
  case_id?: string;
  title: string;
  document_type: "case_note" | "topic" | "project" | "general" | "situation_report";
  category?: string;
  area_code?: string;
  area_name?: string;
  year?: number;
  year_buddhist?: number;
  keywords: string[];
  summary?: string;
  file_name: string;
  page_count: number;
  uploaded_at: string;
  // Case notes only - topic document_ids this case is filed under in
  // "02 ประเด็นสิทธิ" (see obsidian_parser.py's case_topic_index). Powers the
  // topic-map graph's "show cases for this topic" filter.
  topic_ids?: string[];
}

export interface SearchQuery {
  query?: string;
  areaCode?: string;
  yearBuddhist?: number;
  docType?: "case_note" | "topic" | "project" | "general" | "situation_report" | "all";
  category?: string;
  topicId?: string;
  limit?: number;
  offset?: number;
}

export interface GraphNode {
  id: string;
  type: "area" | "topic";
  label: string;
  areaCode?: string;
  count: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "hierarchy" | "shared_cases";
  weight?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Statistics {
  totalDocuments: number;
  byType: Record<string, number>;
  byArea: Record<string, number>;
  byCategory: Record<string, number>;
  casesByYear: Record<number, number>;
  topKeywords: { keyword: string; count: number }[];
  recentCases: NhrcDocument[];
}
