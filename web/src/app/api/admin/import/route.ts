import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { isAdmin } from "@/lib/admin-auth";
import { createEmbeddings, embeddingToHalfvec } from "@/lib/embeddings";
import { getAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

type ParsedSection = { page: number | null; heading: string; content: string };

const allowedStatuses = new Set([
  "draft",
  "pending_review",
  "approved",
  "processing",
  "published",
  "archived",
  "failed",
]);

function clean(value: string) {
  return value.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function chunks(text: string, size = 5000) {
  const paragraphs = clean(text).split(/\n\s*\n/);
  const result: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length > size) {
      result.push(current);
      current = paragraph;
    } else {
      current += `${current ? "\n\n" : ""}${paragraph}`;
    }
  }
  if (current) result.push(current);
  return result;
}

async function parseFile(file: File): Promise<ParsedSection[]> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") {
    // pdf-parse loads a native canvas polyfill. Keep it out of the route's
    // module-evaluation path so Markdown and DOCX imports do not depend on it.
    const nodeCanvas = await import("@napi-rs/canvas");
    Object.assign(globalThis, {
      DOMMatrix: nodeCanvas.DOMMatrix,
      ImageData: nodeCanvas.ImageData,
      Path2D: nodeCanvas.Path2D,
    });
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.pages
        .map((page) => ({ page: page.num, heading: `หน้า ${page.num}`, content: clean(page.text) }))
        .filter((page) => page.content);
    } finally {
      await parser.destroy();
    }
  }
  if (extension === "docx" || extension === "doc") {
    const result = await mammoth.extractRawText({ buffer });
    return chunks(result.value).map((content, index) => ({
      page: null,
      heading: `ส่วนที่ ${index + 1}`,
      content,
    }));
  }
  if (extension === "md") {
    const raw = buffer.toString("utf8");
    const parts = raw.split(/<!--\s*PageNumber="(\d+)"\s*-->/);
    if (parts.length > 1) {
      const output: ParsedSection[] = [];
      for (let index = 1; index < parts.length; index += 2) {
        output.push({
          page: Number(parts[index]),
          heading: `หน้า ${parts[index]}`,
          content: clean(parts[index + 1].replace(/<!--.*?-->/gs, "")),
        });
      }
      return output.filter((page) => page.content);
    }
    return chunks(raw.replace(/<!--.*?-->/gs, "")).map((content, index) => ({
      page: null,
      heading: `ส่วนที่ ${index + 1}`,
      content,
    }));
  }
  throw new Error("รองรับเฉพาะไฟล์ .md, .docx และ .pdf");
}

async function importDocument(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getAdminSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server missing SUPABASE_SECRET_KEY" }, { status: 500 });
  }

  const form = await request.formData();
  const formText = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "ไฟล์ต้องไม่เกิน 25 MB" }, { status: 413 });
  }
  if (file.name.toLowerCase().endsWith(".doc")) {
    return NextResponse.json(
      { error: "ไฟล์ .doc แบบเก่ายังอ่านไม่ได้ กรุณาบันทึกเป็น .docx หรือ PDF แล้วลองใหม่" },
      { status: 422 },
    );
  }

  const requestedDocumentId = formText("documentId");
  const documentId = requestedDocumentId || `doc-${randomUUID()}`;
  const existingResult = requestedDocumentId
    ? await supabase.from("documents").select("*").eq("id", requestedDocumentId).maybeSingle()
    : { data: null, error: null };
  if (existingResult.error) return NextResponse.json({ error: existingResult.error.message }, { status: 500 });
  const existingDocument = existingResult.data;

  const [oldFilesResult, oldSectionsResult] = existingDocument
    ? await Promise.all([
        supabase
          .from("document_files")
          .select("id,storage_provider,storage_key")
          .eq("document_id", documentId),
        supabase.from("document_sections").select("*").eq("document_id", documentId),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (oldFilesResult.error || oldSectionsResult.error) {
    return NextResponse.json(
      { error: oldFilesResult.error?.message || oldSectionsResult.error?.message },
      { status: 500 },
    );
  }

  const requestedStatus = formText("status");
  if (requestedStatus && !allowedStatuses.has(requestedStatus)) {
    return NextResponse.json({ error: "สถานะเอกสารไม่ถูกต้อง" }, { status: 400 });
  }
  const publish = form.get("publish") === "true";
  const title = formText("title") || existingDocument?.title || file.name.replace(/\.[^.]+$/, "");
  const accessScope = formText("accessScope") || existingDocument?.access_scope || "public";
  const status = requestedStatus || existingDocument?.status || (publish ? "published" : "draft");

  const sections = await parseFile(file);
  if (!sections.length) {
    return NextResponse.json({ error: "ไม่พบข้อความที่นำมาทำดัชนีได้" }, { status: 422 });
  }
  const sectionEmbeddings = await createEmbeddings(
    sections.map((section) => `${title}\n${section.heading}\n${section.content}`),
  );
  const checksum = createHash("sha256").update(Buffer.from(await file.arrayBuffer())).digest("hex");
  const bucket = "human-rights-source-files";
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((candidate) => candidate.name === bucket)) {
    const createdBucket = await supabase.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: 26_214_400,
    });
    if (createdBucket.error) return NextResponse.json({ error: createdBucket.error.message }, { status: 500 });
  }

  const safeFileName =
    file.name
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "source-file";
  const storageKey = `${accessScope}/${documentId}/${checksum.slice(0, 12)}-${safeFileName}`;
  const upload = await supabase.storage.from(bucket).upload(storageKey, file, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 500 });

  const extension = file.name.split(".").pop()?.toLowerCase() || "md";
  const year = Number(formText("year")) || existingDocument?.buddhist_year || null;
  const categories = formText("categories")
    ? formText("categories")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : existingDocument?.rights_categories || [];
  const document = {
    id: documentId,
    title,
    summary: formText("summary") || existingDocument?.summary || "",
    document_type: formText("documentType") || existingDocument?.document_type || "คู่มือและงานวิชาการ",
    document_number: formText("documentNumber") || existingDocument?.document_number || null,
    publication_year: year ? year - 543 : null,
    buddhist_year: year,
    published_at: formText("publishedAt") || existingDocument?.published_at || null,
    source_organization:
      formText("agency") || existingDocument?.source_organization || "คณะกรรมการสิทธิมนุษยชนแห่งชาติ",
    source_system: formText("sourceSystem") || existingDocument?.source_system || "กสม.",
    source_url: formText("sourceUrl") || existingDocument?.source_url || null,
    authority_level: formText("authorityLevel") || existingDocument?.authority_level || "เอกสารประกอบ",
    language: formText("language") || existingDocument?.language || "th",
    rights_categories: categories,
    file_formats: [extension],
    page_count: sections.filter((section) => section.page).length || sections.length,
    access_scope: accessScope,
    status,
    featured: existingDocument?.featured || false,
    checksum,
    verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const saved = await supabase.from("documents").upsert(document);
  if (saved.error) {
    await supabase.storage.from(bucket).remove([storageKey]);
    return NextResponse.json({ error: saved.error.message }, { status: 500 });
  }

  const removedSections = await supabase.from("document_sections").delete().eq("document_id", documentId);
  if (removedSections.error) {
    return NextResponse.json({ error: removedSections.error.message }, { status: 500 });
  }
  const sectionRows = sections.map((section, index) => ({
    id: `${documentId}-s${index + 1}`,
    document_id: documentId,
    section_index: index,
    page_number: section.page,
    heading: section.heading,
    content: section.content,
    language: formText("language") || existingDocument?.language || "th",
    embedding: embeddingToHalfvec(sectionEmbeddings[index]),
    metadata: { source_filename: file.name, checksum },
  }));
  const inserted = await supabase.from("document_sections").insert(sectionRows);
  if (inserted.error) {
    if (oldSectionsResult.data?.length) {
      await supabase.from("document_sections").insert(oldSectionsResult.data);
    }
    return NextResponse.json({ error: inserted.error.message }, { status: 500 });
  }

  const fileRow = await supabase.from("document_files").upsert(
    {
      document_id: documentId,
      file_format: extension,
      storage_provider: "supabase",
      storage_key: storageKey,
      mime_type: file.type || "application/octet-stream",
      byte_size: file.size,
      checksum,
      is_primary: true,
    },
    { onConflict: "storage_provider,storage_key" },
  );
  if (fileRow.error) return NextResponse.json({ error: fileRow.error.message }, { status: 500 });

  let cleanupWarning: string | undefined;
  const obsoleteFiles = (oldFilesResult.data || []).filter(
    (oldFile) => oldFile.storage_provider !== "supabase" || oldFile.storage_key !== storageKey,
  );
  if (obsoleteFiles.length) {
    const removedRows = await supabase
      .from("document_files")
      .delete()
      .in(
        "id",
        obsoleteFiles.map((oldFile) => oldFile.id),
      );
    if (removedRows.error) cleanupWarning = removedRows.error.message;

    const oldStorageKeys = obsoleteFiles
      .filter((oldFile) => oldFile.storage_provider === "supabase")
      .map((oldFile) => oldFile.storage_key);
    if (oldStorageKeys.length) {
      const removedStorage = await supabase.storage.from(bucket).remove(oldStorageKeys);
      if (removedStorage.error) cleanupWarning = removedStorage.error.message;
    }
  }

  return NextResponse.json({
    ok: true,
    documentId,
    sections: sections.length,
    status: document.status,
    replaced: Boolean(existingDocument),
    cleanupWarning,
  });
}

export async function POST(request: NextRequest) {
  try {
    return await importDocument(request);
  } catch (error) {
    console.error("Document import failed", error);
    const message = error instanceof Error ? error.message : "Unknown import error";
    return NextResponse.json({ error: `นำเข้าเอกสารไม่สำเร็จ: ${message}` }, { status: 500 });
  }
}
