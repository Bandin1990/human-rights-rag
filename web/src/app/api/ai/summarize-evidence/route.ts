import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { content, allegations, type } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'No content provided for summarization' }, { status: 400 });
    }

    // Simulate AI delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Determine mock based on type of evidence to fit Section 2
    let reportSectionFormat = "";
    if (type === "document") {
      reportSectionFormat = "หนังสือชี้แจงระบุว่าหน่วยงานได้ปฏิบัติตามขั้นตอนตามกฎหมาย แต่ยังพบความล่าช้าในกระบวนการส่งต่อข้อมูล";
    } else if (type === "statement") {
      reportSectionFormat = "จากการสอบปากคำพบว่าผู้เสียหายไม่ได้รับการแจ้งสิทธิ และถูกจำกัดการสื่อสาร";
    } else {
      reportSectionFormat = "พยานหลักฐานบ่งชี้ถึงข้อเท็จจริงสอดคล้องกับข้อกล่าวอ้าง";
    }

    const mockInsights = {
      summary: reportSectionFormat,
      keyPeople: ["ผู้ร้อง ก.", "เจ้าหน้าที่โรงพยาบาล ข."],
      timeline: [
        { date: "15 ม.ค. 2569", event: "เกิดเหตุและมีการบันทึกภาพ" },
        { date: "16 ม.ค. 2569", event: "ยื่นเรื่องร้องเรียนและส่งหลักฐานเพิ่มเติม" }
      ],
      relevanceToAllegations: [
        {
          allegation: allegations ? allegations.split(',')[0] : "ข้อกล่าวหาหลัก",
          supports: true,
          reason: "เอกสารและบันทึกถ้อยคำยืนยันตรงกันถึงพฤติการณ์ที่ถูกร้องเรียน"
        }
      ]
    };

    return NextResponse.json({
      success: true,
      evidenceInsights: mockInsights,
    });
  } catch (error: any) {
    console.error('AI Evidence Summarization error:', error);
    return NextResponse.json({ error: 'AI Evidence Summarization failed' }, { status: 500 });
  }
}
