// Node.js --env-file used instead
const { generateText, generateObject } = require('ai');
const { createGoogleGenerativeAI } = require('@ai-sdk/google');
const { z } = require('zod');

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
});

async function testGemini() {
  console.log('Testing Gemini API integration...');
  try {
    // 1. Test generateText
    console.log('\n--- 1. Testing generateText (RAG pattern) ---');
    const textResult = await generateText({
      model: google('gemini-1.5-flash'),
      system: 'คุณเป็นผู้ช่วย กสม.',
      prompt: 'สิทธิในชีวิตและร่างกายคืออะไร ตอบสั้นๆ'
    });
    console.log('Result:', textResult.text);

    // 2. Test generateObject
    console.log('\n--- 2. Testing generateObject (Analysis pattern) ---');
    const objectResult = await generateObject({
      model: google('gemini-1.5-flash'),
      schema: z.object({
        isHumanRights: z.boolean().describe('เป็นเรื่องสิทธิมนุษยชนหรือไม่'),
        reason: z.string().describe('เหตุผล')
      }),
      prompt: 'มีคนถูกตำรวจจับโดยไม่มีหมายจับและถูกทำร้ายร่างกาย เป็นการละเมิดสิทธิมนุษยชนหรือไม่'
    });
    console.log('Result:', JSON.stringify(objectResult.object, null, 2));

    // 3. Test Embeddings
    console.log('\n--- 3. Testing Embeddings ---');
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          { model: "models/text-embedding-004", content: { parts: [{ text: "สิทธิในชีวิตและร่างกาย" }] } }
        ]
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Embedding dimension:', data.embeddings[0].values.length);
      console.log('Success!');
    } else {
      console.error('Embedding error:', await response.text());
    }

  } catch (error) {
    console.error('TEST FAILED:', error);
  }
}

testGemini();
