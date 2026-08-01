import { NextResponse } from "next/server";
import { getCaseActor } from "@/lib/cases/auth";
import { getComplaintCase, updateComplaint } from "@/lib/cases/repository";
import type { ComplaintCreateInput } from "@/types/case";

export const runtime = "nodejs";

const CHANNELS = ["ยื่นต่อสำนักงาน", "ยื่นต่อกรรมการ", "ไปรษณีย์", "ระบบอิเล็กทรอนิกส์", "วาจา", "โทรศัพท์", "หน่วยงานของรัฐส่งมา", "คณะกรรมการหยิบยก"];
const LANGUAGES = ["th", "en", "th-en"];
const PRIORITIES = ["normal", "urgent", "critical"];
const CLASSIFICATIONS = ["RESTRICTED", "HIGHLY_SENSITIVE"];

function parseInput(value: unknown): ComplaintCreateInput | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const required = ["channel", "title", "facts", "desiredOutcome", "complainantName", "respondentName", "location", "language", "rightsIssue", "priority", "classification"];
  if (required.some((key) => typeof body[key] !== "string" || !String(body[key]).trim())) return null;
  if (!CHANNELS.includes(String(body.channel)) || !LANGUAGES.includes(String(body.language)) || !PRIORITIES.includes(String(body.priority)) || !CLASSIFICATIONS.includes(String(body.classification))) return null;
  if (String(body.title).length > 220 || String(body.facts).length > 12_000 || String(body.desiredOutcome).length > 4_000) return null;
  return {
    channel: String(body.channel),
    title: String(body.title).trim(),
    facts: String(body.facts).trim(),
    desiredOutcome: String(body.desiredOutcome).trim(),
    complainantName: String(body.complainantName).trim(),
    respondentName: String(body.respondentName).trim(),
    location: String(body.location).trim(),
    language: body.language as ComplaintCreateInput["language"],
    rightsIssue: String(body.rightsIssue).trim(),
    priority: body.priority as ComplaintCreateInput["priority"],
    classification: body.classification as ComplaintCreateInput["classification"],
    protectIdentity: body.protectIdentity === true,
    officerOpinion: body.officerOpinion ? String(body.officerOpinion).trim() : undefined,
  };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getCaseActor();
    if (!actor) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    
    const { id } = await params;
    const existing = await getComplaintCase(id);
    if (!existing) return NextResponse.json({ error: "ไม่พบเรื่องร้องเรียนนี้" }, { status: 404 });
    
    if (existing.assignedOfficer !== actor.name && !actor.demo) {
      return NextResponse.json({ error: "คุณไม่มีสิทธิแก้ไขเรื่องร้องเรียนนี้ เนื่องจากคุณไม่ใช่เจ้าของเรื่อง" }, { status: 403 });
    }

    const input = parseInput(await request.json());
    if (!input) return NextResponse.json({ error: "ข้อมูลรับเรื่องไม่ครบหรือไม่ถูกต้อง" }, { status: 400 });
    
    const complaint = await updateComplaint(id, input, actor.id, actor.name);
    return NextResponse.json({ id: complaint.id, referenceNo: complaint.referenceNo }, { status: 200 });
  } catch (error) {
    console.error("Complaint update failed", error);
    return NextResponse.json({ error: "บันทึกการแก้ไขไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  }
}
