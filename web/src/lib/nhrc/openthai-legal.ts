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

// A section OpenThai's own retriever actually pulled back, with its match
// score - not the LLM's citations JSON (which only lists law+section, no
// text, and is written for a case-note context). Ask NHRC needs the actual
// statute text to cite it as evidence the same way a vault document's
// excerpt is cited.
export interface OpenThaiStatuteMatch {
  law: string;
  section: string;
  text: string;
  score: number;
}

interface OpenThaiResponse {
  choices?: { message?: { content?: string } }[];
  retrieved_documents?: { law?: string; section?: string; text?: string; score?: number }[];
}

const OPENTHAI_URL = "https://api.iapp.co.th/v3/llm/openthai2p0-legal/chat/completions";

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
    const res = await fetch(OPENTHAI_URL, {
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

// General-purpose Thai statute lookup for Ask NHRC - unlike
// getGroundedThaiLaws (case-note-shaped prompt, only returns a bare
// law+section list once an LLM has re-summarized it), this reads
// `retrieved_documents` directly: the actual sections OpenThai's own
// retriever pulled back for the question, full text and score included, no
// extra LLM step needed. That's what let it correctly surface มาตรา 1629
// (score 0.99) for a plain inheritance-law question the NHRC vault has
// nothing about - the NHRC vault only covers 5 human-rights-relevant Thai
// laws, so any question outside that (family law, contracts, property, ...)
// needs this broader 6,300-section corpus instead.
//
// max_tokens is kept small since the chat completion itself is discarded -
// only the retrieval side (which happens regardless of what the model says)
// is used here.
export async function searchThaiStatutes(
  question: string,
  topK: number = 8
): Promise<OpenThaiStatuteMatch[] | null> {
  const apiKey = process.env.IAPP_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(OPENTHAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        model: "openthai2.0-legal",
        rag: true,
        rag_inject: "user",
        rag_top_k: topK,
        temperature: 0,
        max_tokens: 64,
        stream: false,
        chat_template_kwargs: { enable_thinking: false },
        messages: [{ role: "user", content: question }],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error("OpenThai statute search error", res.status, await res.text());
      return null;
    }

    const data = (await res.json()) as OpenThaiResponse;
    if (!Array.isArray(data.retrieved_documents)) return null;
    return data.retrieved_documents
      .filter(
        (d): d is { law: string; section: string; text: string; score: number } =>
          !!d.law && !!d.section && !!d.text && typeof d.score === "number"
      )
      .map((d) => ({ law: d.law, section: d.section, text: d.text, score: d.score }));
  } catch (error) {
    console.error("OpenThai statute search failed", error);
    return null;
  }
}

// Plain "มาตรา NNNN" - matches how sections cite each other in the statute
// text itself (e.g. มาตรา 1629's own text reads "...ภายใต้บังคับแห่งมาตรา
// 1630 วรรค 2...").
const SECTION_CROSS_REF = /มาตรา\s*(\d{1,4})/g;
const MAX_CHASED_REFS = 2;

// A plain similarity search for the user's question can retrieve a section
// that itself hinges on ANOTHER section it merely cross-references, without
// that second section ever surfacing on its own - confirmed live: มาตรา 1629
// (the heir-ranking list) scores highest for an inheritance question and
// gets retrieved, but มาตรา 1630 (the rule that actually cuts off
// lower-ranked heirs, which 1629's own text points to) doesn't score highly
// enough against the *question's* wording to make the top 8 - yet querying
// for "มาตรา 1630" directly finds it instantly (score 0.999). Without
// chasing that reference explicitly, the model has the ranking table but not
// the rule that determines who's actually cut off by it - confirmed live to
// produce a wrong answer (claiming two heir ranks split the estate, when the
// higher rank alone gets all of it).
//
// Bounded to MAX_CHASED_REFS fetches regardless of how many cross-references
// appear, and only looks at sections not already in the initial result set.
export async function chaseStatuteCrossReferences(
  initialMatches: OpenThaiStatuteMatch[]
): Promise<OpenThaiStatuteMatch[]> {
  const known = new Set(initialMatches.map((m) => m.section));
  const refs = new Set<string>();
  for (const m of initialMatches) {
    for (const match of m.text.matchAll(SECTION_CROSS_REF)) {
      if (!known.has(match[1])) refs.add(match[1]);
    }
  }
  const toFetch = Array.from(refs).slice(0, MAX_CHASED_REFS);
  if (toFetch.length === 0) return [];

  const results = await Promise.all(toFetch.map((section) => searchThaiStatutes(`มาตรา ${section}`, 3)));
  const chased: OpenThaiStatuteMatch[] = [];
  toFetch.forEach((section, i) => {
    const exact = results[i]?.find((m) => m.section === section);
    if (exact) chased.push(exact);
  });
  return chased;
}
