import type { Citation } from "@/types/document";

export type CaseRole =
  | "intake_officer"
  | "screening_officer"
  | "supervisor"
  | "case_officer"
  | "report_screener"
  | "commissioner"
  | "committee_secretariat"
  | "privacy_officer"
  | "auditor"
  | "system_admin";

export type ComplaintStatus =
  | "received"
  | "completeness_check"
  | "awaiting_complainant"
  | "preliminary_fact_finding"
  | "screening_summary"
  | "supervisor_review"
  | "committee_pending"
  | "accepted"
  | "not_accepted"
  | "referred"
  | "other_mandate"
  | "notification_pending"
  | "closed"
  | "planning"
  | "in_progress"
  | "report_drafting";

export type CasePriority = "normal" | "urgent" | "critical";
export type DataClassification = "RESTRICTED" | "HIGHLY_SENSITIVE";
export type ReportStatus =
  | "draft"
  | "group_head_review"
  | "bureau_director_review"
  | "executive_review"
  | "commissioner_review"
  | "revision_requested"
  | "approved"
  | "finalizing"
  | "final";
export type ReportOutcome = "pending" | "violation" | "no_violation" | "terminated_withdrawal" | "terminated_court" | "terminated_other";

export interface CaseActor {
  id: string;
  name: string;
  role: CaseRole;
  demo: boolean;
}

export interface CaseParty {
  id: string;
  role: "complainant" | "affected_person" | "respondent" | "witness" | "representative" | "organization";
  displayName: string;
  organization?: string;
  protectedIdentity?: boolean;
  contactHint?: string;
}

export interface CaseDeadline {
  id: string;
  label: string;
  dueAt: string;
  legalBasis: string;
  status: "open" | "due_soon" | "overdue" | "completed";
  owner: string;
}

export interface CaseEvent {
  id: string;
  occurredAt: string;
  title: string;
  description: string;
  actor: string;
  type: "intake" | "screening" | "investigation" | "evidence" | "report" | "decision" | "ai";
}

export interface EvidenceInsight {
  type: "transcript" | "summary";
  content?: string;
  data?: {
    summary: string;
    relevanceToAllegations: Array<{ allegation: string; supports: boolean; reason: string }>;
    timeline: Array<{ date: string; event: string }>;
  };
}

export interface EvidenceItem {
  id: string;
  code: string;
  title: string;
  type: "document" | "statement" | "image" | "audio" | "video" | "digital";
  source: string;
  obtainedAt: string;
  verification: "pending" | "verified" | "disputed";
  supports: string[];
  classification: DataClassification;
  file?: {
    name: string;
    size: number;
    url: string;
  };
  insights?: EvidenceInsight;
}

export interface ScreeningReview {
  factsComplete: boolean;
  requestClear: boolean;
  withinMandate: boolean;
  sufficientBasis: boolean;
  needsMoreFacts: boolean;
  officerOpinion: string;
  legalBasis: string;
  resolution?: "investigate" | "mediate" | "refer" | "terminate";
}

export type ReportSectionKey =
  | "parties"
  | "background"
  | "investigation"
  | "proceedings"
  | "nhrc_opinion"
  | "recommendations"
  | "complaint_summary"
  | "circumstances"
  | "legal_framework"
  | "analysis"
  | "measures"
  | string;

export interface ReportSection {
  id: string;
  key: ReportSectionKey;
  title: string;
  requirement: string;
  content: string;
  citations: Citation[];
}

export type ReportType = "NHRC2" | "NHRC3";

export interface InvestigationReport {
  id: string;
  type: ReportType;
  version: number;
  status: ReportStatus;
  outcome: ReportOutcome;
  updatedAt: string;
  updatedBy: string;
  sections: ReportSection[];
}

export interface ComplaintCase {
  id: string;
  referenceNo: string;
  title: string;
  summary: string;
  receivedAt: string;
  channel: string;
  language: "th" | "en" | "th-en";
  status: ComplaintStatus;
  priority: CasePriority;
  classification: DataClassification;
  vulnerableGroup: boolean;
  location: string;
  desiredOutcome: string;
  rightsIssues: string[];
  assignedOfficer: string;
  supervisor: string;
  parties: CaseParty[];
  allegations: string[];
  screening: ScreeningReview;
  deadlines: CaseDeadline[];
  timeline: CaseEvent[];
  evidence: EvidenceItem[];
  report: InvestigationReport;
  followUps: FollowUpEvent[];
}

export type FollowUpStatus = "pending" | "implemented" | "partially_implemented" | "ignored";

export interface FollowUpEvent {
  id: string;
  recommendationText: string;
  agencyName: string;
  dueDate: string;
  status: FollowUpStatus;
  notes: string;
  updatedAt: string;
}

export interface ComplaintCreateInput {
  channel: string;
  title: string;
  facts: string;
  desiredOutcome: string;
  complainantName: string;
  respondentName: string;
  location: string;
  language: "th" | "en" | "th-en";
  rightsIssue: string;
  priority: CasePriority;
  classification: DataClassification;
  protectIdentity: boolean;
  officerOpinion?: string;
}

export interface ReportSaveInput {
  outcome: ReportOutcome;
  sections: ReportSection[];
  intent: "draft" | "submit_to_head" | "submit_to_director" | "submit_to_exec" | "submit_to_comm" | "approve_final" | "revise";
}

export const REPORT_SECTION_DEFINITIONS_NHRC2: Array<Pick<ReportSection, "key" | "title" | "requirement">> = [
  { key: "parties", title: "ผู้ร้องและผู้ถูกร้อง", requirement: "ระบุชื่อและสถานะของผู้ร้อง ผู้เสียหาย และผู้ถูกร้อง" },
  { key: "background", title: "๑. ความเป็นมา", requirement: "สรุปคำร้องและข้อกล่าวอ้าง" },
  { key: "investigation", title: "๒. การตรวจสอบ", requirement: "รวม ๒.๑ รายการพยานหลักฐาน และ ๒.๒ ข้อเท็จจริงจากการตรวจสอบ" },
  { key: "nhrc_opinion", title: "๓. ความเห็นคณะกรรมการสิทธิมนุษยชนแห่งชาติ", requirement: "วิเคราะห์ข้อกฎหมายและสรุปว่ามีการละเมิดหรือไม่" },
  { key: "recommendations", title: "๔. ข้อเสนอแนะมาตรการหรือแนวทางในการส่งเสริมและคุ้มครองสิทธิมนุษยชน", requirement: "ระบุข้อเสนอแนะในการแก้ไขปัญหาหรือเยียวยาความเสียหาย" },
];

export const REPORT_SECTION_DEFINITIONS_NHRC3: Array<Pick<ReportSection, "key" | "title" | "requirement">> = [
  { key: "parties", title: "ผู้ร้องและผู้ถูกร้อง", requirement: "ระบุชื่อและสถานะของผู้ร้อง ผู้เสียหาย และผู้ถูกร้อง (ถ้ามี)" },
  { key: "background", title: "๑. ความเป็นมา", requirement: "สรุปที่มาและเหตุแห่งการจัดทำข้อเสนอแนะ" },
  { key: "proceedings", title: "๒. การดำเนินการ", requirement: "รวมข้อมูลวิชาการ การรับฟังความเห็น กฎหมายภายใน และมาตรฐานระหว่างประเทศ" },
  { key: "nhrc_opinion", title: "๓. ความเห็นคณะกรรมการสิทธิมนุษยชนแห่งชาติ", requirement: "วิเคราะห์ความสอดคล้องกับหลักสิทธิมนุษยชน" },
  { key: "recommendations", title: "๔. ข้อเสนอแนะมาตรการหรือแนวทางในการส่งเสริมและคุ้มครองสิทธิมนุษยชน", requirement: "ข้อเสนอแนะเชิงระบบต่อหน่วยงานที่เกี่ยวข้อง" },
];

export const REPORT_SECTION_DEFINITIONS = REPORT_SECTION_DEFINITIONS_NHRC2;
