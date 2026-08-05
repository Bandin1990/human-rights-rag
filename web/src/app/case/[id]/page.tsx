import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ChevronLeft, Download, ShieldCheck, Sparkles } from "lucide-react";
import { getNhrcRepository, NhrcDocument } from "@/lib/nhrc/repository";
import { getLegalRefs } from "@/lib/nhrc/legal-refs";

export const dynamic = "force-dynamic";

const AREA_NAMES: Record<string, string> = {
  A: "สิทธิพลเมืองและสิทธิทางการเมือง",
  B: "สิทธิทางเศรษฐกิจ สังคม และวัฒนธรรม",
  C: "สิทธิของกลุ่มบุคคล",
  D: "สถานการณ์เชิงพื้นที่-เฉพาะ",
  E: "เพิ่มเติมจากแท็กซอนอมีเดิม",
};

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

function LegalRefsBox({
  refs,
}: {
  refs: { internationalInstruments: string[]; thaiLaws: string[] } | null;
}) {
  return (
    <div className="cw-legal-refs">
      <div className="cw-legal-refs-head">
        <Sparkles size={15} /> กฎหมาย/ตราสารที่เกี่ยวข้อง
      </div>
      <p className="cw-legal-refs-note">แนะนำโดย AI จากเนื้อหากรณี — ยังไม่ผ่านการตรวจสอบ โปรดยืนยันก่อนอ้างอิงจริง</p>

      {refs === null ? (
        <div className="cw-legal-refs-empty">ยังไม่สามารถวิเคราะห์ได้ในขณะนี้</div>
      ) : (
        <>
          <h4>ตราสารระหว่างประเทศที่เกี่ยวข้อง</h4>
          {refs.internationalInstruments.length > 0 ? (
            refs.internationalInstruments.map((item, i) => (
              <div className="cw-legal-ref-item" key={i}>
                {item}
              </div>
            ))
          ) : (
            <div className="cw-legal-refs-empty">ไม่พบตราสารที่เกี่ยวข้องชัดเจน</div>
          )}

          <h4>กฎหมายไทยที่เกี่ยวข้อง</h4>
          {refs.thaiLaws.length > 0 ? (
            refs.thaiLaws.map((item, i) => (
              <div className="cw-legal-ref-item" key={i}>
                {item}
              </div>
            ))
          ) : (
            <div className="cw-legal-refs-empty">ไม่พบกฎหมายที่เกี่ยวข้องชัดเจน</div>
          )}
        </>
      )}
    </div>
  );
}

function SourcePdfLink({ id, available }: { id: string; available: boolean }) {
  if (!available) {
    return (
      <span className="cw-pdf-link is-disabled">
        <Download size={16} /> ยังไม่มีไฟล์ต้นฉบับ
      </span>
    );
  }
  return (
    <a className="cw-pdf-link" href={`/api/case/${id}/document`} target="_blank" rel="noopener noreferrer">
      <Download size={16} /> เปิดรายงานฉบับเต็ม (PDF)
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
  const hasPdf =
    !!repo.getSourcePdfPath(caseDoc.document_id) || !!repo.getDrivePdfFileId(caseDoc.document_id);

  const related = isCaseNote ? repo.getRelatedCases(id, 10) : [];
  const sameArea = isCaseNote
    ? repo.getCasesByArea(caseDoc.area_code || "", 10).filter((c) => c.case_id !== id)
    : [];
  const otherReports = isSituationReport
    ? repo.search({ docType: "situation_report", limit: 20 }).data.filter((d) => d.document_id !== caseDoc.document_id)
    : [];
  const relatedResearch = isGeneral
    ? repo.getRelatedDocuments(caseDoc.document_id, "general", 10)
    : [];
  const sections = isCaseNote ? splitSections(caseDoc.content || "") : [];
  const legalRefs = isCaseNote ? await getLegalRefs(id) : null;

  return (
    <main className="cw-detail-page">
      <Link href="/" className="cw-detail-back">
        <ChevronLeft size={17} /> กลับไปหน้าค้นหา
      </Link>
      <div className="cw-detail-grid">
        <article>
          <div className="cw-detail-hero">
            <div className="cw-case-card-tags">
              <span className="cw-case-tag">{isCaseNote ? "กรณีตรวจสอบ" : "รายงานประเมินสถานการณ์"}</span>
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
              <SourcePdfLink id={id} available={hasPdf} />
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
              {legalRefs?.summary && (
                <div className="cw-legal-refs" style={{ marginTop: 24 }}>
                  <div className="cw-legal-refs-head">
                    <Sparkles size={15} /> สรุปโดย AI
                  </div>
                  <p className="cw-legal-refs-note">สรุปโดยอัตโนมัติจากเนื้อหากรณี</p>
                  <p style={{ color: "#d1d5db", fontSize: "0.92rem", lineHeight: 1.7, margin: 0 }}>
                    {legalRefs.summary}
                  </p>
                </div>
              )}
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
          ) : (
            <section className="cw-detail-body">
              <section className="cw-detail-section">
                <div>
                  <h2>เกี่ยวกับรายงานฉบับนี้</h2>
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
              <LegalRefsBox refs={legalRefs} />
              <RelatedList title="กรณีที่เกี่ยวข้อง (คำสำคัญใกล้เคียง)" cases={related} />
              <RelatedList title={`กรณีอื่นในประเด็น ${caseDoc.area_code || ""}`} cases={sameArea} />
            </>
          ) : isSituationReport ? (
            <RelatedList title="รายงานปีอื่น" cases={otherReports} />
          ) : (
            <RelatedList title="งานวิจัยที่เกี่ยวข้อง (คำสำคัญใกล้เคียง)" cases={relatedResearch} />
          )}
        </aside>
      </div>
    </main>
  );
}
