import Link from "next/link";
import { ArrowRight, CalendarDays } from "@/components/icons";
import { NhrcDocument } from "@/lib/nhrc/types";

const TYPE_LABELS: Record<string, string> = {
  case_note: "กรณีตรวจสอบ",
  topic: "ประเด็นสิทธิ",
  general: "เอกสารทั่วไป",
};

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
          <span className="cw-case-tag">{TYPE_LABELS[doc.document_type] || doc.document_type}</span>
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
