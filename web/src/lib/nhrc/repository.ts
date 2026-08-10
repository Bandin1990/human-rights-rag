/**
 * NHRC Knowledge Base Repository
 *
 * Shared access to the structured index built by setup_obsidian_index.py
 * (data/nhrc_index.json + data/nhrc_content/<document_id>.txt). Used by the
 * search/case/stats API routes and by the case detail page, so there's one
 * place that knows how the index is laid out on disk.
 */
import * as fs from "fs";
import * as path from "path";
import type { Facet, GraphData, NhrcDocument, SearchQuery, Statistics } from "./types";

// Re-exported so existing server-side imports from "@/lib/nhrc/repository"
// keep working unchanged. Client components must import from "./types"
// directly - importing this file pulls in `fs`/`path` and breaks the build.
export type { Facet, GraphData, NhrcDocument, SearchQuery, Statistics };
export { DOCUMENT_CATEGORIES } from "./types";

// Counts how many of the given docs have each distinct value of `pick`,
// descending by count - used by search()'s facets. Docs with no value for
// this dimension (undefined) are excluded rather than counted as a fake
// "ไม่ระบุ" bucket, since most categories don't use sub_type/result at all.
function countBy(docs: NhrcDocument[], pick: (doc: NhrcDocument) => string | undefined): Facet[] {
  const counts = new Map<string, number>();
  for (const doc of docs) {
    const value = pick(doc);
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

class NhrcRepository {
  private documents: NhrcDocument[] = [];
  private indexPath: string;
  private contentDir: string;
  private documentsDir: string;
  private graphPath: string;
  private driveMapPath: string;
  private driveMap: Record<string, string> | null = null;

  constructor() {
    this.indexPath =
      process.env.NHRC_INDEX_PATH ??
      path.join(process.cwd(), "..", "data", "nhrc_index.json");
    this.contentDir =
      process.env.NHRC_CONTENT_DIR ??
      path.join(process.cwd(), "..", "data", "nhrc_content");
    this.documentsDir =
      process.env.NHRC_DOCUMENTS_DIR ??
      path.join(process.cwd(), "..", "data", "nhrc_documents");
    this.graphPath =
      process.env.NHRC_GRAPH_PATH ??
      path.join(process.cwd(), "..", "data", "nhrc_graph.json");
    this.driveMapPath =
      process.env.NHRC_PDF_DRIVE_MAP_PATH ??
      path.join(process.cwd(), "..", "data", "nhrc_pdf_drive_map.json");
    this.loadIndex();
  }

  // Topic-map graph (see setup_obsidian_index.py's _export_graph) - read on
  // demand rather than cached at construction, since it's only used by one
  // page and there's no benefit to holding it in memory otherwise.
  getGraph(): GraphData | null {
    try {
      if (fs.existsSync(this.graphPath)) {
        return JSON.parse(fs.readFileSync(this.graphPath, "utf-8"));
      }
    } catch (error) {
      console.error("Failed to load NHRC graph:", error);
    }
    return null;
  }

  private loadIndex() {
    try {
      if (fs.existsSync(this.indexPath)) {
        this.documents = JSON.parse(fs.readFileSync(this.indexPath, "utf-8"));
      }
    } catch (error) {
      console.error("Failed to load NHRC index:", error);
      this.documents = [];
    }
  }

  // Full text lives in one file per document, read on demand.
  loadContent(documentId: string): string | undefined {
    try {
      const filePath = path.join(this.contentDir, `${documentId}.txt`);
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, "utf-8");
      }
    } catch (error) {
      console.error("Failed to load NHRC content:", error);
    }
    return undefined;
  }

  search(query: SearchQuery) {
    let results = [...this.documents];

    if (query.areaCode && query.areaCode !== "all") {
      results = results.filter((doc) => doc.area_code === query.areaCode);
    }
    if (query.yearBuddhist) {
      results = results.filter((doc) => doc.year_buddhist === query.yearBuddhist);
    }
    if (query.docType && query.docType !== "all") {
      results = results.filter((doc) => doc.document_type === query.docType);
    }
    if (query.category) {
      results = results.filter((doc) => doc.category === query.category);
    }
    if (query.topicId) {
      results = results.filter((doc) => doc.topic_ids?.includes(query.topicId!));
    }
    if (query.query) {
      const q = query.query.toLowerCase();
      results = results.filter(
        (doc) =>
          doc.title.toLowerCase().includes(q) ||
          doc.keywords.some((kw) => kw.toLowerCase().includes(q))
      );
    }

    // Facets describe the sub_type/result filter chips for whatever category/
    // area/year/query is currently selected (see nhrc-workspace.tsx's browse
    // mode) - computed from `results` *before* the subType/result filters
    // below are applied, each against the set that ignores only its own
    // dimension, so switching one facet's selection doesn't hide the other
    // facet's other options. Empty when a category has no sub_type/result at
    // all (e.g. งานวิจัย) - the UI simply doesn't render a filter group then.
    const preSubTypeFilter = query.result ? results.filter((doc) => doc.result === query.result) : results;
    const preResultFilter = query.subType ? results.filter((doc) => doc.sub_type === query.subType) : results;
    const facets = {
      subType: countBy(preSubTypeFilter, (doc) => doc.sub_type),
      result: countBy(preResultFilter, (doc) => doc.result),
    };

    if (query.subType) {
      results = results.filter((doc) => doc.sub_type === query.subType);
    }
    if (query.result) {
      results = results.filter((doc) => doc.result === query.result);
    }

    results.sort((a, b) => {
      if (a.document_type === "case_note" && b.document_type !== "case_note") return -1;
      if (a.document_type !== "case_note" && b.document_type === "case_note") return 1;
      return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
    });

    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const total = results.length;

    return {
      data: results.slice(offset, offset + limit),
      pagination: { total, limit, offset, hasMore: offset + limit < total },
      facets,
    };
  }

  getStats(): Statistics {
    const stats: Statistics = {
      totalDocuments: this.documents.length,
      byType: {},
      byArea: {},
      byCategory: {},
      casesByYear: {},
      topKeywords: [],
      recentCases: [],
    };

    const keywordCounts: Record<string, number> = {};
    for (const doc of this.documents) {
      stats.byType[doc.document_type] = (stats.byType[doc.document_type] || 0) + 1;
      if (doc.area_code) {
        stats.byArea[doc.area_code] = (stats.byArea[doc.area_code] || 0) + 1;
      }
      if (doc.category) {
        stats.byCategory[doc.category] = (stats.byCategory[doc.category] || 0) + 1;
      }
      if (doc.document_type === "case_note" && doc.year_buddhist) {
        stats.casesByYear[doc.year_buddhist] = (stats.casesByYear[doc.year_buddhist] || 0) + 1;
      }
      for (const kw of doc.keywords) {
        keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
      }
    }

    stats.topKeywords = Object.entries(keywordCounts)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    stats.recentCases = this.documents
      .filter((doc) => doc.document_type === "case_note")
      .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
      .slice(0, 10);

    return stats;
  }

  // Looks up by case_id first (the "128-2563" style ID case notes use), then
  // falls back to document_id - documents without a case_id (situation
  // reports, topics, research docs) are only reachable this way.
  //
  // Also tries the id percent-decoded: document_ids built from non-ASCII
  // titles (research docs) come back from Next's dynamic route params still
  // percent-encoded rather than decoded, so a raw === match against the
  // Thai document_id never succeeds unless we decode first.
  getCaseById(id: string): NhrcDocument | null {
    let decoded = id;
    try {
      decoded = decodeURIComponent(id);
    } catch {
      // not valid percent-encoding - fall back to the raw id below
    }
    return (
      this.documents.find(
        (doc) =>
          doc.case_id === id ||
          doc.document_id === id ||
          doc.case_id === decoded ||
          doc.document_id === decoded
      ) || null
    );
  }

  getCaseWithContent(id: string): (NhrcDocument & { content?: string }) | null {
    const doc = this.getCaseById(id);
    if (!doc) return null;
    return { ...doc, content: this.loadContent(doc.document_id) };
  }

  // Path to the source PDF for a document, if one was found and copied in by
  // setup_obsidian_index.py. Returns null (not an error) when there's none -
  // most case notes have a scan, but not all, and non-case documents vary.
  getSourcePdfPath(documentId: string): string | null {
    const filePath = path.join(this.documentsDir, `${documentId}.pdf`);
    return fs.existsSync(filePath) ? filePath : null;
  }

  // Google Drive file ID for a document's source PDF, for environments
  // (production) where data/nhrc_documents/ isn't on disk - see
  // scripts/upload_pdfs_to_drive.py and lib/nhrc/drive.ts. Falls back to
  // null (not an error) the same way getSourcePdfPath does.
  getDrivePdfFileId(documentId: string): string | null {
    if (this.driveMap === null) {
      try {
        this.driveMap = fs.existsSync(this.driveMapPath)
          ? JSON.parse(fs.readFileSync(this.driveMapPath, "utf-8"))
          : {};
      } catch (error) {
        console.error("Failed to load NHRC PDF Drive map:", error);
        this.driveMap = {};
      }
    }
    const map = this.driveMap ?? {};
    return map[documentId] ?? null;
  }

  // Naive keyword-overlap ranking for the "ask a question" flow: no embeddings
  // available locally, so score by how many of each case's curated keywords
  // (and its title) literally appear in the question text.
  //
  // Searches every document_type on purpose - not just case_note - so
  // situation reports, research (general), and any type added later are
  // all reachable without another code change here. Filter by scope only -
  // except "topic" ("02 ประเด็นสิทธิ" area/topic overview notes, e.g.
  // "[A] สิทธิพลเมืองฯ"), which power the /knowledge/graph node labels but
  // aren't official documents (no case number, no law citation, no source
  // PDF) - Ask NHRC shouldn't search or cite them as if they were. The
  // primary (semantic search) path is excluded the same way in
  // embed-nhrc-documents.mjs, which never embeds them in the first place.
  findRelevantCases(
    question: string,
    limit: number = 5,
    scope: { areaCode?: string; category?: string } = {}
  ): NhrcDocument[] {
    const q = question.toLowerCase();
    const pool = this.documents.filter((doc) => {
      if (doc.document_type === "topic") return false;
      if (scope.areaCode && doc.area_code !== scope.areaCode) return false;
      if (scope.category && doc.category !== scope.category) return false;
      return true;
    });

    const scored = pool
      .map((doc) => {
        let score = 0;
        if (doc.title && q.includes(doc.title.toLowerCase())) score += 5;
        for (const kw of doc.keywords) {
          if (kw.length >= 2 && q.includes(kw.toLowerCase())) score += 2;
        }
        return { doc, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      return scored.slice(0, limit).map((s) => s.doc);
    }

    // No keyword overlap at all - fall back to plain title/keyword substring search
    // within the same scope (still every document_type, same reasoning as above).
    return this.search({
      query: question,
      areaCode: scope.areaCode,
      category: scope.category,
      limit,
    }).data;
  }

  getRelatedCases(caseId: string, limit: number = 10): NhrcDocument[] {
    return this.getRelatedDocuments(caseId, "case_note", limit);
  }

  // Same keyword/area/year-overlap ranking as getRelatedCases, generalized to
  // any document_type - used for "งานวิจัย" docs too, which have no case_id
  // (matched by document_id instead) and no area_code (that term just always
  // scores 0 for them, keyword/year overlap still applies).
  //
  // document_type alone isn't specific enough for "general" docs: research,
  // Thai law, international instruments, court judgments, and knowledge-base
  // notes all share document_type "general" (see DOCUMENT_CATEGORIES), so
  // without also filtering by `category`, viewing an instrument could pull
  // in a Thai law or research doc as a "related" match purely on keyword
  // overlap - content that's plausible but from the wrong shelf, and a caller
  // showing a single category-specific heading (e.g. "งานวิจัยที่เกี่ยวข้อง")
  // would then be mislabeling whatever came back. Pass `category` whenever
  // the source document has one to keep the two in sync.
  getRelatedDocuments(
    documentId: string,
    docType: NhrcDocument["document_type"],
    limit: number = 10,
    category?: string
  ): NhrcDocument[] {
    const source = this.getCaseById(documentId);
    if (!source) return [];

    // Curated topic_tags (see types.ts) are a deliberate, human-picked
    // relatedness signal - when the source doc has any, require an actual
    // topic overlap instead of falling back to `keywords`, which also holds
    // generic tokenized words ("กฎหมาย", "สิทธิ", "พ.ศ") that collide across
    // unrelated documents in the same category and used to make "related
    // documents" (worst for งานวิจัย) mostly noise. Docs/categories with no
    // topic_tags at all (undefined or []) keep the old keyword-overlap
    // behavior unchanged.
    const sourceTopics = new Set(source.topic_tags ?? []);
    const sourceKeywords = new Set(source.keywords);

    const related = this.documents.filter((doc) => {
      if (doc.document_id === source.document_id) return false;
      if (doc.document_type !== docType) return false;
      if (category && doc.category !== category) return false;
      const areaMatch = !!source.area_code && doc.area_code === source.area_code;
      const yearMatch = !!(source.year && doc.year && Math.abs(source.year - doc.year) <= 2);
      if (sourceTopics.size > 0) {
        const topicMatch = (doc.topic_tags ?? []).some((t) => sourceTopics.has(t));
        return topicMatch || areaMatch || yearMatch;
      }
      const keywordMatch = source.keywords.some((kw) => doc.keywords.includes(kw));
      return areaMatch || keywordMatch || yearMatch;
    });

    related.sort((a, b) => {
      const score = (doc: NhrcDocument) => {
        let s = source.area_code && doc.area_code === source.area_code ? 3 : 0;
        // Each shared curated topic tag outweighs any number of shared
        // generic keywords - it's the signal we actually trust.
        s += (doc.topic_tags ?? []).filter((t) => sourceTopics.has(t)).length * 5;
        s += doc.keywords.filter((kw) => sourceKeywords.has(kw)).length;
        return s;
      };
      return score(b) - score(a);
    });

    return related.slice(0, limit);
  }

  getCasesByArea(areaCode: string, limit: number = 20): NhrcDocument[] {
    return this.documents
      .filter((doc) => doc.area_code === areaCode && doc.document_type === "case_note")
      .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
      .slice(0, limit);
  }
}

let repository: NhrcRepository | null = null;

export function getNhrcRepository(): NhrcRepository {
  if (!repository) {
    repository = new NhrcRepository();
  }
  return repository;
}
