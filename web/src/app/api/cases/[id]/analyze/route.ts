import { NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { getCaseActor } from "@/lib/cases/auth";
import { getComplaintCase } from "@/lib/cases/repository";
import { createEmbedding, embeddingToHalfvec } from "@/lib/embeddings";
import { isCaseDemoMode } from "@/lib/cases/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const RecommendationSchema = z.object({
  similarCases: z.array(z.string()).describe("รายการอ้างอิงเลขที่รับเรื่องของคดีเดิมที่คล้ายกัน"),
  rightsIssues: z.array(z.string()).describe("ประเด็นสิทธิมนุษยชนที่เกี่ยวข้อง (เช่น สิทธิชุมชน, สิทธิในกระบวนการยุติธรรม)"),
  requiredEvidence: z.array(z.string()).describe("พยานหลักฐานที่ควรต้องแสวงหาเพิ่มเติมสำหรับกรณีนี้"),
  suggestedAction: z.string().describe("ข้อเสนอแนะเบื้องต้นว่าควรรับไว้พิจารณาหรือไม่ หรือส่งต่อหน่วยงานใด"),
  rationale: z.string().describe("เหตุผลประกอบข้อเสนอแนะสั้นๆ"),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getCaseActor();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { id } = await params;
    const complaint = await getComplaintCase(id);
    if (!complaint) return NextResponse.json({ error: "Case not found" }, { status: 404 });

    const supabase = isCaseDemoMode() ? null : await createClient();
    if (!supabase) {
      // Demo mode without Supabase
      return NextResponse.json({
        similarCases: ["DEMO-66-0001", "DEMO-66-0012"],
        rightsIssues: ["สิทธิในกระบวนการยุติธรรม", "สิทธิในชีวิตและร่างกาย"],
        requiredEvidence: ["รายงานการชันสูตร", "บันทึกการจับกุม", "ภาพถ่ายสถานที่เกิดเหตุ"],
        suggestedAction: "ควรรับเรื่องไว้พิจารณา",
        rationale: "เป็นข้อกล่าวหาว่าเจ้าหน้าที่รัฐกระทำการละเมิดสิทธิ ซึ่งอยู่ในอำนาจหน้าที่ของ กสม.",
        isDemo: true,
      });
    }

    // Generate Embedding if not exist
    const { data: existingEmbedding } = await supabase
      .schema("case_management")
      .from("complaint_embeddings")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    const caseContext = `${complaint.title}\n${complaint.summary || ""}\n${complaint.allegations.join(" ")}`;

    if (!existingEmbedding && (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)) {
      try {
        const embedding = await createEmbedding(caseContext);
        await supabase.schema("case_management").from("complaint_embeddings").insert({
          id,
          embedding: embeddingToHalfvec(embedding) as any, // Supabase TS typing might need cast
        });
      } catch (err) {
        console.error("Failed to generate embedding for case:", err);
      }
    }

    // Search similar cases
    let similarContext = "";
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
      try {
        const queryEmbedding = await createEmbedding(caseContext);
        const { data: matches } = await supabase.rpc("match_complaints", {
          query_embedding: embeddingToHalfvec(queryEmbedding) as any,
          match_threshold: 0.5,
          match_count: 3
        });
        
        if (matches && matches.length > 0) {
          const matchIds = matches.filter((m: any) => m.id !== id).map((m: any) => m.id);
          if (matchIds.length > 0) {
            const { data: simCases } = await supabase
              .schema("case_management")
              .from("complaints")
              .select("reference_no, title, summary")
              .in("id", matchIds);
              
            if (simCases) {
              similarContext = simCases.map(c => `คดีที่คล้ายกัน เลขที่ ${c.reference_no}: ${c.title}`).join("\n");
            }
          }
        }
      } catch (err) {
        console.error("Failed to search similar cases:", err);
      }
    }

    if (!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)) {
      throw new Error("Missing GEMINI_API_KEY");
    }

    const { object } = await generateObject({
      model: google("gemini-1.5-flash"),
      schema: RecommendationSchema,
      messages: [
        {
          role: "system",
          content: "คุณเป็นผู้ช่วยวิเคราะห์เรื่องร้องเรียนของ กสม. กรุณาวิเคราะห์ข้อเท็จจริงและให้คำแนะนำที่สอดคล้องกับอำนาจหน้าที่ของ กสม."
        },
        {
          role: "user",
          content: `ชื่อเรื่อง: ${complaint.title}\nข้อเท็จจริง: ${caseContext}\n\nคดีในอดีตที่คล้ายกัน:\n${similarContext}\n\nกรุณาวิเคราะห์ประเด็นสิทธิ หลักฐานที่ควรหาเพิ่ม และข้อเสนอแนะในการดำเนินการ`
        }
      ]
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error("Case Analyze API Error:", error);
    return NextResponse.json({ error: "Failed to analyze case" }, { status: 500 });
  }
}
