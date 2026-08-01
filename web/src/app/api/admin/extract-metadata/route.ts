import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
// @ts-expect-error: pdf-parse does not have a default export in its types
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow more time for AI processing

export async function POST(req: Request) {
  try {
    // Basic auth check
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const textData = formData.get('text') as string | null;

    let textContent = '';

    if (textData) {
      textContent = textData;
    } else if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      if (file.name.endsWith('.pdf')) {
        const pdfData = await pdfParse(buffer);
        textContent = pdfData.text;
      } else if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
        const result = await mammoth.extractRawText({ buffer });
        textContent = result.value;
      } else if (file.name.endsWith('.md') || file.name.endsWith('.txt')) {
        textContent = buffer.toString('utf-8');
      } else {
        return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'No file or text provided' }, { status: 400 });
    }

    if (!textContent.trim()) {
      return NextResponse.json({ error: 'Could not extract text from input' }, { status: 400 });
    }

    // Call Gemini API for extraction
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Server missing GEMINI_API_KEY' }, { status: 500 });
    }

    const systemPrompt = `You are an AI assistant specialized in human rights documents and Thai law. 
Your task is to extract information from the following document and output ONLY a valid JSON object matching the exact structure requested. Do not include markdown code blocks or any other text.
If a value is not found, use an empty string or empty array.
Structure required:
{
  "title": "string (The title of the document)",
  "category": "string (One of: รายงานตรวจสอบ/ข้อเสนอแนะ กสม., รายงานประเมินสถานการณ์, กฎหมายสิทธิมนุษยชนระหว่างประเทศและเอกสารตีความ, คลังความรู้ด้านสิทธิมนุษยชน, กฎหมายไทย, คำพิพากษาศาลต่างประเทศ, คำพิพากษาศาลไทย. Guess the best fit)",
  "documentNumber": "string (e.g. ฎีกาที่ 1481/2568, or empty)",
  "buddhistYear": "string (e.g. 2568, or empty)",
  "agency": "string (e.g. ศาลฎีกา, กสม., or empty)",
  "sourceSystem": "string (e.g. ศาลยุติธรรม, กสม. or empty)",
  "shortSummary": "string (A 3-4 line summary of the main points)",
  "longSummary": "string (A detailed summary)",
  "timeline": [
    {
      "order": "string (e.g. ศาลชั้นต้น, 1, 2)",
      "title": "string (Event title)",
      "subtitle": "string (Optional subtitle)",
      "description": "string (Event details)"
    }
  ],
  "relatedPersons": [
    {
      "role": "string (e.g. โจทก์, จำเลย)",
      "names": "string (Comma separated names)"
    }
  ],
  "relatedInternationalLaws": ["string"],
  "relatedThaiLaws": ["string"]
}
`;

    // Send request to Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ 
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [{
          parts: [{ text: `Please extract metadata from this text:\n\n${textContent.slice(0, 30000)}` }]
        }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Gemini error: ${err.error?.message || 'Unknown error'}`);
    }

    const payload = await response.json();
    const resultText = payload.candidates[0].content.parts[0].text;
    const extractedData = JSON.parse(resultText);

    return NextResponse.json(extractedData);
  } catch (error: any) {
    console.error('Extraction failed:', error);
    return NextResponse.json({ error: error.message || 'Failed to extract metadata' }, { status: 500 });
  }
}
