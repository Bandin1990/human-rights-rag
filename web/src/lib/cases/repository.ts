import { complaintCases } from "@/data/cases";
import { createClient } from "@/lib/supabase/server";
import { isCaseDemoMode } from "@/lib/cases/auth";
import {
  ComplaintCase,
  ComplaintCreateInput,
  InvestigationReport,
  REPORT_SECTION_DEFINITIONS,
  ReportSaveInput,
  ReportSection,
  ReportStatus,
} from "@/types/case";
import type { Answer } from "@/types/document";

type Row = Record<string, unknown>;

const caseDemoGlobal = globalThis as typeof globalThis & {
  __humanRightsComplaintDemoCases?: Map<string, ComplaintCase>;
};

const demoCases = caseDemoGlobal.__humanRightsComplaintDemoCases ?? new Map(
  complaintCases.map((item) => [item.id, structuredClone(item)]),
);
caseDemoGlobal.__humanRightsComplaintDemoCases = demoCases;

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asStrings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function emptyReport(now = new Date().toISOString()): InvestigationReport {
  return {
    id: "",
    type: "NHRC3",
    version: 0,
    status: "draft",
    outcome: "pending",
    updatedAt: now,
    updatedBy: "-",
    sections: REPORT_SECTION_DEFINITIONS.map((section) => ({
      id: `section-${section.key}`,
      ...section,
      content: "",
      citations: [],
    })),
  };
}

function baseCase(row: Row): ComplaintCase {
  const now = new Date().toISOString();
  return {
    id: asString(row.id),
    referenceNo: asString(row.reference_no),
    title: asString(row.title),
    summary: asString(row.summary),
    receivedAt: asString(row.received_at, now),
    channel: asString(row.channel),
    language: (asString(row.language, "th") as ComplaintCase["language"]),
    status: (asString(row.status, "received") as ComplaintCase["status"]),
    priority: (asString(row.priority, "normal") as ComplaintCase["priority"]),
    classification: (asString(row.classification, "RESTRICTED") as ComplaintCase["classification"]),
    vulnerableGroup: row.vulnerable_group === true,
    location: asString(row.location),
    desiredOutcome: asString(row.desired_outcome),
    rightsIssues: asStrings(row.rights_issues),
    assignedOfficer: "ยังไม่มอบหมาย",
    supervisor: "ยังไม่มอบหมาย",
    parties: [],
    allegations: [],
    screening: {
      factsComplete: false,
      requestClear: false,
      withinMandate: false,
      sufficientBasis: false,
      needsMoreFacts: false,
      officerOpinion: "",
      legalBasis: "",
    },
    deadlines: [],
    timeline: [],
    evidence: [],
    followUps: [],
    report: emptyReport(now),
  };
}

async function getDatabase() {
  return isCaseDemoMode() ? null : createClient();
}

export async function listComplaintCases(): Promise<ComplaintCase[]> {
  const supabase = await getDatabase();
  if (!supabase) return [...demoCases.values()].map((item) => structuredClone(item));

  const { data, error } = await supabase
    .schema("case_management")
    .from("complaints")
    .select("id,reference_no,title,summary,received_at,channel,language,status,priority,classification,vulnerable_group,location,desired_outcome,rights_issues")
    .order("received_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Case dashboard query failed: ${error.message}`);

  const cases = ((data || []) as Row[]).map(baseCase);
  if (!cases.length) return [];
  const ids = cases.map((item) => item.id);

  const [{ data: assignmentRows }, { data: deadlineRows }] = await Promise.all([
    supabase.schema("case_management").from("assignments").select("complaint_id,display_name,assignment_role").in("complaint_id", ids).eq("active", true),
    supabase.schema("case_management").from("deadlines").select("id,complaint_id,label,due_at,legal_basis,status,owner_name").in("complaint_id", ids).neq("status", "completed"),
  ]);

  for (const item of cases) {
    const assignments = ((assignmentRows || []) as Row[]).filter((row) => row.complaint_id === item.id);
    item.assignedOfficer = asString(assignments.find((row) => row.assignment_role === "case_officer")?.display_name, item.assignedOfficer);
    item.supervisor = asString(assignments.find((row) => row.assignment_role === "supervisor")?.display_name, item.supervisor);
    item.deadlines = ((deadlineRows || []) as Row[])
      .filter((row) => row.complaint_id === item.id)
      .map((row) => ({
        id: asString(row.id),
        label: asString(row.label),
        dueAt: asString(row.due_at),
        legalBasis: asString(row.legal_basis),
        status: asString(row.status, "open") as ComplaintCase["deadlines"][number]["status"],
        owner: asString(row.owner_name, item.assignedOfficer),
      }));
  }
  return cases;
}

export async function getComplaintCase(id: string): Promise<ComplaintCase | null> {
  const supabase = await getDatabase();
  if (!supabase) return structuredClone(demoCases.get(id) || null);

  const { data: complaintRow, error } = await supabase
    .schema("case_management")
    .from("complaints")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Case lookup failed: ${error.message}`);
  if (!complaintRow) return null;

  const item = baseCase(complaintRow as Row);
  const [parties, allegations, assignments, deadlines, events, evidence, screening, reports] = await Promise.all([
    supabase.schema("case_management").from("parties").select("*").eq("complaint_id", id).order("created_at"),
    supabase.schema("case_management").from("allegations").select("*").eq("complaint_id", id).order("created_at"),
    supabase.schema("case_management").from("assignments").select("*").eq("complaint_id", id).eq("active", true),
    supabase.schema("case_management").from("deadlines").select("*").eq("complaint_id", id).order("due_at"),
    supabase.schema("case_management").from("case_events").select("*").eq("complaint_id", id).order("occurred_at", { ascending: false }),
    supabase.schema("case_management").from("evidence_items").select("*").eq("complaint_id", id).order("obtained_at"),
    supabase.schema("case_management").from("screening_reviews").select("*").eq("complaint_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.schema("case_management").from("reports").select("*").eq("complaint_id", id).maybeSingle(),
  ]);

  for (const result of [parties, allegations, assignments, deadlines, events, evidence, screening, reports]) {
    if (result.error) throw new Error(`Case workspace query failed: ${result.error.message}`);
  }

  item.parties = ((parties.data || []) as Row[]).map((row) => ({
    id: asString(row.id),
    role: asString(row.party_role) as ComplaintCase["parties"][number]["role"],
    displayName: asString(row.display_name),
    organization: asString(row.organization_name) || undefined,
    protectedIdentity: row.protected_identity === true,
    contactHint: asString(row.contact_hint) || undefined,
  }));
  item.allegations = ((allegations.data || []) as Row[]).map((row) => asString(row.description));
  const assignmentRows = (assignments.data || []) as Row[];
  item.assignedOfficer = asString(assignmentRows.find((row) => row.assignment_role === "case_officer")?.display_name, item.assignedOfficer);
  item.supervisor = asString(assignmentRows.find((row) => row.assignment_role === "supervisor")?.display_name, item.supervisor);
  item.deadlines = ((deadlines.data || []) as Row[]).map((row) => ({
    id: asString(row.id),
    label: asString(row.label),
    dueAt: asString(row.due_at),
    legalBasis: asString(row.legal_basis),
    status: asString(row.status, "open") as ComplaintCase["deadlines"][number]["status"],
    owner: asString(row.owner_name),
  }));
  item.timeline = ((events.data || []) as Row[]).map((row) => ({
    id: asString(row.id),
    occurredAt: asString(row.occurred_at),
    title: asString(row.title),
    description: asString(row.description),
    actor: asString(row.actor_name),
    type: asString(row.event_type, "investigation") as ComplaintCase["timeline"][number]["type"],
  }));
  item.evidence = ((evidence.data || []) as Row[]).map((row) => ({
    id: asString(row.id),
    code: asString(row.evidence_code),
    title: asString(row.title),
    type: asString(row.evidence_type, "document") as ComplaintCase["evidence"][number]["type"],
    source: asString(row.source_name),
    obtainedAt: asString(row.obtained_at),
    verification: asString(row.verification_status, "pending") as ComplaintCase["evidence"][number]["verification"],
    supports: asStrings(row.supports_allegations),
    classification: asString(row.classification, "RESTRICTED") as ComplaintCase["evidence"][number]["classification"],
  }));

  if (screening.data) {
    const row = screening.data as Row;
    item.screening = {
      factsComplete: row.facts_complete === true,
      requestClear: row.request_clear === true,
      withinMandate: row.within_mandate === true,
      sufficientBasis: row.sufficient_basis === true,
      needsMoreFacts: row.needs_more_facts === true,
      officerOpinion: asString(row.officer_opinion),
      legalBasis: asString(row.legal_basis),
    };
  }

  if (reports.data) item.report = await loadReport(supabase, reports.data as Row, item);
  return item;
}

async function loadReport(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reportRow: Row,
  item: ComplaintCase,
): Promise<InvestigationReport> {
  const version = Number(reportRow.current_version || 0);
  if (!version) return emptyReport(asString(reportRow.updated_at, item.receivedAt));
  const { data: versionRow, error: versionError } = await supabase
    .schema("case_management")
    .from("report_versions")
    .select("*")
    .eq("report_id", reportRow.id)
    .eq("version_no", version)
    .single();
  if (versionError) throw new Error(`Report version query failed: ${versionError.message}`);
  const { data: sectionRows, error: sectionError } = await supabase
    .schema("case_management")
    .from("report_sections")
    .select("*")
    .eq("report_version_id", versionRow.id)
    .order("section_order");
  if (sectionError) throw new Error(`Report section query failed: ${sectionError.message}`);
  const sectionIds = ((sectionRows || []) as Row[]).map((row) => asString(row.id));
  const citationResult = sectionIds.length
    ? await supabase.schema("case_management").from("citations").select("*").in("report_section_id", sectionIds)
    : { data: [], error: null };
  if (citationResult.error) throw new Error(`Report citation query failed: ${citationResult.error.message}`);

  const citationRows = (citationResult.data || []) as Row[];
  const stored = ((sectionRows || []) as Row[]).map((row): ReportSection => ({
    id: asString(row.id),
    key: asString(row.section_key) as ReportSection["key"],
    title: asString(row.title),
    requirement: asString(row.requirement),
    content: asString(row.content),
    citations: citationRows
      .filter((citation) => citation.report_section_id === row.id)
      .map((citation) => ({
        documentId: asString(citation.document_id),
        sectionId: asString(citation.document_section_id),
        title: asString(citation.document_title),
        page: typeof citation.page_number === "number" ? citation.page_number : undefined,
        anchor: asString(citation.anchor) || undefined,
        excerpt: asString(citation.excerpt),
      })),
  }));

  return {
    id: asString(reportRow.id),
    type: (asString(reportRow.type, "NHRC3") as InvestigationReport["type"]),
    version,
    status: asString(reportRow.status, "draft") as InvestigationReport["status"],
    outcome: asString(versionRow.outcome, "pending") as InvestigationReport["outcome"],
    updatedAt: asString(versionRow.created_at, item.receivedAt),
    updatedBy: asString(versionRow.created_by_name, item.assignedOfficer),
    sections: REPORT_SECTION_DEFINITIONS.map((definition) =>
      stored.find((section) => section.key === definition.key) || {
        id: `section-${definition.key}`,
        ...definition,
        content: "",
        citations: [],
      },
    ),
  };
}

function thaiYear(date = new Date()) {
  return date.getFullYear() + 543;
}

function makeReferenceNo() {
  return `สม. ${thaiYear()}/${String(Date.now()).slice(-5)}`;
}

function addDays(value: Date, days: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

export async function createComplaint(input: ComplaintCreateInput, actorId: string, actorName: string) {
  const supabase = await getDatabase();
  const now = new Date();
  const referenceNo = makeReferenceNo();

  if (!supabase) {
    const id = `demo-${crypto.randomUUID()}`;
    const created: ComplaintCase = {
      id,
      referenceNo,
      title: input.title,
      summary: input.facts,
      receivedAt: now.toISOString(),
      channel: input.channel,
      language: input.language,
      status: "completeness_check",
      priority: input.priority,
      classification: input.classification,
      vulnerableGroup: input.classification === "HIGHLY_SENSITIVE",
      location: input.location,
      desiredOutcome: input.desiredOutcome,
      rightsIssues: [input.rightsIssue],
      assignedOfficer: actorName,
      supervisor: "รอมอบหมาย",
      parties: [
        { id: crypto.randomUUID(), role: "complainant", displayName: input.protectIdentity ? "ผู้ร้อง (ปกปิดชื่อ)" : input.complainantName, protectedIdentity: input.protectIdentity },
        { id: crypto.randomUUID(), role: "respondent", displayName: input.respondentName },
      ],
      allegations: [input.facts],
      screening: { factsComplete: false, requestClear: Boolean(input.desiredOutcome), withinMandate: false, sufficientBasis: false, needsMoreFacts: false, officerOpinion: "", legalBasis: "ข้อ 17–18" },
      deadlines: [{ id: crypto.randomUUID(), label: "เสนอบันทึกสรุปการกลั่นกรอง", dueAt: addDays(now, 15).toISOString(), legalBasis: "ข้อ 18 · 15 วัน", status: "open", owner: actorName }],
      timeline: [{ id: crypto.randomUUID(), occurredAt: now.toISOString(), title: "รับเรื่องร้องเรียน", description: `รับเรื่องผ่าน${input.channel} และเริ่มตรวจความครบถ้วน`, actor: actorName, type: "intake" }],
      evidence: [],
      followUps: [],
      report: emptyReport(now.toISOString()),
    };
    demoCases.set(id, created);
    return structuredClone(created);
  }

  const { data: complaint, error: complaintError } = await supabase
    .schema("case_management")
    .from("complaints")
    .insert({
      reference_no: referenceNo,
      title: input.title,
      summary: input.facts,
      received_at: now.toISOString(),
      channel: input.channel,
      language: input.language,
      status: "completeness_check",
      priority: input.priority,
      classification: input.classification,
      vulnerable_group: input.classification === "HIGHLY_SENSITIVE",
      location: input.location,
      desired_outcome: input.desiredOutcome,
      rights_issues: [input.rightsIssue],
      created_by: actorId,
    })
    .select("*")
    .single();
  if (complaintError) throw new Error(`Complaint creation failed: ${complaintError.message}`);

  const childResults = await Promise.all([
    supabase.schema("case_management").from("parties").insert([
      { complaint_id: complaint.id, party_role: "complainant", display_name: input.protectIdentity ? "ผู้ร้อง (ปกปิดชื่อ)" : input.complainantName, protected_identity: input.protectIdentity },
      { complaint_id: complaint.id, party_role: "respondent", display_name: input.respondentName },
    ]),
    supabase.schema("case_management").from("allegations").insert({ complaint_id: complaint.id, description: input.facts }),
    supabase.schema("case_management").from("assignments").insert({ complaint_id: complaint.id, user_id: actorId, display_name: actorName, assignment_role: "intake_officer", active: true }),
    supabase.schema("case_management").from("deadlines").insert({ complaint_id: complaint.id, label: "เสนอบันทึกสรุปการกลั่นกรอง", trigger_event: "intake_assigned", triggered_at: now.toISOString(), due_at: addDays(now, 15).toISOString(), legal_basis: "ข้อ 18 · 15 วัน", status: "open", owner_id: actorId, owner_name: actorName }),
    supabase.schema("case_management").from("case_events").insert({ complaint_id: complaint.id, occurred_at: now.toISOString(), title: "รับเรื่องร้องเรียน", description: `รับเรื่องผ่าน${input.channel} และเริ่มตรวจความครบถ้วน`, actor_id: actorId, actor_name: actorName, event_type: "intake" }),
  ]);
  const childError = childResults.find((result) => result.error)?.error;
  if (childError) throw new Error(`Complaint detail creation failed: ${childError.message}`);
  return baseCase(complaint as Row);
}

export async function updateScreening(
  id: string, 
  screening: { factsComplete: boolean; requestClear: boolean; withinMandate: boolean; sufficientBasis: boolean; officerOpinion: string; legalBasis: string },
  allegations: string[],
  actorName: string
) {
  const supabase = await getDatabase();
  const now = new Date().toISOString();

  if (!supabase) {
    const item = demoCases.get(id);
    if (!item) throw new Error("Case not found");
    
    item.screening = {
      ...item.screening,
      ...screening
    };
    item.allegations = allegations;

    item.timeline.unshift({
      id: crypto.randomUUID(),
      occurredAt: now,
      title: "บันทึกผลการกลั่นกรอง",
      description: "อัปเดตรายการตรวจกลั่นกรองและความเห็นโดยเจ้าหน้าที่",
      actor: actorName,
      type: "screening"
    });
    return structuredClone(item);
  }

  throw new Error("Update not implemented for real database yet");
}


export async function updateComplaint(id: string, input: ComplaintCreateInput, actorId: string, actorName: string) {
  const supabase = await getDatabase();
  const now = new Date().toISOString();

  if (!supabase) {
    const item = demoCases.get(id);
    if (!item) throw new Error("Case not found");
    item.title = input.title;
    item.summary = input.facts;
    item.channel = input.channel;
    item.language = input.language;
    item.priority = input.priority;
    item.classification = input.classification;
    item.vulnerableGroup = input.classification === "HIGHLY_SENSITIVE";
    item.location = input.location;
    item.desiredOutcome = input.desiredOutcome;
    item.rightsIssues = [input.rightsIssue];
    
    // Update parties
    const comp = item.parties.find(p => p.role === "complainant");
    if (comp) {
      comp.displayName = input.protectIdentity ? "ผู้ร้อง (ปกปิดชื่อ)" : input.complainantName;
      comp.protectedIdentity = input.protectIdentity;
    }
    const resp = item.parties.find(p => p.role === "respondent");
    if (resp) resp.displayName = input.respondentName;

    item.allegations = [input.facts];
    item.screening.officerOpinion = input.officerOpinion || item.screening.officerOpinion;

    item.timeline.unshift({
      id: crypto.randomUUID(),
      occurredAt: now,
      title: "แก้ไขข้อมูลเรื่องร้องเรียน",
      description: "อัปเดตข้อมูลต้นทางโดยเจ้าหน้าที่",
      actor: actorName,
      type: "intake"
    });
    return structuredClone(item);
  }

  // Not implementing real DB update for brevity in demo, but this is where supabase update would go.
  throw new Error("Update not implemented for real database yet");
}

export async function deleteComplaintCase(id: string) {
  const supabase = await getDatabase();
  
  if (!supabase) {
    if (!demoCases.has(id)) throw new Error("Case not found");
    demoCases.delete(id);
    return;
  }

  const { error } = await supabase
    .schema("case_management")
    .from("complaints")
    .delete()
    .eq("id", id);
    
  if (error) throw new Error(`Delete failed: ${error.message}`);
}

export type EvidenceCreateInput = {
  title: string;
  type: "document" | "statement" | "image" | "audio" | "video" | "digital";
  source: string;
  supports: string[];
};

export async function addEvidenceItem(
  complaintId: string,
  input: EvidenceCreateInput,
  actorName: string
) {
  const supabase = await getDatabase();
  const now = new Date().toISOString();
  const code = `E${Math.floor(1000 + Math.random() * 9000)}`; // simple mock code

  if (!supabase) {
    const item = demoCases.get(complaintId);
    if (!item) throw new Error("Case not found");
    const newEvidence: any = {
      id: crypto.randomUUID(),
      code,
      title: input.title,
      type: input.type,
      source: input.source,
      obtainedAt: now,
      verification: "pending",
      supports: input.supports,
      classification: "RESTRICTED",
    };
    item.evidence.push(newEvidence);
    item.timeline.unshift({
      id: crypto.randomUUID(),
      occurredAt: now,
      title: "นำเข้าพยานหลักฐานใหม่",
      description: `เพิ่มหลักฐาน ${code}: ${input.title}`,
      actor: actorName,
      type: "evidence",
    });
    return newEvidence;
  }

  const { data, error } = await supabase.schema("case_management").from("evidence_items").insert({
    complaint_id: complaintId,
    evidence_code: code,
    title: input.title,
    evidence_type: input.type,
    source_name: input.source,
    obtained_at: now,
    verification_status: "pending",
    supports_allegations: input.supports,
    classification: "RESTRICTED"
  }).select().single();

  if (error) throw new Error(`Add evidence failed: ${error.message}`);
  
  await supabase.schema("case_management").from("case_events").insert({
    complaint_id: complaintId,
    occurred_at: now,
    title: "นำเข้าพยานหลักฐานใหม่",
    description: `เพิ่มหลักฐาน ${code}: ${input.title}`,
    actor_name: actorName,
    event_type: "evidence"
  });

  return data;
}

export async function updateEvidenceVerification(
  complaintId: string,
  evidenceId: string,
  status: "pending" | "verified" | "disputed",
  actorName: string
) {
  const supabase = await getDatabase();
  const now = new Date().toISOString();

  if (!supabase) {
    const item = demoCases.get(complaintId);
    if (!item) throw new Error("Case not found");
    const evidence = item.evidence.find(e => e.id === evidenceId);
    if (!evidence) throw new Error("Evidence not found");
    
    const oldStatus = evidence.verification;
    evidence.verification = status;
    
    item.timeline.unshift({
      id: crypto.randomUUID(),
      occurredAt: now,
      title: "อัปเดตสถานะหลักฐาน",
      description: `เปลี่ยนสถานะ ${evidence.code} จาก ${oldStatus} เป็น ${status}`,
      actor: actorName,
      type: "evidence",
    });
    return evidence;
  }

  const { error } = await supabase.schema("case_management").from("evidence_items")
    .update({ verification_status: status })
    .eq("id", evidenceId)
    .eq("complaint_id", complaintId);

  if (error) throw new Error(`Update evidence status failed: ${error.message}`);

  await supabase.schema("case_management").from("case_events").insert({
    complaint_id: complaintId,
    occurred_at: now,
    title: "อัปเดตสถานะหลักฐาน",
    description: `เปลี่ยนสถานะหลักฐานรหัส ${evidenceId} เป็น ${status}`,
    actor_name: actorName,
    event_type: "evidence"
  });
}

export async function removeEvidenceItem(
  complaintId: string,
  evidenceId: string,
  actorName: string
) {
  const supabase = await getDatabase();
  const now = new Date().toISOString();

  if (!supabase) {
    const item = demoCases.get(complaintId);
    if (!item) throw new Error("Case not found");
    
    const evidenceIndex = item.evidence.findIndex(e => e.id === evidenceId);
    if (evidenceIndex === -1) throw new Error("Evidence not found");
    const evidence = item.evidence[evidenceIndex];
    
    item.evidence.splice(evidenceIndex, 1);
    
    item.timeline.unshift({
      id: crypto.randomUUID(),
      occurredAt: now,
      title: "ลบพยานหลักฐาน",
      description: `ลบหลักฐาน ${evidence.code}: ${evidence.title}`,
      actor: actorName,
      type: "evidence",
    });
    return;
  }

  const { data: evidence } = await supabase.schema("case_management")
    .from("evidence_items").select("evidence_code, title").eq("id", evidenceId).maybeSingle();

  const { error } = await supabase.schema("case_management")
    .from("evidence_items").delete().eq("id", evidenceId).eq("complaint_id", complaintId);

  if (error) throw new Error(`Remove evidence failed: ${error.message}`);

  await supabase.schema("case_management").from("case_events").insert({
    complaint_id: complaintId,
    occurred_at: now,
    title: "ลบพยานหลักฐาน",
    description: `ลบหลักฐาน ${evidence?.evidence_code || evidenceId}: ${evidence?.title || ""}`,
    actor_name: actorName,
    event_type: "evidence"
  });
}

export async function updateEvidenceItem(
  complaintId: string,
  evidenceId: string,
  input: EvidenceCreateInput,
  actorName: string
) {
  const supabase = await getDatabase();
  const now = new Date().toISOString();

  if (!supabase) {
    const item = demoCases.get(complaintId);
    if (!item) throw new Error("Case not found");
    const evidenceIndex = item.evidence.findIndex(e => e.id === evidenceId);
    if (evidenceIndex === -1) throw new Error("Evidence not found");
    
    item.evidence[evidenceIndex] = {
      ...item.evidence[evidenceIndex],
      title: input.title,
      type: input.type,
      source: input.source,
      supports: input.supports,
    };
    
    item.timeline.unshift({
      id: crypto.randomUUID(),
      occurredAt: now,
      title: "แก้ไขพยานหลักฐาน",
      description: `แก้ไขหลักฐาน ${item.evidence[evidenceIndex].code}: ${input.title}`,
      actor: actorName,
      type: "evidence",
    });
    return item.evidence[evidenceIndex];
  }

  const { error } = await supabase.schema("case_management")
    .from("evidence_items").update({
      title: input.title,
      evidence_type: input.type,
      source_name: input.source,
      supports_allegations: input.supports,
    }).eq("id", evidenceId).eq("complaint_id", complaintId);

  if (error) throw new Error(`Update evidence failed: ${error.message}`);

  await supabase.schema("case_management").from("case_events").insert({
    complaint_id: complaintId,
    occurred_at: now,
    title: "แก้ไขพยานหลักฐาน",
    description: `แก้ไขข้อมูลพยานหลักฐานรหัส ${evidenceId}`,
    actor_name: actorName,
    event_type: "evidence"
  });
}

export async function saveReport(
  complaintId: string,
  input: ReportSaveInput,
  actorId: string,
  actorName: string,
) {
  const supabase = await getDatabase();
  let nextStatus: ReportStatus = "draft";
  if (input.intent === "submit_to_head") nextStatus = "group_head_review";
  else if (input.intent === "submit_to_director") nextStatus = "bureau_director_review";
  else if (input.intent === "submit_to_exec") nextStatus = "executive_review";
  else if (input.intent === "submit_to_comm") nextStatus = "commissioner_review";
  else if (input.intent === "approve_final") nextStatus = "final";
  else if (input.intent === "revise") nextStatus = "draft"; // or revision_requested

  const now = new Date().toISOString();

  if (!supabase) {
    const item = demoCases.get(complaintId);
    if (!item) throw new Error("Case not found");
    item.report = {
      ...item.report,
      version: item.report.version + 1,
      status: nextStatus,
      outcome: input.outcome,
      updatedAt: now,
      updatedBy: actorName,
      sections: structuredClone(input.sections),
    };
    item.timeline.unshift({
      id: crypto.randomUUID(),
      occurredAt: now,
      title: input.intent === "submit_to_head" ? "ส่งร่างรายงานให้ผู้บังคับบัญชา" : "บันทึกร่างรายงานฉบับใหม่",
      description: `บันทึกเป็นฉบับที่ ${item.report.version}`,
      actor: actorName,
      type: "report",
    });
    return structuredClone(item.report);
  }

  const rpcInput = input.sections.map((section) => ({
    key: section.key,
    title: section.title,
    requirement: section.requirement,
    content: section.content,
    citations: section.citations.map((c) => ({
      documentId: c.documentId,
      sectionId: c.sectionId,
      title: c.title,
      page: c.page,
      anchor: c.anchor,
      excerpt: c.excerpt,
    })),
  }));

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "save_report_version",
    {
      p_complaint_id: complaintId,
      p_actor_id: actorId,
      p_actor_name: actorName,
      p_intent: input.intent,
      p_outcome: input.outcome,
      p_sections: rpcInput,
    }
  );

  if (rpcError) throw new Error(`Report save failed: ${rpcError.message}`);
  
  const result = rpcResult as { id: string; version: number; status: string; type?: string };

  return {
    id: result.id,
    type: (result.type || "NHRC3") as InvestigationReport["type"],
    version: result.version,
    status: result.status as InvestigationReport["status"],
    outcome: input.outcome,
    updatedAt: now,
    updatedBy: actorName,
    sections: input.sections,
  } satisfies InvestigationReport;
}

export async function recordAiRun(
  complaintId: string,
  actorId: string,
  inputHash: string,
  answer: Answer,
) {
  const supabase = await getDatabase();
  if (!supabase) return;
  const { error } = await supabase.schema("case_management").from("ai_runs").insert({
    complaint_id: complaintId,
    requested_by: actorId,
    purpose: "public_knowledge_legal_research",
    input_hash: inputHash,
    model: answer.model || answer.mode || "evidence",
    output_summary: answer.answer.slice(0, 500),
    review_status: "generated",
  });
  if (error) console.error("AI audit log failed", error);
}

export type ScreeningAssessment = {
  id: string;
  complaintId: string;
  aiRecommendationId?: string;
  officerId: string;
  acceptedOutcome: string;
  acceptedRightsIssues: string[];
  editedAnalysis?: string;
  officerOpinion: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type AiRecommendation = {
  id: string;
  complaintId: string;
  recommendedOutcome: string;
  alternativeOutcomes: string[];
  rightsIssues: string[];
  jurisdictionAnalysis: any;
  similarCases: any;
  legalSources: any;
  confidence: number;
  requiresHumanDecision: boolean;
};

export async function getApprovalWorkflowState(complaintId: string) {
  const supabase = await getDatabase();
  if (!supabase) {
    // Mock for demo mode
    return {
      recommendation: {
        id: crypto.randomUUID(),
        complaintId,
        recommendedOutcome: 'accept_for_investigation',
        alternativeOutcomes: [],
        rightsIssues: ['สิทธิในกระบวนการยุติธรรม'],
        jurisdictionAnalysis: { result: 'within_mandate' },
        similarCases: [],
        legalSources: [],
        confidence: 0.85,
        requiresHumanDecision: true
      } as AiRecommendation,
      assessments: [
        {
          id: crypto.randomUUID(),
          complaintId,
          officerId: 'mock-officer',
          acceptedOutcome: 'accept_for_investigation',
          acceptedRightsIssues: ['สิทธิในกระบวนการยุติธรรม'],
          officerOpinion: 'เห็นควรรับไว้พิจารณา',
          status: 'submitted_for_review',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      ] as ScreeningAssessment[]
    };
  }

  const [aiRec, assessments] = await Promise.all([
    supabase.schema("case_management").from("ai_recommendations").select("*").eq("complaint_id", complaintId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.schema("case_management").from("screening_assessments").select("*").eq("complaint_id", complaintId).order("created_at", { ascending: true })
  ]);

  return {
    recommendation: aiRec.data ? {
      id: asString(aiRec.data.id),
      complaintId: asString(aiRec.data.complaint_id),
      recommendedOutcome: asString(aiRec.data.recommended_outcome),
      alternativeOutcomes: asStrings(aiRec.data.alternative_outcomes),
      rightsIssues: asStrings(aiRec.data.rights_issues),
      jurisdictionAnalysis: aiRec.data.jurisdiction_analysis,
      similarCases: aiRec.data.similar_cases,
      legalSources: aiRec.data.legal_sources,
      confidence: Number(aiRec.data.confidence),
      requiresHumanDecision: Boolean(aiRec.data.requires_human_decision)
    } : null,
    assessments: (assessments.data || []).map((row: any) => ({
      id: asString(row.id),
      complaintId: asString(row.complaint_id),
      aiRecommendationId: asString(row.ai_recommendation_id) || undefined,
      officerId: asString(row.officer_id),
      acceptedOutcome: asString(row.accepted_outcome),
      acceptedRightsIssues: asStrings(row.accepted_rights_issues),
      editedAnalysis: asString(row.edited_analysis) || undefined,
      officerOpinion: asString(row.officer_opinion),
      status: asString(row.status),
      createdAt: asString(row.created_at),
      updatedAt: asString(row.updated_at),
    }))
  };
}

export async function submitApprovalDecision(
  complaintId: string, 
  actorId: string, 
  actorName: string, 
  action: 'approve' | 'reject' | 'send_committee',
  opinion: string
) {
  const supabase = await getDatabase();
  const now = new Date().toISOString();
  
  if (!supabase) {
    const item = demoCases.get(complaintId);
    if (!item) throw new Error("Case not found");
    item.timeline.unshift({
      id: crypto.randomUUID(),
      occurredAt: now,
      title: action === 'approve' ? "เห็นชอบและส่งต่อ" : action === 'reject' ? "ตีกลับให้แก้ไข" : "ส่งเข้าที่ประชุม กสม.",
      description: `ความเห็น: ${opinion}`,
      actor: actorName,
      type: "screening"
    });
    return;
  }
  
  const { data: current } = await supabase.schema("case_management")
    .from("screening_assessments")
    .select("*").eq("complaint_id", complaintId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    
  let nextStatus = 'submitted_for_review';
  if (current) {
     if (current.status === 'submitted_for_review' && action === 'approve') nextStatus = 'approved_by_supervisor';
     else if (current.status === 'approved_by_supervisor' && action === 'approve') nextStatus = 'approved_by_director';
     else if (action === 'reject') nextStatus = 'sent_back';
  }
  
  const { error } = await supabase.schema("case_management").from("screening_assessments").insert({
     complaint_id: complaintId,
     officer_id: actorId,
     accepted_outcome: current?.accepted_outcome || 'pending',
     officer_opinion: opinion,
     status: nextStatus,
     created_at: now,
     updated_at: now
  });
  
  if (error) throw new Error(`Failed to submit approval: ${error.message}`);
  
  await supabase.schema("case_management").from("case_events").insert({
    complaint_id: complaintId,
    occurred_at: now,
    title: action === 'approve' ? "เห็นชอบและส่งต่อ" : action === 'reject' ? "ตีกลับให้แก้ไข" : "ส่งเข้าที่ประชุม กสม.",
    description: `ความเห็น: ${opinion}`,
    actor_name: actorName,
    actor_id: actorId,
    event_type: "screening"
  });
}
