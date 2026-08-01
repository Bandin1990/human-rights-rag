import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { getCaseActor } from "@/lib/cases/auth";

export const runtime = "nodejs";
export const maxDuration = 60; 

const OCRSchema = z.object({
  title: z.string().describe("ชื่อเรื่องร้องเรียนหรือหัวข้อหลักของเอกสาร"),
  facts: z.string().describe("ข้อเท็จจริง พฤติการณ์ หรือรายละเอียดการละเมิดทั้งหมด"),
  desiredOutcome: z.string().describe("ความประสงค์ของผู้ร้อง หรือสิ่งที่ต้องการให้ กสม. ดำเนินการ"),
  complainantName: z.string().describe("ชื่อผู้ร้องเรียน (หากไม่มีระบุให้ปล่อยว่าง)"),
  respondentName: z.string().describe("ชื่อผู้ถูกร้องเรียน หรือหน่วยงานที่ถูกกล่าวหา"),
  location: z.string().describe("สถานที่เกิดเหตุ หรือพื้นที่ที่เกี่ยวข้อง"),
  rightsIssue: z.string().describe("ประเด็นสิทธิมนุษยชนที่เกี่ยวข้อง (ตัวอย่างเช่น: สิทธิในกระบวนการยุติธรรม, สิทธิชุมชน, สิทธิแรงงาน)"),
});

export async function POST(request: Request) {
  try {
    const actor = await getCaseActor();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const { object } = await generateObject({
      model: openai("gpt-4o"),
      schema: OCRSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "กรุณาอ่านข้อมูลจากเอกสารคำร้องเรียนนี้ สกัดข้อมูลสำคัญออกมาใส่ฟอร์มให้ถูกต้องและครบถ้วนที่สุด หากไม่พบข้อมูลใดให้ปล่อยว่าง" },
            { type: "file", data: buffer, mediaType: file.type }
          ]
        }
      ]
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error("OCR API Error:", error);
    return NextResponse.json({ error: "Failed to process document" }, { status: 500 });
  }
}
