import type { CasePriority, ComplaintStatus, DataClassification, ReportStatus } from "@/types/case";

export const complaintStatusLabels: Record<ComplaintStatus, string> = {
  received: "รับเรื่องแล้ว",
  completeness_check: "ตรวจความครบถ้วน",
  awaiting_complainant: "รอข้อมูลผู้ร้อง",
  preliminary_fact_finding: "แสวงหาข้อเท็จจริง",
  screening_summary: "จัดทำบันทึกสรุป",
  supervisor_review: "รอผู้บังคับบัญชา",
  committee_pending: "รอเสนอคณะกรรมการ",
  accepted: "รับเป็นคำร้อง",
  not_accepted: "ไม่รับเป็นคำร้อง",
  referred: "ส่งต่อหน่วยงาน",
  other_mandate: "ดำเนินการตามหน้าที่อื่น",
  notification_pending: "รอแจ้งผล",
  closed: "ปิดเรื่อง",
  planning: "วางแผนตรวจสอบ",
  in_progress: "กำลังตรวจสอบ",
  report_drafting: "จัดทำรายงาน",
};

export const reportStatusLabels: Record<ReportStatus, string> = {
  draft: "ร่างรายงาน",
  group_head_review: "หัวหน้ากลุ่มตรวจ",
  bureau_director_review: "ผอ. สำนักตรวจ",
  executive_review: "ผู้บริหารพิจารณา",
  commissioner_review: "กสม. พิจารณา",
  revision_requested: "ขอแก้ไข",
  approved: "เห็นชอบแล้ว",
  finalizing: "เตรียมเสนอ กสม.",
  final: "เสนอ กสม. แล้ว",
};

export const priorityLabels: Record<CasePriority, string> = {
  normal: "ปกติ",
  urgent: "เร่งด่วน",
  critical: "วิกฤต",
};

export const classificationLabels: Record<DataClassification, string> = {
  RESTRICTED: "ข้อมูลจำกัด",
  HIGHLY_SENSITIVE: "ข้อมูลอ่อนไหวสูง",
};

export function formatThaiDate(value: string, withTime = false) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

export function daysUntil(value: string, from = new Date()) {
  const target = new Date(value);
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
}

export function deadlineText(value: string) {
  const days = daysUntil(value);
  if (days < 0) return `เกินกำหนด ${Math.abs(days)} วัน`;
  if (days === 0) return "ครบกำหนดวันนี้";
  return `เหลือ ${days} วัน`;
}
