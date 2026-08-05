/**
 * Serves a document's source PDF. Not every document has one - case notes
 * call this hopefully, situation reports always have one, everything else
 * usually doesn't yet.
 *
 * Two sources, tried in order:
 *  1. Local disk (data/nhrc_documents/) - present in local dev, absent in
 *     production (1.4GB of raw scans, deliberately excluded from git).
 *  2. Google Drive, via the mapping built by scripts/upload_pdfs_to_drive.py
 *     - what production actually serves from.
 */
import { NextResponse } from "next/server";
import * as fs from "fs";
import { getNhrcRepository } from "@/lib/nhrc/repository";
import { fetchDrivePdf } from "@/lib/nhrc/drive";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getNhrcRepository();
  const doc = repo.getCaseById(id);
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const pdfPath = repo.getSourcePdfPath(doc.document_id);
  let buffer: Buffer | null = pdfPath ? fs.readFileSync(pdfPath) : null;

  if (!buffer) {
    const driveFileId = repo.getDrivePdfFileId(doc.document_id);
    if (driveFileId) {
      buffer = await fetchDrivePdf(driveFileId);
    }
  }

  if (!buffer) {
    return NextResponse.json({ error: "No source PDF for this document" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.title)}.pdf"`,
    },
  });
}
