/**
 * Thai statute citations for a case, grounded in iApp's OpenThai 2.0 Legal
 * model (RAG retrieval over a 6,300-section Thai statute corpus) instead of
 * asking an LLM to recall law names purely from memory. See legal-refs.ts
 * for how this combines with the (still memory-based) international-
 * instrument suggestions from Claude.
 *
 * Free via IAPP_API_KEY until 24 Aug 2026: https://iapp.co.th/openmodels/openthai2p0-legal
 * Returns null (never throws) whenever the key is missing or the call fails,
 * so callers can fall back to the existing AI-recall behavior.
 */

export interface GroundedThaiLaw {
  law: string;
  section: string;
}

interface OpenThaiResponse {
  choices?: { message?: { content?: string } }[];
}

function parseCitations(text: string): GroundedThaiLaw[] | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed.citations)) return null;
    return (parsed.citations as unknown[])
      .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
      .map((c) => ({
        law: typeof c.law === "string" ? c.law : "",
        section: typeof c.section === "string" ? c.section : "",
      }))
      .filter((c) => c.law && c.section);
  } catch {
    return null;
  }
}

export async function getGroundedThaiLaws(
  caseTitle: string,
  caseContent: string
): Promise<GroundedThaiLaw[] | null> {
  const apiKey = process.env.IAPP_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.iapp.co.th/v3/llm/openthai2p0-legal/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        model: "openthai2.0-legal",
        rag: true,
        rag_inject: "user",
        rag_top_k: 8,
        temperature: 0,
        max_tokens: 1024,
        stream: false,
        chat_template_kwargs: { enable_thinking: false },
        messages: [
          {
            role: "system",
            content:
              "คุณเป็นผู้ช่วยทางกฎหมายไทย ตอบเป็น JSON เท่านั้น ไม่มีข้อความอื่นนอก JSON ตามรูปแบบ: " +
              '{"citations": [{"law": "ชื่อกฎหมาย", "section": "เลขมาตรา"}]} ' +
              "ระบุเฉพาะมาตราที่พบจริงในเอกสารที่ดึงมาให้ (retrieved context) เท่านั้น " +
              "ห้ามอ้างมาตราที่ไม่ปรากฏในเอกสารที่ดึงมา หากไม่พบมาตราที่เกี่ยวข้องชัดเจน ให้ citations เป็น array ว่าง",
          },
          {
            role: "user",
            content: `กรณีตรวจสอบของ กสม.: ${caseTitle}\n\n${caseContent.slice(0, 3000)}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      console.error("OpenThai legal API error", res.status, await res.text());
      return null;
    }

    const data = (await res.json()) as OpenThaiResponse;
    const text = data.choices?.[0]?.message?.content || "";
    return parseCitations(text);
  } catch (error) {
    console.error("Grounded Thai law lookup failed", error);
    return null;
  }
}
