import { NextResponse } from "next/server";
import { createComplaint } from "@/lib/cases/repository";
import { ComplaintCreateInput } from "@/types/case";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${process.env.INGEST_API_KEY || "demo-ingest-key"}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    if (!body.title || !body.facts || !body.channel) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const input: ComplaintCreateInput = {
      channel: body.channel,
      title: body.title,
      facts: body.facts,
      desiredOutcome: body.desiredOutcome || "",
      complainantName: body.complainantName || "ไม่ระบุ",
      respondentName: body.respondentName || "ไม่ระบุ",
      location: body.location || "",
      language: body.language || "th",
      rightsIssue: body.rightsIssue || "อื่นๆ",
      priority: body.priority || "normal",
      classification: body.classification || "RESTRICTED",
      protectIdentity: body.protectIdentity === true,
    };

    const actorId = "system-ingest-uuid"; 
    const actorName = "ระบบรับเรื่องอัตโนมัติ";

    const newCase = await createComplaint(input, actorId, actorName);
    
    // TODO: In Phase 3, trigger embedding generation here.
    
    return NextResponse.json({ success: true, caseId: newCase.id, referenceNo: newCase.referenceNo }, { status: 201 });
  } catch (error) {
    console.error("Ingest API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
