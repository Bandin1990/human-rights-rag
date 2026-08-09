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
async function findRelevantDocuments(
  repo: ReturnType<typeof getNhrcRepository>,
  question: string,
  limit: number,
  scope: { areaCode?: string; category?: string }
): Promise<NhrcDocument[]> {
  const semanticMatches = await semanticSearch(question, 60);
  if (semanticMatches && semanticMatches.length > 0) {
    const scored = semanticMatches
      .map((m) => ({ doc: repo.getCaseById(m.documentId), similarity: m.similarity }))
      .filter((s): s is { doc: NhrcDocument; similarity: number } => {
        if (!s.doc) return false;
        if (scope.areaCode && s.doc.area_code !== scope.areaCode) return false;
        if (scope.category && s.doc.category !== scope.category) return false;
        return true;
      });

    if (scored.length > 0) {
      // Caller already pinned a category (left-nav filter) - no need to
      // diversify, just take the best matches within it.
      if (scope.category) {
        return scored.slice(0, limit).map((s) => s.doc);
      }

      const topSimilarity = scored[0].similarity;
      const floor = Math.max(MIN_SIMILARITY_FLOOR, topSimilarity - 0.12);
      const byCategory = new Map<string, { doc: NhrcDocument; similarity: number }[]>();
      for (const s of scored) {
        if (s.similarity < floor) continue;
        const key = s.doc.category || "อื่นๆ";
        const list = byCategory.get(key) || [];
        if (list.length < PER_CATEGORY_CAP) {
          list.push(s);
          byCategory.set(key, list);
        }
      }
      const diversified = Array.from(byCategory.values())
        .flat()
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map((s) => s.doc);
      if (diversified.length > 0) return diversified;
    }
  }
  return repo.findRelevantCases(question, limit, scope);
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
    const matches = await findRelevantDocuments(repo, question, RESULT_LIMIT, { areaCode, category });

    if (matches.length === 0) {
      return NextResponse.json({
        answer:
          "ยังไม่พบเอกสารที่เกี่ยวข้องกับคำถามนี้เพียงพอ กรุณาลองใช้คำสำคัญ ชื่อประเด็นสิทธิ หรือพื้นที่ที่เฉพาะเจาะจงขึ้น",
        citations: [],
        disclaimer: DISCLAIMER,
        mode: "no-match",
      });
    }

    const citations: CitationInfo[] = matches.map((doc) => ({
      case_id: doc.case_id || doc.document_id,
      title: doc.title,
      category: doc.category,
      area_code: doc.area_code,
      area_name: doc.area_name,
      year_buddhist: doc.year_buddhist,
      excerpt: buildExcerpt(repo.loadContent(doc.document_id) || doc.summary || ""),
    }));

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!useAI || !apiKey) {
      return NextResponse.json({
        answer: evidenceAnswer(citations),
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
            `[${i + 1}] ${c.title} (หมวด: ${c.category || "ไม่ระบุ"}${c.area_name ? `, ประเด็น: ${c.area_name}` : ""}${
              c.year_buddhist ? `, พ.ศ. ${c.year_buddhist}` : ""
            })\n${c.excerpt}`
        )
        .join("\n\n");

      const client = new Anthropic({ apiKey });
      const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        system:
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
          "ห้ามใช้ตาราง ห้ามใช้ตัวเอียง ห้ามอ้างอิงหมายเลขหลักฐานที่ไม่ได้ให้มา",
        messages: [
          {
            role: "user",
            content: `คำถาม: ${question}\n\nหลักฐานที่ค้นคืน (จากทุกหมวดในคลังความรู้):\n${evidenceBlock}\n\nเรียบเรียงคำตอบภาษาไทยตามโครงสร้างที่กำหนด ตรวจสอบย้อนกลับได้ทุกจุด และบอกชัดเมื่อหลักฐานไม่เพียงพอ`,
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
        answer: evidenceAnswer(citations),
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
