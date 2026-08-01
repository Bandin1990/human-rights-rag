import { NextResponse } from "next/server";
import { canCreateComplaint, getCaseActor } from "@/lib/cases/auth";
import { createComplaint } from "@/lib/cases/repository";
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
  };
}

export async function POST(request: Request) {
  try {
    const actor = await getCaseActor();
    if (!actor) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    if (!canCreateComplaint(actor)) return NextResponse.json({ error: "บทบาทของคุณไม่มีสิทธิรับเรื่องใหม่" }, { status: 403 });
    const input = parseInput(await request.json());
    if (!input) return NextResponse.json({ error: "ข้อมูลรับเรื่องไม่ครบหรือไม่ถูกต้อง" }, { status: 400 });
    const complaint = await createComplaint(input, actor.id, actor.name);
    return NextResponse.json({ id: complaint.id, referenceNo: complaint.referenceNo }, { status: 201 });
  } catch (error) {
    console.error("Complaint creation failed", error);
    return NextResponse.json({ error: "ยังบันทึกเรื่องร้องเรียนไม่ได้ กรุณาตรวจการเชื่อมต่อและลองอีกครั้ง" }, { status: 500 });
  }
}
