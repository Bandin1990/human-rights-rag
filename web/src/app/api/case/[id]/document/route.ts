/**
 * Serves a document's source PDF (see repository.getSourcePdfPath()).
 * Not every document has one - case notes call this hopefully, situation
 * reports always have one, everything else usually doesn't yet.
 */
import { NextResponse } from "next/server";
import * as fs from "fs";
import { getNhrcRepository } from "@/lib/nhrc/repository";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getNhrcRepository();
  const doc = repo.getCaseById(id);
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const pdfPath = repo.getSourcePdfPath(doc.document_id);
  if (!pdfPath) {
    return NextResponse.json({ error: "No source PDF for this document" }, { status: 404 });
  }

  const buffer = fs.readFileSync(pdfPath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.title)}.pdf"`,
    },
  });
}
