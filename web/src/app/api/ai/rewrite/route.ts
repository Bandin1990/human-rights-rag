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

    const { text, instruction } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided for rewriting' }, { status: 400 });
    }

    const modelName = process.env.AI_GENERATION_MODEL || 'gpt-4o-mini';

    const systemPrompt = `คุณคือผู้เชี่ยวชาญด้านการเขียนหนังสือราชการและรายงานทางการของคณะกรรมการสิทธิมนุษยชนแห่งชาติ (กสม.)
หน้าที่ของคุณคือปรับแก้ข้อความที่ได้รับให้เป็น "ภาษาราชการ (Formal Thai)" ที่สละสลวย ชัดเจน เป็นกลาง และเหมาะสมกับการใส่ลงในรายงานผลการตรวจสอบ
- ห้ามเปลี่ยนข้อเท็จจริงหลัก
- ปรับคำพูดทั่วไปให้เป็นคำทางการ (เช่น "ตำรวจไม่ยอมรับแจ้งความ" -> "เจ้าพนักงานตำรวจปฏิเสธการรับคำร้องทุกข์")
${instruction ? `- คำสั่งเพิ่มเติม: ${instruction}` : ''}`;

    const { text: rewrittenText } = await generateText({
      model: openai(modelName),
      system: systemPrompt,
      prompt: `ข้อความต้นฉบับ:\n${text}\n\nโปรดปรับแก้ข้อความนี้:`,
    });

    return NextResponse.json({
      success: true,
      rewrittenText,
    });
  } catch (error: any) {
    console.error('AI Rewrite error:', error);
    return NextResponse.json({ error: error.message || 'AI Rewrite failed' }, { status: 500 });
  }
}
