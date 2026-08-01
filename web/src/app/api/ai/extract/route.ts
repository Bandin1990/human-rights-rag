import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// We use Vercel AI SDK to extract information from unstructured text (e.g., transcripts or emails).
// The policy AI_CASE_DATA_ENABLED must be true for the API to run.

export async function POST(request: Request) {
  try {
    const aiEnabled = process.env.AI_CASE_DATA_ENABLED === 'true';
    if (!aiEnabled) {
      return NextResponse.json(
        { error: 'AI Case Data processing is disabled by policy. Set AI_CASE_DATA_ENABLED=true to allow.' },
        { status: 403 }
      );
    }

    const { content, sourceId } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'No content provided for extraction' }, { status: 400 });
    }

    const modelName = process.env.AI_EXTRACTION_MODEL || 'gpt-4o-mini';

    const { object } = await generateObject({
      model: openai(modelName),
      schema: z.object({
        fields: z.array(z.object({
          fieldName: z.enum([
            'complainantName', 'complainantContact', 'victimName', 'respondentName', 
            'incidentDate', 'incidentLocation', 'allegationSummary', 'desiredOutcome', 
            'urgentRisk'
          ]),
          extractedValue: z.string().nullable().describe('The extracted text value, or null if not found'),
          confidence: z.number().min(0).max(1).describe('Confidence score between 0 and 1'),
          sourceExcerpt: z.string().nullable().describe('The exact substring from the text that justifies this extraction'),
          pageNumber: z.number().nullable().describe('The page number or 1 if not applicable')
        })),
        rightsIssues: z.array(z.string()).describe('ประเด็นสิทธิมนุษยชนที่อาจเกี่ยวข้อง (อ้างอิงจากเนื้อหา)')
      }),
      prompt: `คุณคือผู้ช่วยสกัดข้อมูลเรื่องร้องเรียนด้านสิทธิมนุษยชน
กรุณาอ่านข้อความต่อไปนี้และสกัดข้อมูลลงในแบบฟอร์มให้ถูกต้องที่สุด
สำหรับแต่ละฟิลด์ ให้ดึงข้อความที่เป็นต้นทาง (sourceExcerpt) มาด้วย
ถ้าไม่มีข้อมูลในส่วนไหนให้ตอบ null ใน extractedValue และ sourceExcerpt อย่าแต่งเรื่องขึ้นมาเอง

ข้อความ:
${content}
`,
    });

    // We transform the structure slightly to simulate what the UI expects for field verification
    return NextResponse.json({
      success: true,
      extractedData: {
        fields: object.fields.reduce((acc: any, field) => {
          acc[field.fieldName] = {
            value: field.extractedValue,
            confidence: field.confidence,
            sourceExcerpt: field.sourceExcerpt,
            pageNumber: field.pageNumber,
            status: 'generated'
          };
          return acc;
        }, {}),
        rightsIssues: object.rightsIssues
      },
      sourceId,
    });
  } catch (error: any) {
    console.error('AI Extraction error:', error);
    return NextResponse.json({ error: error.message || 'AI Extraction failed' }, { status: 500 });
  }
}
