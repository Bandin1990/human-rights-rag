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
import { getGroundedThaiLaws } from "@/lib/nhrc/openthai-legal";

export interface LegalRefsResult {
  summary: string;
  internationalInstruments: string[];
  thaiLaws: string[];
  // Additive, not a replacement for thaiLaws: sections OpenThai 2.0 Legal
  // actually retrieved from a real 6,300-section Thai statute corpus (see
  // openthai-legal.ts). Tried using this to *replace* thaiLaws first, but
  // that corpus turned out to be mostly criminal/procedure codes - it came
  // back empty or found only weakly-related sections for labor/PDPA-style
  // NHRC cases, silently dropping the more on-topic laws Claude's own recall
  // already had right. Kept as an empty-by-default bonus list instead: only
  // shown when it actually found something, so it can only add value.
  groundedThaiLaws: string[];
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
      groundedThaiLaws: [],
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
    const content = caseDoc.content || caseDoc.summary || "";

    // Run Claude (summary + international instruments + a memory-based
    // Thai-law guess as fallback) alongside the statute-corpus-grounded
    // Thai law lookup - independent calls, no reason to serialize them.
    const [response, groundedThaiLaws] = await Promise.all([
      client.messages.create({
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
            content: `ชื่อกรณี: ${caseDoc.title}\n\nเนื้อหา:\n${content.slice(0, 4000)}`,
          },
        ],
      }),
      getGroundedThaiLaws(caseDoc.title, content),
    ]);

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const result = parseJsonFromText(text);
    if (!result) return null;

    // Add the statute-corpus-grounded citations alongside (not instead of)
    // Claude's own list - see the field comment on groundedThaiLaws.
    if (groundedThaiLaws && groundedThaiLaws.length > 0) {
      result.groundedThaiLaws = groundedThaiLaws.map((c) => `${c.law} มาตรา ${c.section}`);
    }

    cache.set(caseId, result);
    return result;
  } catch (error) {
    console.error("Legal refs generation failed", error);
    return null;
  }
}
