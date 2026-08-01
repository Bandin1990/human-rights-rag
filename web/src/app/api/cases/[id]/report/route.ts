import { NextResponse } from "next/server";
import { canEditReport, getCaseActor } from "@/lib/cases/auth";
import { getComplaintCase, saveReport } from "@/lib/cases/repository";
import { REPORT_SECTION_DEFINITIONS, ReportSaveInput, ReportSection } from "@/types/case";

export const runtime = "nodejs";

const OUTCOMES = ["pending", "violation", "no_violation", "terminated"];
const SECTION_KEYS = new Set(REPORT_SECTION_DEFINITIONS.map((section) => section.key));

function parseSections(value: unknown): ReportSection[] | null {
  if (!Array.isArray(value) || value.length !== REPORT_SECTION_DEFINITIONS.length) return null;
  const sections: ReportSection[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    if (typeof row.key !== "string" || !SECTION_KEYS.has(row.key as ReportSection["key"]) || typeof row.content !== "string" || row.content.length > 40_000 || !Array.isArray(row.citations)) return null;
    const definition = REPORT_SECTION_DEFINITIONS.find((section) => section.key === row.key)!;
    const citations = row.citations.flatMap((citation) => {
      if (!citation || typeof citation !== "object") return [];
      const c = citation as Record<string, unknown>;
      if (![c.documentId, c.sectionId, c.title, c.excerpt].every((field) => typeof field === "string" && field.length > 0)) return [];
      return [{
        documentId: String(c.documentId),
        sectionId: String(c.sectionId),
        title: String(c.title),
        excerpt: String(c.excerpt).slice(0, 1_500),
        page: typeof c.page === "number" ? c.page : undefined,
        anchor: typeof c.anchor === "string" ? c.anchor : undefined,
        sourceUrl: typeof c.sourceUrl === "string" ? c.sourceUrl : undefined,
      }];
    });
    sections.push({ id: typeof row.id === "string" ? row.id : `section-${definition.key}`, ...definition, content: row.content.trim(), citations });
  }
  return sections;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getCaseActor();
    if (!actor) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    if (!canEditReport(actor)) return NextResponse.json({ error: "บทบาทของคุณไม่มีสิทธิแก้ไขรายงาน" }, { status: 403 });
    const { id } = await params;
    if (!(await getComplaintCase(id))) return NextResponse.json({ error: "ไม่พบสำนวนหรือคุณไม่มีสิทธิเข้าถึง" }, { status: 404 });

    const body = (await request.json()) as Record<string, unknown>;
    const sections = parseSections(body.sections);
    const outcome = typeof body.outcome === "string" && OUTCOMES.includes(body.outcome) ? body.outcome as ReportSaveInput["outcome"] : null;
    const intent = ["draft", "submit_to_head", "submit_to_director", "submit_to_exec", "submit_to_comm", "approve_final", "revise"].includes(body.intent as string) ? body.intent as ReportSaveInput["intent"] : null;
    if (!sections || !outcome || !intent) return NextResponse.json({ error: "รูปแบบรายงานไม่ถูกต้อง" }, { status: 400 });

    if (intent !== "draft" && intent !== "revise") {
      const missing = sections.filter((section) => section.content.trim().length < 20).map((section) => section.title);
      const legalSection = sections.find((section) => section.key === "legal_framework" || section.key === "nhrc_opinion" || section.key === "proceedings");
      if (missing.length) return NextResponse.json({ error: `ยังส่งตรวจไม่ได้ กรุณาจัดทำส่วน: ${missing.join(", ")}` }, { status: 422 });
      if (!legalSection?.citations.length && (sections.some(s => s.key === "legal_framework" || s.key === "nhrc_opinion" || s.key === "proceedings"))) return NextResponse.json({ error: "กรุณาเพิ่ม citation ในส่วนกฎหมายและหลักสิทธิมนุษยชน" }, { status: 422 });
      if (outcome === "pending") return NextResponse.json({ error: "กรุณาระบุผลการตรวจสอบที่เสนอ ก่อนส่งให้ผู้บังคับบัญชา" }, { status: 422 });
    }

    const report = await saveReport(id, { sections, outcome, intent }, actor.id, actor.name);
    return NextResponse.json(report);
  } catch (error) {
    console.error("Report save failed", error);
    return NextResponse.json({ error: "บันทึกรายงานไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  }
}
