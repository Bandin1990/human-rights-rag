import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getCaseActor } from "@/lib/cases/auth";
import { getComplaintCase, recordAiRun } from "@/lib/cases/repository";
import { answerKnowledge } from "@/lib/knowledge/repository";
import { answerFromMockDocuments } from "@/lib/knowledge/mock-repository";

export const runtime = "nodejs";

function redactSensitiveText(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[อีเมลถูกปกปิด]")
    .replace(/(?<!\d)\d{1}-?\d{4}-?\d{5}-?\d{2}-?\d(?!\d)/g, "[เลขประจำตัวถูกปกปิด]")
    .replace(/(?<!\d)(?:\+?66|0)\d[\d -]{7,10}(?!\d)/g, "[เบอร์โทรถูกปกปิด]")
    .trim()
    .slice(0, 800);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getCaseActor();
    if (!actor) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const { id } = await params;
    const complaint = await getComplaintCase(id);
    if (!complaint) return NextResponse.json({ error: "ไม่พบสำนวนหรือคุณไม่มีสิทธิเข้าถึง" }, { status: 404 });
    const body = (await request.json()) as Record<string, unknown>;
    const rawQuery = typeof body.query === "string" ? body.query.trim() : "";
    if (rawQuery.length < 3 || rawQuery.length > 1_500) return NextResponse.json({ error: "กรุณาระบุคำค้น 3–1,500 ตัวอักษร" }, { status: 400 });

    const safeQuery = redactSensitiveText(rawQuery);
    const answer = actor.demo ? answerFromMockDocuments(safeQuery) : await answerKnowledge(safeQuery);
    const inputHash = createHash("sha256").update(safeQuery).digest("hex");
    await recordAiRun(id, actor.id, inputHash, answer);
    return NextResponse.json({ ...answer, redacted: safeQuery !== rawQuery });
  } catch (error) {
    console.error("Case RAG failed", error);
    return NextResponse.json({ error: "ยังค้นคลังความรู้ไม่ได้ กรุณาลองอีกครั้ง" }, { status: 500 });
  }
}
