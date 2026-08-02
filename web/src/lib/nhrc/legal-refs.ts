/**
 * AI-suggested legal references for a case note - short summary + related
 * international human rights instruments / Thai laws, inferred by Claude
 * from the case content.
 *
 * Explicitly unverified: callers must label this "AI-suggested" and never
 * present it as a confirmed legal citation. The user has accepted this
 * tradeoff for now and will curate real citations into Obsidian later.
 */
import Anthropic from "@anthropic-ai/sdk";
import { getNhrcRepository } from "@/lib/nhrc/repository";

export interface LegalRefsResult {
  summary: string;
  internationalInstruments: string[];
  thaiLaws: string[];
}

// Cheap in-memory cache so re-visiting a case during this server's lifetime
// doesn't re-call Claude every time. Not persisted - resets on server restart.
const cache = new Map<string, LegalRefsResult>();

function parseJsonFromText(text: string): LegalRefsResult | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      internationalInstruments: Array.isArray(parsed.internationalInstruments)
        ? parsed.internationalInstruments.filter((v: unknown) => typeof v === "string")
        : [],
      thaiLaws: Array.isArray(parsed.thaiLaws)
        ? parsed.thaiLaws.filter((v: unknown) => typeof v === "string")
        : [],
    };
  } catch {
    return null;
  }
}

export async function getLegalRefs(caseId: string): Promise<LegalRefsResult | null> {
  const cached = cache.get(caseId);
  if (cached) return cached;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const repo = getNhrcRepository();
  const caseDoc = repo.getCaseWithContent(caseId);
  if (!caseDoc) return null;

  try {
    const client = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system:
        "คุณช่วยวิเคราะห์บันทึกกรณีตรวจสอบของสำนักงานคณะกรรมการสิทธิมนุษยชนแห่งชาติ (กสม.) " +
        "ตอบเป็น JSON เท่านั้น ไม่มีข้อความอื่นนอก JSON ตามรูปแบบ: " +
        '{"summary": "สรุปสั้น 1-2 ประโยค", "internationalInstruments": ["ชื่อตราสารระหว่างประเทศ + มาตราที่เกี่ยวข้อง"], "thaiLaws": ["ชื่อกฎหมายไทย + มาตราที่เกี่ยวข้อง"]} ' +
        "ระบุเฉพาะตราสาร/กฎหมายที่มั่นใจว่าเกี่ยวข้องจริงตามหลักสิทธิมนุษยชนสากลและกฎหมายไทยที่มีอยู่จริงเท่านั้น " +
        "ห้ามสร้างชื่อกฎหมายหรือมาตราที่ไม่มีอยู่จริงขึ้นมา หากไม่มั่นใจให้เป็น array ว่าง",
      messages: [
        {
          role: "user",
          content: `ชื่อกรณี: ${caseDoc.title}\n\nเนื้อหา:\n${(caseDoc.content || caseDoc.summary || "").slice(0, 4000)}`,
        },
      ],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const result = parseJsonFromText(text);
    if (!result) return null;

    cache.set(caseId, result);
    return result;
  } catch (error) {
    console.error("Legal refs generation failed", error);
    return null;
  }
}
