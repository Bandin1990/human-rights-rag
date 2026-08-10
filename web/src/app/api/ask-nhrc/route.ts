/**
 * Ask NHRC - grounded Q&A over the full NHRC knowledge base (case notes,
 * research, situation reports, Thai law, international HR law + treaty-body
 * general comments/recommendations). Finds relevant documents across every
 * category, then asks Claude to synthesize a structured, cited answer.
 */
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getNhrcRepository, NhrcDocument } from "@/lib/nhrc/repository";
import { semanticSearch } from "@/lib/nhrc/semantic-search";

export const runtime = "nodejs";

const RESULT_LIMIT = 10; // total evidence items sent to the LLM/shown as citations
const PER_CATEGORY_CAP = 3; // max items from any single category, when browsing "all"
const MIN_SIMILARITY_FLOOR = 0.55; // below this, a doc isn't worth citing even to "fill" a category

// A previous turn, as sent by nhrc-workspace.tsx's chatHistory. Re-capped and
// re-truncated here too - never trust the client's own limits for something
// that feeds directly into an LLM call's cost.
interface ChatTurn {
  role: "user" | "ai";
  text: string;
}
const MAX_HISTORY_TURNS = 6; // last 3 exchanges
const MAX_HISTORY_TURN_CHARS = 1500; // a full ~6144-token answer would otherwise dominate the next turn's input cost

// Every question used to be answered as if it were the first one ever asked
// - the chat UI shows prior turns on screen, but the API only ever saw the
// latest `question` string, so an obvious follow-up ("ข้อ 2 ที่พูดถึงมี
// รายละเอียดอะไรเพิ่ม") retrieved and answered on completely unrelated
// evidence with no way to know what "ข้อ 2" even referred to. Two fixes,
// both needing `history`:
//   1. Retrieval: prepend the immediately preceding user question to the
//      new one before embedding/searching (buildSearchText below) - a short
//      follow-up alone often carries almost no topical signal on its own.
//   2. Synthesis: pass prior turns as real conversation messages to Claude
//      (buildConversationMessages below) so it can actually resolve "ข้อ 2"
//      against what *it* said last turn, not just the fresh evidence list.
function sanitizeHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (t): t is ChatTurn =>
        !!t && (t.role === "user" || t.role === "ai") && typeof t.text === "string"
    )
    .slice(-MAX_HISTORY_TURNS)
    .map((t) => ({ role: t.role, text: t.text.slice(0, MAX_HISTORY_TURN_CHARS) }));
}

function buildSearchText(question: string, history: ChatTurn[]): string {
  const priorUserTurn = [...history].reverse().find((t) => t.role === "user");
  return priorUserTurn ? `${priorUserTurn.text} ${question}` : question;
}

function buildConversationMessages(
  history: ChatTurn[]
): { role: "user" | "assistant"; content: string }[] {
  return history.map((t) => ({ role: t.role === "ai" ? "assistant" : "user", content: t.text }));
}

// A question can be substantively about something a Thai law or
// international instrument covers without echoing that document's own
// wording closely enough to clear MIN_SIMILARITY_FLOOR or win its slot
// against closer-but-less-legally-specific matches (e.g. a case note that
// literally repeats the question's phrasing). Since these two categories
// are exactly what a กสม. officer needs to ground an answer legally,
// actively backfill one match from each if a plausible one exists anywhere
// in the wider candidate pool - "if there's something relevant" (per the
// user's own framing), not "force something in regardless of relevance".
const LAW_BACKFILL_CATEGORIES = ["กฎหมายไทย", "กฎหมายสิทธิมนุษยชนระหว่างประเทศและเอกสารตีความ"];
const LAW_BACKFILL_MIN_SIMILARITY = 0.45;

// Real (embedding-based) search first, since it understands paraphrased
// questions the old literal-keyword-substring match couldn't (see
// repository.ts's findRelevantCases). Falls back to that keyword match
// when semantic search isn't configured (no Gemini/Supabase env vars),
// errors, or - after applying the area/category scope, which the vector
// index doesn't know about - comes back empty.
//
// When no specific category is pinned by the caller, a pure top-N cut by
// cosine similarity tends to be a monoculture: for a broad question, the
// closest neighbors are often all the same category (e.g. research reports
// whose titles happen to echo the question's wording) even though the KB
// also holds directly-relevant case precedent, treaty text, and Thai
// statutes. Diversify by capping how many results any one category can
// contribute, so a broad question actually draws from every part of the
// knowledge base that has a genuinely relevant hit - not just whichever
// category dominates raw similarity.
// A retrieved document paired with whichever chunk of it actually matched
// the question (see semantic-search.ts) - undefined when the match came
// from the keyword fallback below, which doesn't know about chunks.
interface ScoredDoc {
  doc: NhrcDocument;
  similarity: number;
  chunkText: string | undefined;
}

async function findRelevantDocuments(
  repo: ReturnType<typeof getNhrcRepository>,
  question: string,
  limit: number,
  scope: { areaCode?: string; category?: string }
): Promise<{ doc: NhrcDocument; chunkText?: string }[]> {
  const semanticMatches = await semanticSearch(question, 60);
  if (semanticMatches && semanticMatches.length > 0) {
    const scored = semanticMatches
      .map((m) => ({ doc: repo.getCaseById(m.documentId), similarity: m.similarity, chunkText: m.chunkText }))
      .filter((s): s is ScoredDoc => {
        if (!s.doc) return false;
        if (scope.areaCode && s.doc.area_code !== scope.areaCode) return false;
        if (scope.category && s.doc.category !== scope.category) return false;
        return true;
      });

    if (scored.length > 0) {
      // Caller already pinned a category (left-nav filter) - no need to
      // diversify, just take the best matches within it.
      if (scope.category) {
        return scored.slice(0, limit);
      }

      const topSimilarity = scored[0].similarity;
      const floor = Math.max(MIN_SIMILARITY_FLOOR, topSimilarity - 0.12);
      const byCategory = new Map<string, ScoredDoc[]>();
      for (const s of scored) {
        if (s.similarity < floor) continue;
        const key = s.doc.category || "อื่นๆ";
        const list = byCategory.get(key) || [];
        if (list.length < PER_CATEGORY_CAP) {
          list.push(s);
          byCategory.set(key, list);
        }
      }
      const diversifiedScored = Array.from(byCategory.values())
        .flat()
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      // Backfill law/instrument categories missing from the cut above (see
      // LAW_BACKFILL_CATEGORIES) - drop the current weakest match to make
      // room if the evidence set is already full, so RESULT_LIMIT still
      // caps what's sent to the LLM/shown as citations.
      for (const cat of LAW_BACKFILL_CATEGORIES) {
        if (diversifiedScored.some((s) => s.doc.category === cat)) continue;
        const best = scored
          .filter((s) => s.doc.category === cat && s.similarity >= LAW_BACKFILL_MIN_SIMILARITY)
          .sort((a, b) => b.similarity - a.similarity)[0];
        if (!best) continue;
        if (diversifiedScored.length < limit) {
          diversifiedScored.push(best);
        } else {
          diversifiedScored.sort((a, b) => b.similarity - a.similarity);
          diversifiedScored[diversifiedScored.length - 1] = best;
        }
      }
      diversifiedScored.sort((a, b) => b.similarity - a.similarity);
      if (diversifiedScored.length > 0) {
        return diversifiedScored.map((s) => ({ doc: s.doc, chunkText: s.chunkText }));
      }
    }
  }
  return repo.findRelevantCases(question, limit, scope).map((doc) => ({ doc }));
}

interface CitationInfo {
  case_id: string;
  title: string;
  category?: string;
  area_code?: string;
  area_name?: string;
  year_buddhist?: number;
  excerpt: string;
}

const DISCLAIMER =
  "ระบบช่วยค้นและจัดประเด็นจากหลักฐานเท่านั้น ไม่ลงข้อยุติว่ามีหรือไม่มีการละเมิดแทน กสม. โปรดเปิดอ่านเอกสารต้นฉบับและตรวจสอบบริบททุกครั้ง";

// The chunk (or, for the keyword-fallback path with no chunk info, the raw
// document content) still gets run through this to strip Markdown noise
// before it reaches the prompt. maxLen is a safety cap, not the real length
// control anymore: a semantic match's chunkText is already sized to
// CHUNK_SIZE by embed-nhrc-documents.mjs (currently 3000 chars, plus a
// small overlap), so this basically never truncates it further. It still
// matters for the keyword-search fallback (no Supabase/Gemini configured,
// or a category filter with zero semantic hits), which has no chunk
// boundaries to work with and slices straight from the top of the file.
function buildExcerpt(content: string, maxLen = 4000): string {
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

// Plain-evidence fallback (no LLM available/failed) - still grouped by
// category with "## " headers so the frontend's lightweight markdown
// renderer (components/markdown-lite.tsx) presents it as organized
// sections rather than one undifferentiated wall of text.
function evidenceAnswer(citations: CitationInfo[]): string {
  const order: string[] = [];
  const byCategory = new Map<string, CitationInfo[]>();
  citations.forEach((c, i) => {
    const key = c.category || "อื่นๆ";
    if (!byCategory.has(key)) {
      byCategory.set(key, []);
      order.push(key);
    }
    byCategory.get(key)!.push({ ...c, case_id: `${i + 1}::${c.case_id}` }); // stash original index
  });

  const sections = order.map((cat) => {
    const items = byCategory
      .get(cat)!
      .map((c) => {
        const [num, caseId] = c.case_id.split("::");
        return `**แหล่งที่มา:** [${num}] ${caseId} — ${c.title}\n\n${c.excerpt}`;
      })
      .join("\n\n");
    return `## ${cat}\n\n${items}`;
  });

  return (
    `พบเอกสารที่เกี่ยวข้องจากหลายหมวดในคลังความรู้ ดังนี้\n\n` +
    sections.join("\n\n") +
    `\n\nยังไม่สามารถเรียบเรียงคำตอบด้วย AI ได้ในขณะนี้ จึงแสดงหลักฐานโดยตรง`
  );
}

const SYSTEM_PROMPT =
  "คุณเป็นผู้ช่วยค้นคว้าและวิเคราะห์ของสำนักงานคณะกรรมการสิทธิมนุษยชนแห่งชาติ (กสม.) " +
  "วิเคราะห์ได้เฉพาะจากหลักฐานที่ส่งให้เท่านั้น ห้ามสร้างข้อเท็จจริง เลขคดี มาตรา หรือแนววินิจฉัยที่ไม่มีในหลักฐาน " +
  'ห้ามลงข้อยุติว่ามีหรือไม่มีการละเมิดสิทธิมนุษยชนแทนคณะกรรมการสิทธิมนุษยชนแห่งชาติ ใช้ถ้อยคำว่า "มีเหตุให้พิจารณา", ' +
  '"อาจเกี่ยวข้อง" หรือ "หลักฐานยังไม่เพียงพอ"\n\n' +
  "จัดรูปแบบคำตอบเป็น Markdown ที่มีโครงสร้างชัดเจนตามนี้เสมอ:\n" +
  "1. เปิดด้วยย่อหน้าสั้น 1-2 ประโยค สรุปภาพรวมสิ่งที่พบ ห้ามขึ้นต้นบรรทัดนี้ด้วยเครื่องหมาย # ใด ๆ (ไม่ใช่หัวข้อ)\n" +
  "2. แบ่งเนื้อหาเป็นหัวข้อย่อยด้วย '## ' ทีละประเด็น/แหล่งอ้างอิง เรียงจากเกี่ยวข้องมากไปน้อย " +
  "ถ้าหลักฐานมีมากกว่าหนึ่งหมวด (เช่น กรณีตรวจสอบจริงของ กสม., ตราสาร/ความเห็นทั่วไประหว่างประเทศ, กฎหมายไทย, งานวิจัย) " +
  "ให้ครอบคลุมหลายหมวดในคำตอบเดียว ห้ามพูดถึงหมวดเดียวแล้วละเลยหมวดอื่นที่มีหลักฐานให้\n" +
  "3. ใต้แต่ละหัวข้อ ให้ขึ้นบรรทัด '**แหล่งที่มา:** [n] ชื่อเอกสาร' ตามหมายเลขหลักฐานที่ให้มาเท่านั้น ห้ามอ้างเลขที่ไม่มี\n" +
  "4. ตามด้วยคำอธิบาย/ตีความสั้น 2-4 ประโยค ใส่ [n] กำกับทุกข้อความสำคัญ\n" +
  "5. ถ้ามีเงื่อนไขหรือข้อควรพิจารณาหลายข้อ ให้ใช้ bullet list ('- ')\n" +
  "6. ปิดท้ายด้วยหัวข้อ '## สรุปแนวทาง' รวมข้อเสนอแนะเชิงปฏิบัติสั้น ๆ จากหลักฐานทั้งหมด\n\n" +
  "ห้ามใช้ตาราง ห้ามใช้ตัวเอียง ห้ามอ้างอิงหมายเลขหลักฐานที่ไม่ได้ให้มา\n\n" +
  "หากมีบทสนทนาก่อนหน้าแนบมาด้วย ให้ใช้บทสนทนานั้นทำความเข้าใจว่าคำถามใหม่นี้อ้างอิงถึงอะไร " +
  "(เช่น \"ข้อ 2 ที่พูดถึง\" หมายถึงหัวข้อที่สองในคำตอบก่อนหน้าของคุณเอง) แต่หมายเลขหลักฐาน [n] ในคำตอบใหม่นี้ " +
  "ต้องอ้างอิงเฉพาะหลักฐานชุดใหม่ที่แนบมาในข้อความล่าสุดเท่านั้น ห้ามใช้เลขอ้างอิงจากคำตอบก่อนหน้า";

// Every event on the stream is one line of JSON (newline-delimited, not SSE -
// this is a same-origin POST body, not a GET EventSource) so the client can
// parse it incrementally as chunks arrive. "status" lines drive the
// fourcorners.law-style progress UI (see nhrc-workspace.tsx's runAsk); they
// describe what's genuinely happening server-side right now, not a fake
// timed animation - each one is only sent once that stage actually starts.
type StreamEvent =
  | { type: "status"; message: string }
  | { type: "citations"; citations: CitationInfo[]; disclaimer: string }
  | { type: "delta"; text: string }
  | { type: "done"; mode: "llm-rag" | "evidence" | "no-match"; model?: string }
  | { type: "error"; message: string };

export async function POST(req: Request) {
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      try {
        const body = await req.json();
        const question = typeof body.question === "string" ? body.question.trim() : "";
        if (!question) {
          send({ type: "error", message: "กรุณาระบุคำถาม" });
          return finish();
        }
        const useAI = body.useAI !== false; // default on
        const areaCode = typeof body.areaCode === "string" ? body.areaCode : undefined;
        const category = typeof body.category === "string" ? body.category : undefined;
        const history = sanitizeHistory(body.history);

        send({ type: "status", message: "กำลังค้นหาเอกสารที่เกี่ยวข้องในคลังความรู้..." });

        const repo = getNhrcRepository();
        const searchText = buildSearchText(question, history);
        const matches = await findRelevantDocuments(repo, searchText, RESULT_LIMIT, { areaCode, category });

        if (matches.length === 0) {
          send({
            type: "citations",
            citations: [],
            disclaimer: DISCLAIMER,
          });
          send({ type: "delta", text: "ยังไม่พบเอกสารที่เกี่ยวข้องกับคำถามนี้เพียงพอ กรุณาลองใช้คำสำคัญ ชื่อประเด็นสิทธิ หรือพื้นที่ที่เฉพาะเจาะจงขึ้น" });
          send({ type: "done", mode: "no-match" });
          return finish();
        }

        send({ type: "status", message: `พบเอกสารที่เกี่ยวข้อง ${matches.length} รายการ กำลังวิเคราะห์หลักฐาน...` });

        const citations: CitationInfo[] = matches.map(({ doc, chunkText }) => ({
          case_id: doc.case_id || doc.document_id,
          title: doc.title,
          category: doc.category,
          area_code: doc.area_code,
          area_name: doc.area_name,
          year_buddhist: doc.year_buddhist,
          // Prefer the actual matched chunk over re-slicing the raw file from
          // the top - see findRelevantDocuments/semantic-search.ts. Falls back
          // to the old top-of-file behaviour when there's no chunk (keyword
          // search fallback path).
          excerpt: buildExcerpt(chunkText || repo.loadContent(doc.document_id) || doc.summary || ""),
        }));

        send({ type: "citations", citations, disclaimer: DISCLAIMER });

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!useAI || !apiKey) {
          send({ type: "delta", text: evidenceAnswer(citations) });
          send({ type: "done", mode: "evidence" });
          return finish();
        }

        // The evidence lookup above always succeeds from the local index; only
        // the LLM call can fail (bad/expired key, rate limit, network). Keep
        // the real citations either way - degrade to evidence-only rather
        // than losing them.
        try {
          send({ type: "status", message: "กำลังเรียบเรียงคำตอบด้วย AI..." });

          const evidenceBlock = citations
            .map(
              (c, i) =>
                `[${i + 1}] ${c.title} (หมวด: ${c.category || "ไม่ระบุ"}${c.area_name ? `, ประเด็น: ${c.area_name}` : ""}${
                  c.year_buddhist ? `, พ.ศ. ${c.year_buddhist}` : ""
                })\n${c.excerpt}`
            )
            .join("\n\n");

          const client = new Anthropic({ apiKey });
          const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

          // 2048 (and then 4096) both cut real answers off mid-sentence once
          // the evidence backfill (LAW_BACKFILL_CATEGORIES) + longer
          // excerpts (see buildExcerpt) gave the model enough material to
          // write a genuinely multi-category structured answer - confirmed
          // via live tests where the last section stopped mid-word both
          // times. 6144 leaves headroom for a full "summary + up to ~4
          // category sections + สรุปแนวทาง" answer; the final stop_reason is
          // logged below so a future case that still hits the ceiling is
          // visible in server logs instead of just silently truncating.
          //
          // Streamed (not .create()) so the client can render text as it's
          // generated instead of waiting for the full ~6000-token
          // completion - this is most of what makes Ask NHRC *feel* slow,
          // since the full non-streamed round trip can take 10-20s.
          const llmStream = client.messages.stream({
            model,
            max_tokens: 6144,
            system: SYSTEM_PROMPT,
            // Prior turns (see sanitizeHistory/buildConversationMessages) go
            // in first as real conversation history - this is what lets a
            // follow-up like "ข้อ 2 ที่พูดถึงมีรายละเอียดอะไรเพิ่ม" resolve
            // against Claude's own previous answer instead of being answered
            // as if it were the first question ever asked. The evidence
            // list below is still fresh for *this* turn only, and citation
            // numbers still restart at [1] each turn (see SYSTEM_PROMPT) -
            // history gives Claude memory of what it already said, not a
            // second bag of citable sources.
            messages: [
              ...buildConversationMessages(history),
              {
                role: "user",
                content: `คำถาม: ${question}\n\nหลักฐานที่ค้นคืน (จากทุกหมวดในคลังความรู้):\n${evidenceBlock}\n\nเรียบเรียงคำตอบภาษาไทยตามโครงสร้างที่กำหนด ตรวจสอบย้อนกลับได้ทุกจุด และบอกชัดเมื่อหลักฐานไม่เพียงพอ`,
              },
            ],
          });

          llmStream.on("text", (delta) => send({ type: "delta", text: delta }));

          const finalMessage = await llmStream.finalMessage();
          if (finalMessage.stop_reason === "max_tokens") {
            console.warn(`Ask NHRC answer hit max_tokens (6144) and was truncated for question: "${question}"`);
          }

          send({ type: "done", mode: "llm-rag", model });
          finish();
        } catch (error) {
          console.error("Claude call failed; falling back to evidence mode", error);
          send({ type: "delta", text: evidenceAnswer(citations) });
          send({ type: "done", mode: "evidence" });
          finish();
        }
      } catch (error) {
        console.error("Ask NHRC failed", error);
        send({ type: "error", message: "ไม่สามารถประมวลผลคำถามได้ กรุณาลองใหม่อีกครั้ง" });
        finish();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
