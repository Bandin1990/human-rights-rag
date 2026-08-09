import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ChevronLeft, Download, ShieldCheck, Sparkles } from "lucide-react";
import { getNhrcRepository, NhrcDocument } from "@/lib/nhrc/repository";
import { LegalRefsBox, AiCaseSummary } from "@/components/legal-refs-box";

export const dynamic = "force-dynamic";

const AREA_NAMES: Record<string, string> = {
  A: "สิทธิพลเมืองและสิทธิทางการเมือง",
  B: "สิทธิทางเศรษฐกิจ สังคม และวัฒนธรรม",
  C: "สิทธิของกลุ่มบุคคล",
  D: "สถานการณ์เชิงพื้นที่-เฉพาะ",
  E: "เพิ่มเติมจากแท็กซอนอมีเดิม",
};

// "general" document_type covers several very different DOCUMENT_CATEGORIES
// (research, Thai law, international instruments, court judgments,
// knowledge base) - the sidebar's "related documents" heading needs to name
// whichever one the current document actually belongs to, not a hardcoded
// "งานวิจัยที่เกี่ยวข้อง" regardless of what's actually being viewed.
const RELATED_LIST_LABEL: Record<string, string> = {
  "งานวิจัย": "งานวิจัยที่เกี่ยวข้อง",
  "กฎหมายไทย": "กฎหมายไทยที่เกี่ยวข้อง",
  "กฎหมายสิทธิมนุษยชนระหว่างประเทศและเอกสารตีความ": "ตราสาร/เอกสารตีความที่เกี่ยวข้อง",
  "คลังความรู้ด้านสิทธิมนุษยชน": "องค์ความรู้ที่เกี่ยวข้อง",
  "คำพิพากษาศาลไทย": "คำพิพากษาศาลไทยที่เกี่ยวข้อง",
  "คำพิพากษาศาลต่างประเทศ": "คำพิพากษาศาลต่างประเทศที่เกี่ยวข้อง",
};
function relatedListLabel(category?: string): string {
  const base = (category && RELATED_LIST_LABEL[category]) || "เอกสารที่เกี่ยวข้อง";
  return `${base} (คำสำคัญใกล้เคียง)`;
}

// Reading order for a case note's body sections - narrative first (what
// happened), context after. Headings not listed here (there shouldn't be
// any - all 285 case notes use the same six) sort after known ones.
// "ตัวอย่างโจทย์วิจัยที่เป็นไปได้" and "เอกสารต้นฉบับ" are deliberately
// excluded: the former isn't case content, the latter becomes a real PDF
// button instead of a text section.
const SECTION_ORDER = [
  "รายละเอียด",
  "พฤติการณ์ที่วินิจฉัยว่าละเมิด",
  "กลุ่มผู้ถูกละเมิดสิทธิ",
  "ประเด็นสิทธิที่เกี่ยวข้อง",
  "ช่องโหว่ / สาเหตุของการละเมิด",
];
const SECTION_EXCLUDE = new Set(["ตัวอย่างโจทย์วิจัยที่เป็นไปได้", "เอกสารต้นฉบับ"]);

// Case bodies are plain markdown ("# title", "## heading", paragraphs) -
// split into sections, drop the ones we don't want rendered, and reorder
// into a consistent reading order regardless of source order.
function splitSections(content: string): { heading: string; content: string }[] {
  const withoutTitle = content.replace(/^#\s+.*\n?/, "");
  const parts = withoutTitle.split(/\n(?=##\s)/).map((s) => s.trim()).filter(Boolean);

  const sections = parts
    .map((part) => {
      const match = part.match(/^##\s*(.+)/);
      const heading = match ? match[1].trim() : "รายละเอียด";
      const text = part.replace(/^##\s*.+\n?/, "").trim();
      return { heading, content: cleanMarkdown(text) };
    })
    .filter((s) => !SECTION_EXCLUDE.has(s.heading));

  return sections.sort((a, b) => {
    const ai = SECTION_ORDER.indexOf(a.heading);
    const bi = SECTION_ORDER.indexOf(b.heading);
    return (ai === -1 ? SECTION_ORDER.length : ai) - (bi === -1 ? SECTION_ORDER.length : bi);
  });
}

// Strip the light markdown case notes are written in ([[wikilinks]], **bold**)
// down to plain text - this page renders sections as plain <p>, not markdown.
function cleanMarkdown(text: string): string {
  return text
    .replace(/\[\[([^\|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1");
}

// Non-case ("general") docs open with a single bold metadata line, e.g.
// research: "**ปีที่จัดทำ (พ.ศ.):** 2546 · **ประเภท:** วิจัยประยุกต์ · ..."
// or Thai law: "**ปีที่ประกาศใช้ (พ.ศ.):** 2560 · **หน่วยงานที่รับผิดชอบ:** ...".
// Generic across categories on purpose - each document type (research,
// Thai law, international instruments, court judgments, knowledge base;
// see docs/vault-templates/) defines its own field labels, and this just
// reads back whatever "**label:** value" pairs are on that first line
// instead of hardcoding one category's fields. Returns null (not an
// error) for docs that don't have the line - callers fall back to the
// plain-summary view.
type GeneralMetadata = Record<string, string>;
function parseGeneralMetadata(content: string): GeneralMetadata | null {
  const withoutTitle = content.replace(/^#\s+.*\n?/, "");
  const firstLine = withoutTitle.split("\n").find((l) => l.trim().length > 0);
  if (!firstLine || !firstLine.includes("**")) return null;

  const fields: GeneralMetadata = {};
  const pattern = /\*\*([^*]+):\*\*\s*([^·]+)/g;
  let match;
  while ((match = pattern.exec(firstLine)) !== null) {
    fields[match[1].trim()] = match[2].trim();
  }
  return Object.keys(fields).length > 0 ? fields : null;
}

// Reading order for a general doc's own sections - the hand-written
// abstract first (what a reader actually wants), everything else after.
// Headings not listed here (a category-specific field like "มาตราที่
// เกี่ยวข้องกับสิทธิมนุษยชน") just sort after the known ones instead of
// being dropped. "คำสำคัญ" is skipped (shown as tags above); any "ลิงก์..."
// heading is skipped too (shown as a link button instead of a section).
const GENERAL_SECTION_ORDER = [
  "สาระสำคัญ",
  "ประเด็นสิทธิที่วิจัย",
  "ระเบียบวิธีวิจัย",
  // Thai-law / international-instrument headings (see docs/vault-templates/
  // 06-.../07-...) - ordered like a legal brief: substance, then Thailand's
  // obligations, then how it's actually used in NHRC casework.
  "มาตราสำคัญ",
  "พันธกรณีของไทย",
  "ความเชื่อมโยงกับกรณีตรวจสอบของ กสม.",
  "ประเด็นสิทธิที่เกี่ยวข้อง",
  // Always last regardless of where it sits in the source file - an AI-
  // accuracy caveat belongs at the end of the read, not competing with the
  // substance for the reader's attention.
  "หมายเหตุความถูกต้อง",
];
const GENERAL_SECTION_EXCLUDE = new Set(["คำสำคัญ"]);

function splitGeneralSections(content: string): { heading: string; content: string }[] {
  const withoutTitle = content.replace(/^#\s+.*\n?/, "");
  const lines = withoutTitle.split("\n");
  if (lines[0] && lines[0].includes("**")) lines.shift();
  const parts = lines.join("\n").split(/\n(?=##\s)/).map((s) => s.trim()).filter(Boolean);

  const sections = parts
    .map((part) => {
      const match = part.match(/^##\s*(.+)/);
      const heading = match ? match[1].trim() : "";
      const text = part.replace(/^##\s*.+\n?/, "").trim();
      return { heading, content: cleanMarkdown(text) };
    })
    .filter((s) => s.heading && s.content && !GENERAL_SECTION_EXCLUDE.has(s.heading) && !s.heading.startsWith("ลิงก์"));

  return sections.sort((a, b) => {
    const ai = GENERAL_SECTION_ORDER.indexOf(a.heading);
    const bi = GENERAL_SECTION_ORDER.indexOf(b.heading);
    return (ai === -1 ? GENERAL_SECTION_ORDER.length : ai) - (bi === -1 ? GENERAL_SECTION_ORDER.length : bi);
  });
}

// Any "## ลิงก์..." heading (ลิงก์รายงาน, ลิงก์กฎหมายฉบับเต็ม, ลิงก์คำพิพากษาฉบับเต็ม, ...)
// becomes a link button instead of a text section - see GENERAL_SECTION_EXCLUDE above.
function reportLink(content: string): string | null {
  const match = content.match(/##\s*ลิงก์[^\n]*\n([\s\S]*?)(?=\n##\s|$)/);
  if (!match) return null;
  const urlMatch = match[1].match(/https?:\/\/\S+/);
  return urlMatch ? urlMatch[0] : null;
}

function GeneralMetadataBox({ meta }: { meta: GeneralMetadata }) {
  const rows = Object.entries(meta);
  if (rows.length === 0) return null;
  return (
    <div className="cw-legal-refs" style={{ marginTop: 24 }}>
      <div className="cw-legal-refs-head">
        <Sparkles size={15} /> ข้อมูลเอกสาร
      </div>
      {rows.map(([label, value]) => (
        <p key={label} style={{ color: "#d1d5db", fontSize: "0.92rem", margin: "6px 0" }}>
          <b>{label}:</b> {value}
        </p>
      ))}
    </div>
  );
}

function RelatedList({ title, cases }: { title: string; cases: NhrcDocument[] }) {
  if (cases.length === 0) return null;
  return (
    <div className="cw-detail-related">
      <b>{title}</b>
      {cases.map((c) => (
        <Link href={`/case/${c.case_id || c.document_id}`} key={c.document_id} className="cw-detail-related-item">
          {(c.case_id || c.year_buddhist) && <span>{c.case_id || `พ.ศ. ${c.year_buddhist}`}</span>}
          {c.title}
        </Link>
      ))}
    </div>
  );
}

// Case notes/situation reports have an actual PDF scan on disk or Drive -
// served through /api/case/[id]/document. General docs (research, Thai
// law, court judgments, ...) were never digitized as scans; their "source"
// is whatever URL the note's own "## ลิงก์..." section points to (see
// reportLink() and docs/vault-templates/) - externalUrl carries that
// through instead so this button opens the right thing either way.
function SourcePdfLink({ id, available, externalUrl }: { id: string; available: boolean; externalUrl?: string | null }) {
  if (!available) {
    return (
      <span className="cw-pdf-link is-disabled">
        <Download size={16} /> ยังไม่มีไฟล์ต้นฉบับ
      </span>
    );
  }
  return (
    <a className="cw-pdf-link" href={externalUrl || `/api/case/${id}/document`} target="_blank" rel="noopener noreferrer">
      <Download size={16} /> เปิดเอกสารต้นฉบับ
    </a>
  );
}

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getNhrcRepository();
  const caseDoc = repo.getCaseWithContent(id);
  if (!caseDoc) notFound();

  const isCaseNote = caseDoc.document_type === "case_note";
  const isSituationReport = caseDoc.document_type === "situation_report";
  const isGeneral = caseDoc.document_type === "general";

  const related = isCaseNote ? repo.getRelatedCases(id, 10) : [];
  const sameArea = isCaseNote
    ? repo.getCasesByArea(caseDoc.area_code || "", 10).filter((c) => c.case_id !== id)
    : [];
  const otherReports = isSituationReport
    ? repo.search({ docType: "situation_report", limit: 20 }).data.filter((d) => d.document_id !== caseDoc.document_id)
    : [];
  const relatedResearch = isGeneral
    ? repo.getRelatedDocuments(caseDoc.document_id, "general", 10, caseDoc.category)
    : [];
  const sections = isCaseNote ? splitSections(caseDoc.content || "") : [];
  const generalMeta = isGeneral ? parseGeneralMetadata(caseDoc.content || "") : null;
  const generalSections = isGeneral ? splitGeneralSections(caseDoc.content || "") : [];
  const generalLink = isGeneral ? reportLink(caseDoc.content || "") : null;

  // General docs (research, Thai law, court judgments, ...) never had a PDF
  // scan collected - their "source" is the note's own "## ลิงก์..." URL, if
  // filled in. See SourcePdfLink's comment.
  const hasPdf =
    !!repo.getSourcePdfPath(caseDoc.document_id) ||
    !!repo.getDrivePdfFileId(caseDoc.document_id) ||
    (isGeneral && !!generalLink);

  const docTypeLabel = isCaseNote
    ? "กรณีตรวจสอบ"
    : isSituationReport
    ? "รายงานประเมินสถานการณ์"
    : isGeneral
    ? caseDoc.category || "งานวิจัย"
    : "เอกสาร";

  return (
    <main className="cw-detail-page">
      <Link href="/" className="cw-detail-back">
        <ChevronLeft size={17} /> กลับไปหน้าค้นหา
      </Link>
      <div className="cw-detail-grid">
        <article>
          <div className="cw-detail-hero">
            <div className="cw-case-card-tags">
              <span className="cw-case-tag">{docTypeLabel}</span>
              {caseDoc.area_code && (
                <span className="cw-case-tag is-muted">
                  [{caseDoc.area_code}] {caseDoc.area_name || AREA_NAMES[caseDoc.area_code]}
                </span>
              )}
            </div>
            <h1>
              {caseDoc.case_id ? `[${caseDoc.case_id}] ` : ""}
              {caseDoc.title}
            </h1>
            <div className="cw-detail-meta">
              {caseDoc.year_buddhist && (
                <span>
                  <CalendarDays size={16} /> พ.ศ. {caseDoc.year_buddhist}
                </span>
              )}
              <span>
                <ShieldCheck size={16} /> สำนักงาน กสม.
              </span>
            </div>
            <div style={{ marginTop: 16 }}>
              <SourcePdfLink id={id} available={hasPdf} externalUrl={isGeneral ? generalLink : null} />
            </div>
            {caseDoc.keywords.length > 0 && (
              <div className="cw-case-card-tags" style={{ marginTop: 16 }}>
                {caseDoc.keywords.map((kw) => (
                  <span className="cw-case-tag is-muted" key={kw}>
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>

          {isCaseNote ? (
            <>
              <AiCaseSummary caseId={id} />
              <section className="cw-detail-body">
                {sections.map((s, i) => (
                  <section key={i} className="cw-detail-section">
                    <span className="cw-detail-section-num">{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <h2>{s.heading}</h2>
                      <p>{s.content}</p>
                    </div>
                  </section>
                ))}
              </section>
            </>
          ) : isGeneral && generalSections.length > 0 ? (
            <>
              {generalMeta && <GeneralMetadataBox meta={generalMeta} />}
              <section className="cw-detail-body">
                {generalSections.map((s, i) => (
                  <section key={i} className="cw-detail-section">
                    <span className="cw-detail-section-num">{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <h2>{s.heading}</h2>
                      <p>{s.content}</p>
                    </div>
                  </section>
                ))}
              </section>
            </>
          ) : (
            <section className="cw-detail-body">
              <section className="cw-detail-section">
                <div>
                  <h2>เกี่ยวกับเอกสารฉบับนี้</h2>
                  <p>{caseDoc.summary}</p>
                  <p style={{ marginTop: 12 }}>
                    เอกสารฉบับเต็มเป็นรายงานฉบับตีพิมพ์ (แปลงจากไฟล์ PDF) จึงยังไม่ได้แบ่งเป็นหัวข้อย่อยแบบเดียวกับ
                    บันทึกกรณีตรวจสอบ กรุณาเปิดไฟล์ PDF ด้านบนเพื่ออ่านเนื้อหาฉบับเต็ม
                  </p>
                </div>
              </section>
            </section>
          )}
        </article>
        <aside>
          {isCaseNote ? (
            <>
              <LegalRefsBox caseId={id} />
              <RelatedList title="กรณีที่เกี่ยวข้อง (คำสำคัญใกล้เคียง)" cases={related} />
              <RelatedList title={`กรณีอื่นในประเด็น ${caseDoc.area_code || ""}`} cases={sameArea} />
            </>
          ) : isSituationReport ? (
            <RelatedList title="รายงานปีอื่น" cases={otherReports} />
          ) : (
            <RelatedList title={relatedListLabel(caseDoc.category)} cases={relatedResearch} />
          )}
        </aside>
      </div>
    </main>
  );
}
