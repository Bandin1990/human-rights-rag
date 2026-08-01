import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(request: Request) {
  try {
    const aiEnabled = process.env.AI_CASE_DATA_ENABLED === 'true';
    if (!aiEnabled) {
      return NextResponse.json(
        { error: 'AI Case Data processing is disabled by policy. Set AI_CASE_DATA_ENABLED=true to allow.' },
        { status: 403 }
      );
    }

    const { sectionType, caseData } = await request.json();

    if (!sectionType || !caseData) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const modelName = process.env.AI_GENERATION_MODEL || 'gpt-4o'; 

    let systemPrompt = `คุณคือผู้ช่วยร่างรายงานการตรวจสอบการละเมิดสิทธิมนุษยชนของคณะกรรมการสิทธิมนุษยชนแห่งชาติ (กสม.)
ให้ร่างข้อความด้วยภาษาราชการ (Formal Thai) ที่กระชับ ชัดเจน เป็นกลาง และอ้างอิงจากข้อมูลที่ให้มาเท่านั้น ห้ามแต่งเติมข้อเท็จจริง`;

    let userPrompt = `ข้อมูลคดี:
- หัวเรื่อง: ${caseData.title || "-"}
- ข้อเท็จจริงตั้งต้น: ${caseData.summary || "-"}
- ประเด็นสิทธิ: ${caseData.rightsIssues?.join(", ") || "-"}
- ความประสงค์: ${caseData.desiredOutcome || "-"}
- ฐานกฎหมาย: ${caseData.legalBasis || "-"}
- พยานหลักฐานที่มี: ${caseData.evidence ? JSON.stringify(caseData.evidence.map((e: any) => ({ title: e.title, content: e.content, supports: e.supportsAllegations }))) : "-"}

โปรดร่างเนื้อหาสำหรับส่วน: "${sectionType}"
`;

    if (sectionType === 'facts') {
      userPrompt += `\nคำสั่งพิเศษ: ให้ประมวลและสรุปข้อเท็จจริงที่ได้จากการตรวจสอบโดยอิงจาก "พยานหลักฐานที่มี" เท่านั้น เรียบเรียงให้เป็นลำดับเหตุการณ์ที่เข้าใจง่ายและสอดคล้องกัน`;
    } else if (sectionType === 'opinion') {
      userPrompt += `\nคำสั่งพิเศษ: ให้ประมวลและเรียบเรียงความเห็น โดยนำข้อเท็จจริงที่รับฟังได้มาวินิจฉัยเข้ากับ "ประเด็นสิทธิ" และ "ฐานกฎหมาย" ที่เกี่ยวข้อง หากมีหลายประเด็นให้แยกวินิจฉัยทีละประเด็นอย่างเป็นเหตุเป็นผล`;
    } else if (sectionType === 'recommendations') {
      userPrompt += `\nคำสั่งพิเศษ: ให้ร่างข้อเสนอแนะของ กสม. โดยแบ่งเป็นหมวดหมู่ (ถ้ามี) เช่น ข้อเสนอแนะมาตรการ, ข้อเสนอแนะเชิงส่งเสริมและคุ้มครอง, ข้อเสนอแนะเชิงกฎหมาย หรือข้อสังเกต แล้วแต่กรณีความเหมาะสมของคดีนี้`;
    } else {
      userPrompt += `\nคำสั่งพิเศษ: เรียบเรียงเนื้อหาให้เหมาะสมกับหัวข้อนี้ตามรูปแบบรายงาน กสม.`;
    }

    const { text } = await generateText({
      model: openai(modelName),
      system: systemPrompt,
      prompt: userPrompt,
    });

    return NextResponse.json({
      success: true,
      draftContent: text,
    });
  } catch (error: any) {
    console.error('AI Draft Report error:', error);
    return NextResponse.json({ error: error.message || 'AI Draft Report failed' }, { status: 500 });
  }
}
