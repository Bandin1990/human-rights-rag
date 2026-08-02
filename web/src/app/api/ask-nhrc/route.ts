/**
 * Ask NHRC - grounded Q&A over the case-note index
 * Finds relevant case notes, then asks Claude to synthesize a cited answer.
 */
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getNhrcRepository } from "@/lib/nhrc/repository";

export const runtime = "nodejs";

interface CitationInfo {
  case_id: string;
  title: string;
  area_code?: string;
  area_name?: string;
  year_buddhist?: number;
  excerpt: string;
}

const DISCLAIMER =
  "ระบบช่วยค้นและจัดประเด็นจากหลักฐานเท่านั้น ไม่ลงข้อยุติว่ามีหรือไม่มีการละเมิดแทน กสม. โปรดเปิดอ่านเอกสารต้นฉบับและตรวจสอบบริบททุกครั้ง";

function buildExcerpt(content: string, maxLen = 600): string {
  return content
    .replace(/^#.*$/m, "")
    .replace(/^##\s*.*$/gm, "")
    .replace(/\[\[([^\|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) {
      return NextResponse.json({ error: "กรุณาระบุคำถาม" }, { status: 400 });
    }
    const useAI = body.useAI !== false; // default on
    const areaCode = typeof body.areaCode === "string" ? body.areaCode : undefined;
    const category = typeof body.category === "string" ? body.category : undefined;

    const repo = getNhrcRepository();
    const matches = repo.findRelevantCases(question, 5, { areaCode, category });

    if (matches.length === 0) {
      return NextResponse.json({
        answer:
          "ยังไม่พบกรณีตรวจสอบที่เกี่ยวข้องกับคำถามนี้เพียงพอ กรุณาลองใช้คำสำคัญ ชื่อประเด็นสิทธิ หรือพื้นที่ที่เฉพาะเจาะจงขึ้น",
        citations: [],
        disclaimer: DISCLAIMER,
        mode: "no-match",
      });
    }

    const citations: CitationInfo[] = matches.map((doc) => ({
      case_id: doc.case_id || doc.document_id,
      title: doc.title,
      area_code: doc.area_code,
      area_name: doc.area_name,
      year_buddhist: doc.year_buddhist,
      excerpt: buildExcerpt(repo.loadContent(doc.document_id) || doc.summary || ""),
    }));

    const evidenceAnswer = () => {
      const evidence = citations
        .map((c, i) => `[${i + 1}] [${c.case_id}] ${c.title}\n${c.excerpt}`)
        .join("\n\n");
      return `พบกรณีตรวจสอบที่เกี่ยวข้องดังนี้\n\n${evidence}\n\nยังไม่สามารถเรียบเรียงคำตอบด้วย AI ได้ในขณะนี้ จึงแสดงหลักฐานโดยตรง`;
    };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!useAI || !apiKey) {
      return NextResponse.json({
        answer: evidenceAnswer(),
        citations,
        disclaimer: DISCLAIMER,
        mode: "evidence",
      });
    }

    // The evidence lookup above always succeeds from the local index; only the
    // LLM call can fail (bad/expired key, rate limit, network). Keep the real
    // citations either way - degrade to evidence-only rather than losing them.
    try {
      const evidenceBlock = citations
        .map(
          (c, i) =>
            `[${i + 1}] [${c.case_id}] ${c.title} (${c.area_name || "ไม่ระบุประเด็น"}, พ.ศ. ${c.year_buddhist || "-"})\n${c.excerpt}`
        )
        .join("\n\n");

      const client = new Anthropic({ apiKey });
      const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

      const response = await client.messages.create({
        model,
        max_tokens: 1024,
        system:
          "คุณเป็นผู้ช่วยค้นคว้ากรณีตรวจสอบของสำนักงานคณะกรรมการสิทธิมนุษยชนแห่งชาติ (กสม.) " +
          "วิเคราะห์ได้เฉพาะจากหลักฐานที่ส่งให้เท่านั้น ห้ามสร้างข้อเท็จจริง กฎหมาย หรือแนววินิจฉัยที่ไม่มีในหลักฐาน " +
          'ห้ามลงข้อยุติว่ามีหรือไม่มีการละเมิดสิทธิมนุษยชนแทนคณะกรรมการสิทธิมนุษยชนแห่งชาติ ใช้ถ้อยคำว่า "มีเหตุให้พิจารณา", ' +
          '"อาจเกี่ยวข้อง" หรือ "หลักฐานยังไม่เพียงพอ" ทุกข้อความสำคัญต้องใส่ citation [1], [2] ตามหมายเลขหลักฐาน ห้ามอ้างเลขที่ไม่มีให้มา ' +
          "ตอบเป็นข้อความธรรมดาเท่านั้น ห้ามใช้ markdown เช่น # หัวข้อ, ** ตัวหนา **, หรือสัญลักษณ์ list พิเศษ ใช้ตัวเลขหรือย่อหน้าธรรมดาแทน",
        messages: [
          {
            role: "user",
            content: `คำถาม: ${question}\n\nหลักฐานที่ค้นคืน:\n${evidenceBlock}\n\nเรียบเรียงคำตอบภาษาไทยที่กระชับ ตรวจสอบย้อนกลับได้ และบอกชัดเมื่อหลักฐานไม่เพียงพอ`,
          },
        ],
      });

      const answerText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      return NextResponse.json({
        answer: answerText,
        citations,
        disclaimer: DISCLAIMER,
        mode: "llm-rag",
        model,
      });
    } catch (error) {
      console.error("Claude call failed; falling back to evidence mode", error);
      return NextResponse.json({
        answer: evidenceAnswer(),
        citations,
        disclaimer: DISCLAIMER,
        mode: "evidence",
      });
    }
  } catch (error) {
    console.error("Ask NHRC failed", error);
    return NextResponse.json(
      { error: "ไม่สามารถประมวลผลคำถามได้ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
