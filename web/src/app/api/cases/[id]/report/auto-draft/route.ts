import { NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { getCaseActor } from "@/lib/cases/auth";
import { getComplaintCase } from "@/lib/cases/repository";
import { REPORT_SECTION_DEFINITIONS_NHRC2, REPORT_SECTION_DEFINITIONS_NHRC3 } from "@/types/case";

export const runtime = "nodejs";
export const maxDuration = 60;

const DraftSchema = z.object({
  outcome: z.enum(["violation", "no_violation", "terminated", "pending"]),
  sections: z.record(z.string(), z.string()).describe("Key คือรหัสส่วนของรายงาน, Value คือเนื้อหาที่ร่างให้"),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getCaseActor();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const complaint = await getComplaintCase(id);
    if (!complaint) return NextResponse.json({ error: "Case not found" }, { status: 404 });

    const body = await request.json();
    const { aiRecommendations, reportType = "NHRC2" } = body; // Array of selected issues from Phase 3

    const defs = reportType === "NHRC2" ? REPORT_SECTION_DEFINITIONS_NHRC2 : REPORT_SECTION_DEFINITIONS_NHRC3;

    if (!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)) {
      // Demo mode: Generate realistic mock data based on evidence and report type
      const demoSections: Record<string, string> = {};
      
      const isNHRC2 = reportType === "NHRC2";
      
      demoSections["parties"] = isNHRC2 
        ? `ผู้ร้อง: ${complaint.parties.find(p => p.role === 'complainant')?.displayName || 'ไม่ระบุ'}\nผู้ถูกร้อง: ${complaint.parties.find(p => p.role === 'respondent')?.displayName || 'ไม่ระบุ'}`
        : `ผู้ร้อง: ${complaint.parties.find(p => p.role === 'complainant')?.displayName || 'ไม่ระบุ'}\nผู้ถูกร้อง: ${complaint.parties.find(p => p.role === 'respondent')?.displayName || 'ไม่ระบุ'}`;

      demoSections["background"] = `๑.๑ เรื่องร้องเรียน\nเมื่อวันที่ ${complaint.receivedAt ? new Date(complaint.receivedAt).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }) : "ไม่ระบุ"} คณะกรรมการสิทธิมนุษยชนแห่งชาติได้รับเรื่องร้องเรียนว่า ${complaint.summary}\n\n๑.๒ ประเด็นการละเมิดสิทธิมนุษยชน\nผู้ร้องเรียนกล่าวอ้างว่ามีการละเมิดสิทธิมนุษยชนในประเด็น: ${complaint.allegations.length > 0 ? complaint.allegations.join(", ") : "ไม่ระบุ"}`;

      // ดึงรายการพยานหลักฐานมาจัดรูปแบบ
      let evidenceList = "";
      if (complaint.evidence && complaint.evidence.length > 0) {
        evidenceList = complaint.evidence.map((ev, i) => {
          const typeName = ev.type === "document" ? "เอกสาร" : ev.type === "statement" ? "บันทึกถ้อยคำ" : ev.type === "audio" ? "ไฟล์เสียง" : "หลักฐาน";
          return `${i + 1}. ${ev.title} (ประเภท: ${typeName}) ได้มาจาก ${ev.source} เมื่อวันที่ ${ev.obtainedAt}`;
        }).join("\n");
      } else {
        evidenceList = "ไม่มีรายการพยานหลักฐานในระบบ";
      }

      demoSections[isNHRC2 ? "investigation" : "proceedings"] = isNHRC2 
        ? `๒.๑ พยานหลักฐานที่รวบรวมได้\nในการตรวจสอบข้อเท็จจริง คณะกรรมการสิทธิมนุษยชนแห่งชาติได้รวบรวมพยานหลักฐานดังต่อไปนี้:\n${evidenceList}\n\n๒.๒ ข้อเท็จจริงจากการตรวจสอบ\nจากการตรวจสอบพยานหลักฐานและข้อเท็จจริง พบว่ามีเหตุการณ์ที่สอดคล้องกับข้อร้องเรียน โดยมีประเด็นสำคัญดังนี้: ...`
        : `๒.๑ ข้อมูลวิชาการและกฎหมายที่เกี่ยวข้อง\n- พ.ร.บ. หลักประกันสุขภาพแห่งชาติ\n- ปฏิญญาสากลว่าด้วยสิทธิมนุษยชน\n\n๒.๒ ข้อเท็จจริงจากการตรวจสอบและการรวบรวมพยานหลักฐาน\nในการดำเนินการ คณะกรรมการสิทธิมนุษยชนแห่งชาติได้รวบรวมพยานหลักฐานดังนี้:\n${evidenceList}\n\nจากการตรวจสอบพบว่า...`;

      demoSections["nhrc_opinion"] = "จากการตรวจสอบข้อเท็จจริงและพยานหลักฐาน ประกอบกับข้อกฎหมายที่เกี่ยวข้อง คณะกรรมการสิทธิมนุษยชนแห่งชาติเห็นว่า...";

      demoSections["recommendations"] = "๑. ให้ผู้ถูกร้องปรับปรุงระเบียบปฏิบัติ...\n๒. ให้หน่วยงานที่เกี่ยวข้องซักซ้อมความเข้าใจ...";

      return NextResponse.json({ outcome: "violation", sections: demoSections });
    }

    const { object } = await generateObject({
      model: google("gemini-1.5-flash"),
      schema: DraftSchema,
      messages: [
        {
          role: "system",
          content: `คุณคือ AI ผู้ช่วยเจ้าหน้าที่คณะกรรมการสิทธิมนุษยชนแห่งชาติ (กสม.) หน้าที่ของคุณคือร่างรายงานผลการตรวจสอบ หรือรายงานข้อเสนอแนะ 
ประเภทรายงาน: ${reportType === "NHRC2" ? "กสม. 2 (รายงานการตรวจสอบการละเมิดสิทธิมนุษยชน)" : "กสม. 3 (รายงานข้อเสนอแนะ)"}

คำสั่งสำคัญ (CRITICAL INSTRUCTIONS):
1. เขียนด้วยภาษาทางการ (Formal Language) และภาษากฎหมายสิทธิมนุษยชนที่ถูกต้อง 
2. อ้างอิงรัฐธรรมนูญ กฎหมายภายใน กติการะหว่างประเทศ ให้ถูกต้องตามแบบแผนของหน่วยงานรัฐ
3. โครงสร้างรายงานต้องสอดคล้องกับรายงานฉบับจริงของ กสม. โดยมีหัวข้อย่อย เช่น ๒.๑, ๒.๒ ตามความเหมาะสม 
4. ร่างเนื้อหาให้ครบทุกส่วน (Sections) ตามที่กำหนดด้านล่าง ห้ามข้ามส่วนใดส่วนหนึ่ง

รูปแบบ section keys ที่ต้องร่างเนื้อหา: ${defs.map(s => s.key).join(", ")}
คำอธิบายแต่ละส่วน:
${defs.map(s => `- ${s.key} (${s.title}): ${s.requirement}`).join("\n")}`
        },
        {
          role: "user",
          content: `ข้อเท็จจริงของเรื่องนี้:
เรื่อง: ${complaint.title}
พฤติการณ์: ${complaint.summary}
ข้อกล่าวอ้าง: ${complaint.allegations.join(", ")}
ประเด็นสิทธิที่เจ้าหน้าที่เลือกให้วิเคราะห์: ${aiRecommendations?.join(", ") || "ไม่ระบุ"}

กรุณาร่างรายงานอย่างเป็นทางการตามข้อมูลข้างต้น`
        }
      ]
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error("Auto Draft Error:", error);
    return NextResponse.json({ error: "Failed to generate draft" }, { status: 500 });
  }
}
