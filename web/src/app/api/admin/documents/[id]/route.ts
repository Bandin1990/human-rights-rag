import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createEmbeddings, embeddingToHalfvec } from "@/lib/embeddings";
import { getAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const accessScopes = new Set(["public", "internal", "restricted"]);
const statuses = new Set([
  "draft",
  "pending_review",
  "approved",
  "processing",
  "published",
  "archived",
  "failed",
]);
const languages = new Set(["th", "en", "th-en"]);

type RouteContext = { params: Promise<{ id: string }> };
type SectionInput = {
  id?: unknown;
  sectionIndex?: unknown;
  pageNumber?: unknown;
  anchor?: unknown;
  heading?: unknown;
  content?: unknown;
  language?: unknown;
};

type ExistingSection = {
  id: string;
  section_index: number;
  page_number: number | null;
  anchor: string | null;
  heading: string;
  content: string;
  language: string;
  metadata: Record<string, unknown> | null;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown) {
  const valueText = text(value);
  return valueText || null;
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeCategories(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(text).filter(Boolean))].slice(0, 50);
}

async function loadDocument(id: string) {
  const supabase = getAdminSupabaseClient();
  if (!supabase) return { error: "Server missing SUPABASE_SECRET_KEY", status: 500 } as const;

  const [documentResult, sectionsResult, filesResult] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id,title,summary,document_type,document_number,publication_year,buddhist_year,published_at,source_organization,source_system,source_url,authority_level,language,rights_categories,file_formats,page_count,access_scope,status,featured,verified_at,created_at,updated_at",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("document_sections")
      .select("id,section_index,page_number,anchor,heading,content,language,metadata")
      .eq("document_id", id)
      .order("section_index", { ascending: true }),
    supabase
      .from("document_files")
      .select("id,file_format,storage_provider,storage_key,mime_type,byte_size,checksum,is_primary,created_at")
      .eq("document_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const error = documentResult.error || sectionsResult.error || filesResult.error;
  if (error) return { error: error.message, status: 500 } as const;
  if (!documentResult.data) return { error: "ไม่พบเอกสาร", status: 404 } as const;

  return {
    data: {
      document: documentResult.data,
      sections: sectionsResult.data || [],
      files: filesResult.data || [],
    },
  } as const;
}

export async function GET(_request: Request, { params }: RouteContext) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await loadDocument(id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const supabase = getAdminSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Server missing SUPABASE_SECRET_KEY" }, { status: 500 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const title = text(body.title);
    const summary = text(body.summary);
    const documentType = text(body.documentType);
    const sourceOrganization = text(body.sourceOrganization);
    const sourceSystem = text(body.sourceSystem);
    const authorityLevel = text(body.authorityLevel);
    const accessScope = text(body.accessScope);
    const status = text(body.status);
    const language = text(body.language) || "th";
    const buddhistYear = optionalNumber(body.buddhistYear);
    const rawSections = Array.isArray(body.sections) ? (body.sections as SectionInput[]) : [];

    if (!title || !documentType || !sourceOrganization || !sourceSystem || !authorityLevel) {
      return NextResponse.json({ error: "กรุณากรอกข้อมูลเอกสารที่จำเป็นให้ครบ" }, { status: 400 });
    }
    if (!accessScopes.has(accessScope) || !statuses.has(status) || !languages.has(language)) {
      return NextResponse.json({ error: "ระดับการเข้าถึง สถานะ หรือภาษาไม่ถูกต้อง" }, { status: 400 });
    }
    if (buddhistYear !== null && (!Number.isInteger(buddhistYear) || buddhistYear < 2400 || buddhistYear > 2700)) {
      return NextResponse.json({ error: "ปี พ.ศ. ต้องอยู่ระหว่าง 2400–2700" }, { status: 400 });
    }
    if (!rawSections.length || rawSections.length > 500) {
      return NextResponse.json({ error: "เอกสารต้องมีอย่างน้อย 1 ส่วน และไม่เกิน 500 ส่วน" }, { status: 400 });
    }

    const [documentResult, sectionsResult] = await Promise.all([
      supabase.from("documents").select("id,title").eq("id", id).maybeSingle(),
      supabase
        .from("document_sections")
        .select("id,section_index,page_number,anchor,heading,content,language,metadata")
        .eq("document_id", id)
        .order("section_index", { ascending: true }),
    ]);
    if (documentResult.error || sectionsResult.error) {
      return NextResponse.json(
        { error: documentResult.error?.message || sectionsResult.error?.message },
        { status: 500 },
      );
    }
    if (!documentResult.data) return NextResponse.json({ error: "ไม่พบเอกสาร" }, { status: 404 });

    const existingSections = (sectionsResult.data || []) as ExistingSection[];
    const existingById = new Map(existingSections.map((section) => [section.id, section]));
    const sectionIndexes = new Set<number>();
    const usedIds = new Set<string>();
    const normalizedSections = rawSections.map((section, arrayIndex) => {
      const requestedId = text(section.id);
      const existing = requestedId ? existingById.get(requestedId) : undefined;
      const sectionId = existing?.id || `${id}-s-${randomUUID()}`;
      const sectionIndexValue = optionalNumber(section.sectionIndex);
      const sectionIndex = sectionIndexValue === null ? arrayIndex : sectionIndexValue;
      const pageNumber = optionalNumber(section.pageNumber);
      const heading = text(section.heading);
      const content = text(section.content);
      const sectionLanguage = text(section.language) || language;

      if (!Number.isInteger(sectionIndex) || sectionIndex < 0 || sectionIndexes.has(sectionIndex)) {
        throw new Error("ลำดับส่วนของเอกสารไม่ถูกต้องหรือซ้ำกัน");
      }
      if (pageNumber !== null && (!Number.isInteger(pageNumber) || pageNumber < 1)) {
        throw new Error("เลขหน้าต้องเป็นจำนวนเต็มที่มากกว่า 0");
      }
      if (!content) throw new Error(`ส่วนที่ ${arrayIndex + 1} ยังไม่มีเนื้อหา`);
      if (!languages.has(sectionLanguage)) throw new Error(`ภาษาของส่วนที่ ${arrayIndex + 1} ไม่ถูกต้อง`);
      if (usedIds.has(sectionId)) throw new Error("พบส่วนของเอกสารซ้ำกัน");

      sectionIndexes.add(sectionIndex);
      usedIds.add(sectionId);
      return {
        id: sectionId,
        existing,
        section_index: sectionIndex,
        page_number: pageNumber,
        anchor: optionalText(section.anchor),
        heading,
        content,
        language: sectionLanguage,
        metadata: existing?.metadata || { edited_manually: true },
      };
    });

    const titleChanged = documentResult.data.title !== title;
    const changedSections = normalizedSections.filter(
      (section) =>
        titleChanged ||
        !section.existing ||
        section.existing.heading !== section.heading ||
        section.existing.content !== section.content ||
        section.existing.language !== section.language,
    );
    const embeddings = await createEmbeddings(
      changedSections.map((section) => `${title}\n${section.heading}\n${section.content}`),
    );
    const embeddingById = new Map(
      changedSections.map((section, index) => [section.id, embeddingToHalfvec(embeddings[index])]),
    );

    const sectionRows = normalizedSections.map((section) => ({
      id: section.id,
      document_id: id,
      section_index: section.section_index,
      page_number: section.page_number,
      anchor: section.anchor,
      heading: section.heading,
      content: section.content,
      language: section.language,
      metadata: section.metadata,
      ...(embeddingById.has(section.id) ? { embedding: embeddingById.get(section.id) } : {}),
    }));
    const sectionSave = await supabase.from("document_sections").upsert(sectionRows, { onConflict: "id" });
    if (sectionSave.error) return NextResponse.json({ error: sectionSave.error.message }, { status: 500 });

    const removedIds = existingSections.filter((section) => !usedIds.has(section.id)).map((section) => section.id);
    if (removedIds.length) {
      const removed = await supabase.from("document_sections").delete().eq("document_id", id).in("id", removedIds);
      if (removed.error) return NextResponse.json({ error: removed.error.message }, { status: 500 });
    }

    const pageCount = normalizedSections.filter((section) => section.page_number !== null).length || normalizedSections.length;
    const documentUpdate = await supabase
      .from("documents")
      .update({
        title,
        summary,
        document_type: documentType,
        document_number: optionalText(body.documentNumber),
        publication_year: buddhistYear ? buddhistYear - 543 : null,
        buddhist_year: buddhistYear,
        published_at: optionalText(body.publishedAt),
        source_organization: sourceOrganization,
        source_system: sourceSystem,
        source_url: optionalText(body.sourceUrl),
        authority_level: authorityLevel,
        language,
        rights_categories: normalizeCategories(body.rightsCategories),
        page_count: pageCount,
        access_scope: accessScope,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (documentUpdate.error) return NextResponse.json({ error: documentUpdate.error.message }, { status: 500 });

    return NextResponse.json({ ok: true, documentId: id, sections: normalizedSections.length, reindexedSections: changedSections.length });
  } catch (error) {
    console.error("Document update failed", error);
    const message = error instanceof Error ? error.message : "บันทึกเอกสารไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
