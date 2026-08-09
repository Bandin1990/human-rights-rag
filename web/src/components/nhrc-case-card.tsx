import Link from "next/link";
import { ArrowRight, CalendarDays } from "@/components/icons";
import { NhrcDocument } from "@/lib/nhrc/types";

// "general" document_type spans several very different DOCUMENT_CATEGORIES
// (research, Thai law, international instruments, court judgments,
// knowledge base) - badging every one of them "เอกสารทั่วไป" regardless of
// which shelf it's actually on is exactly the kind of "หัวข้อไม่ตรงกับ
// เนื้อหา" mislabeling reported against the case-detail page's related-
// documents heading. Use the document's own `category` for those instead;
// TYPE_LABELS only needs to cover the other (non-"general") document types,
// which don't carry a separate category field. "situation_report" was
// previously missing entirely, so its raw snake_case type string leaked
// straight onto the card.
const TYPE_LABELS: Record<string, string> = {
  case_note: "กรณีตรวจสอบ",
  topic: "ประเด็นสิทธิ",
  situation_report: "รายงานประเมินสถานการณ์",
  project: "โครงการ",
};
function typeLabel(doc: NhrcDocument): string {
  if (doc.document_type === "general") return doc.category || "เอกสารทั่วไป";
  return TYPE_LABELS[doc.document_type] || doc.document_type;
}

// Summaries are the first ~500 chars of the case note's raw markdown body -
// strip heading/wikilink/bold syntax so the card preview reads as prose.
function previewText(summary: string): string {
  const plain = summary
    .replace(/^#\s+.*$/m, "")
    .replace(/^##\s*.*$/gm, "")
    .replace(/\[\[([^\|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 180 ? `${plain.slice(0, 180)}...` : plain;
}

export function NhrcCaseCard({ doc }: { doc: NhrcDocument }) {
  const href = doc.case_id ? `/case/${doc.case_id}` : `/case/${doc.document_id}`;
  return (
    <Link href={href} className="cw-case-card">
      <div>
        <div className="cw-case-card-tags">
          <span className="cw-case-tag">{typeLabel(doc)}</span>
          {doc.area_code && (
            <span className="cw-case-tag is-muted">
              [{doc.area_code}] {doc.area_name}
            </span>
          )}
        </div>
        <h3>
          {doc.case_id ? `[${doc.case_id}] ` : ""}
          {doc.title}
        </h3>
        {doc.summary && <p>{previewText(doc.summary)}</p>}
        <div className="cw-case-meta">
          {doc.year_buddhist && (
            <span>
              <CalendarDays size={13} /> พ.ศ. {doc.year_buddhist}
            </span>
          )}
          {doc.keywords.slice(0, 3).map((kw) => (
            <span key={kw}>{kw}</span>
          ))}
        </div>
      </div>
      <span className="cw-case-arrow">
        <ArrowRight size={16} />
      </span>
    </Link>
  );
}
