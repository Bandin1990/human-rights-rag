import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { fileId, storagePath } = await request.json();

    if (!fileId && !storagePath) {
      return NextResponse.json({ error: 'No file provided for transcription' }, { status: 400 });
    }

    // Simulate AI delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // For this Phase 3 implementation without a real audio file, we return a mock transcript.
    const mockTranscript = `เมื่อวันที่ 15 มกราคม 2569 เวลาประมาณ 10.00 น. ข้าพเจ้าได้เดินทางไปที่สถานีตำรวจ...
(เสียงผู้ถูกสัมภาษณ์): "ทางเจ้าหน้าที่ตำรวจบอกว่าเรื่องนี้เป็นเรื่องส่วนตัว ไม่ยอมรับแจ้งความครับ ผมจึงมาร้องเรียนที่ กสม."`;

    return NextResponse.json({
      success: true,
      transcriptionText: mockTranscript,
      fileId,
    });
  } catch (error: any) {
    console.error('AI Transcription error:', error);
    return NextResponse.json({ error: error.message || 'AI Transcription failed' }, { status: 500 });
  }
}
