import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { searchKnowledge } from '@/lib/knowledge/repository';

export async function POST(request: Request) {
  try {
    const aiEnabled = process.env.AI_CASE_DATA_ENABLED === 'true';
    if (!aiEnabled) {
      return NextResponse.json(
        { error: 'AI Case Data processing is disabled by policy. Set AI_CASE_DATA_ENABLED=true to allow.' },
        { status: 403 }
      );
    }

    const { complaintId, facts, desiredOutcome } = await request.json();

    if (!facts) {
      return NextResponse.json({ error: 'No facts provided for screening' }, { status: 400 });
    }

    // --- NEW: Perform RAG Search to get legal context ---
    let legalContext = "ไม่มีข้อมูลระเบียบที่เกี่ยวข้องชัดเจน";
    try {
      const searchResults = await searchKnowledge({ query: facts });
      if (searchResults && searchResults.results && searchResults.results.length > 0) {
        // Build a context string from the top 3 relevant documents
        legalContext = searchResults.results
          .slice(0, 3)
          .map((doc, idx) => `[เอกสาร ${idx + 1}] ${doc.title}\nเนื้อหา: ${doc.summary || "ไม่ระบุ"}\nหมวดหมู่สิทธิ: ${doc.categories?.join(", ")}`)
          .join("\n\n");
      }
    } catch (e) {
      console.warn("Failed to retrieve RAG context for screening", e);
    }
    // --------------------------------------------------

    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash'; // Reasoning model for screening

    const { object } = await generateObject({
      model: google(modelName),
      schema: z.object({
        recommendedOutcome: z.enum(['accept_for_investigation', 'protection', 'assistance', 'reject', 'refer'])
          .describe('ข้อเสนอแนะหลักสำหรับการดำเนินการ'),
        alternativeOutcomes: z.array(z.string()).describe('ทางเลือกการดำเนินการอื่นๆ ที่เป็นไปได้ (ถ้ามี)'),
        rightsIssues: z.array(z.string()).describe('ประเด็นสิทธิที่เกี่ยวข้อง เช่น สิทธิในชีวิต สิทธิในกระบวนการยุติธรรม'),
        jurisdictionAnalysis: z.object({
          withinMandate: z.boolean().describe('อยู่ในหน้าที่และอำนาจของ กสม. หรือไม่'),
          reasons: z.array(z.string()).describe('เหตุผลประกอบการวิเคราะห์อำนาจหน้าที่ (อ้างอิงจากกฎหมายที่ค้นพบเท่านั้น)'),
        }),
        missingEvidence: z.array(z.string()).describe('ข้อเท็จจริงหรือพยานหลักฐานที่ยังขาดและควรหาเพิ่ม'),
        legalSources: z.array(z.string()).describe('ฐานกฎหมายที่ใช้อ้างอิงจากเอกสารอ้างอิงที่ให้ไปเท่านั้น'),
        confidence: z.number().min(0).max(1).describe('ระดับความเชื่อมั่นของ AI'),
        requiresHumanDecision: z.boolean().default(true).describe('แจ้งเตือนว่าต้องใช้คนตัดสินใจขั้นสุดท้ายเสมอ'),
      }),
      prompt: `คุณคือผู้ช่วยกลั่นกรองเรื่องร้องเรียนของคณะกรรมการสิทธิมนุษยชนแห่งชาติ (กสม.)
หน้าที่ของคุณคือวิเคราะห์ว่าเรื่องร้องเรียนนี้อยู่ในอำนาจหน้าที่หรือไม่ และควรเสนอแนะให้ดำเนินการอย่างไร

ข้อเท็จจริง:
${facts}

ความประสงค์ของผู้ร้อง:
${desiredOutcome}

ข้อมูลกฎหมายและระเบียบที่เกี่ยวข้อง (ค้นพบจากระบบ RAG):
${legalContext}

คำสั่ง:
1. วิเคราะห์อำนาจหน้าที่โดยอิงจาก "ข้อมูลกฎหมายและระเบียบที่เกี่ยวข้อง" ที่ให้มานี้เท่านั้น ห้ามสร้างข้อกฎหมายหรือแต่งขึ้นเอง
2. หากไม่พบกฎหมายที่ให้รับเรื่อง ให้ระบุเหตุผลว่าขาดข้อมูลหรืออยู่นอกอำนาจหน้าที่
3. ให้เหตุผลประกอบการวินิจฉัยอย่างสมเหตุสมผล
`,
    });

    return NextResponse.json({
      success: true,
      screeningAnalysis: object,
      complaintId,
    });
  } catch (error: any) {
    console.error('AI Screening error:', error);
    return NextResponse.json({ error: error.message || 'AI Screening failed' }, { status: 500 });
  }
}
