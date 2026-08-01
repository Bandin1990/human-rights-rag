import { NextResponse } from "next/server";
import { answerKnowledge } from "@/lib/knowledge/repository";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const documentId = typeof body.documentId === "string" ? body.documentId : undefined;
    const category = typeof body.category === "string" ? body.category : undefined;
    const useAI = typeof body.useAI === "boolean" ? body.useAI : true;

    if (!question) {
      return NextResponse.json({ error: "กรุณาระบุคำถาม" }, { status: 400 });
    }

    return NextResponse.json(await answerKnowledge(question, documentId, category, useAI));
  } catch (error) {
    console.error("Ask AI failed", error);
    return NextResponse.json(
      { error: "Ask AI ยังไม่สามารถค้นหาหลักฐานได้ กรุณาตรวจสอบการเชื่อมต่อคลังข้อมูลและลองอีกครั้ง" },
      { status: 500 },
    );
  }
}
