/**
 * One-time (re-runnable) embedder: generates Gemini embeddings for every
 * document in data/nhrc_index.json and upserts them into Supabase
 * (public.nhrc_embeddings - see supabase/nhrc_embeddings_schema.sql).
 * Powers real semantic search in /api/ask-nhrc (lib/nhrc/semantic-search.ts),
 * replacing/augmenting the old literal-substring keyword matching.
 *
 * Skips documents whose embed-text hasn't changed since the last run
 * (content_hash column) - safe to re-run after every reindex.
 *
 * Usage (from web/):
 *   node scripts/embed-nhrc-documents.mjs
 * Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, GEMINI_API_KEY -
 * reads them from web/.env.local if not already in the environment.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { readFileSync, existsSync } from "fs";
import path from "path";

// --- minimal .env.local loader (no new dependency for a one-time script) ---
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
// "text-embedding-004" is retired - gemini-embedding-001 is the current
// model (confirmed via ListModels). Must match lib/embeddings.ts's default.
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "models/gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768; // must match supabase/nhrc_embeddings_schema.sql's halfvec(768)
const BATCH_SIZE = 20;
// 3000 chars/chunk is the same size that used to be the hard truncation cap
// for a whole document - already verified safe against Gemini's per-call
// token limit in production. Chunking just means a document longer than
// this no longer loses everything past the first chunk: it gets split into
// as many 3000-char pieces as it takes, each embedded (and searchable) on
// its own. CHUNK_OVERLAP keeps a little of the previous chunk's tail at the
// start of the next one so a sentence/idea that straddles a chunk boundary
// still shows up whole in at least one chunk.
const CHUNK_SIZE = 3000;
const CHUNK_OVERLAP = 200;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY (checked env + .env.local)");
  process.exit(1);
}
if (!GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY / GOOGLE_API_KEY (checked env + .env.local)");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Free-tier Gemini API keys have a fairly low requests/tokens-per-minute
// quota - a batch of 20 chunks (each up to ~3000 chars) can trip it even
// though the account has plenty of daily quota left. Retry with backoff
// instead of failing the whole run over a transient 429.
async function embedBatch(texts, attempt = 1) {
  const requests = texts.map((text) => ({
    model: EMBEDDING_MODEL,
    content: { parts: [{ text }] },
    outputDimensionality: EMBEDDING_DIMENSIONS,
  }));
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${EMBEDDING_MODEL}:batchEmbedContents?key=${GEMINI_API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requests }) }
  );
  const payload = await res.json();

  if (res.status === 429 && attempt <= 6) {
    const retryInfo = (payload.error?.details || []).find((d) => d["@type"]?.includes("RetryInfo"));
    const hinted = retryInfo?.retryDelay ? parseFloat(retryInfo.retryDelay) * 1000 : null;
    const waitMs = hinted || Math.min(60_000, 5_000 * 2 ** (attempt - 1));
    console.log(`  rate limited, waiting ${Math.round(waitMs / 1000)}s (attempt ${attempt}/6)...`);
    await sleep(waitMs);
    return embedBatch(texts, attempt + 1);
  }

  if (!res.ok || !payload.embeddings) {
    throw new Error(`Gemini embed failed: ${payload.error?.message || res.statusText}`);
  }
  return payload.embeddings.map((e) => e.values);
}

function halfvecLiteral(embedding) {
  return `[${embedding.join(",")}]`;
}

// Same shape of text a human would read to judge topical relevance: title,
// area, curated keywords, then a chunk of body content. Repeating the
// title/area/keywords header on every chunk (not just chunk 0) keeps each
// chunk's embedding anchored to what document/topic it's actually part of,
// even when the chunk itself is page 40 of a long report with no topic
// words in it.
function buildEmbedText(doc, chunkText) {
  const parts = [doc.title, doc.area_name || "", (doc.keywords || []).join(" "), chunkText || ""];
  return parts.filter(Boolean).join("\n");
}

// Splits long content into ~CHUNK_SIZE pieces, preferring paragraph breaks
// so a chunk doesn't cut a sentence in half. A document that fits in one
// chunk (the majority of the corpus today) comes back as a single-element
// array - identical behaviour to the old "just embed the whole thing".
function buildChunks(text) {
  const clean = (text || "").trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_SIZE) return [clean];

  const paragraphs = clean.split(/\n\s*\n/);
  const chunks = [];
  let current = "";
  for (const raw of paragraphs) {
    const para = raw.trim();
    if (!para) continue;
    if (para.length > CHUNK_SIZE) {
      // A single paragraph longer than a whole chunk (e.g. a pasted block
      // with no blank lines) - no natural boundary to split on, hard-slice it.
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < para.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
        chunks.push(para.slice(i, i + CHUNK_SIZE));
      }
      continue;
    }
    if (current && current.length + para.length + 2 > CHUNK_SIZE) {
      chunks.push(current);
      current = current.slice(-CHUNK_OVERLAP) + "\n\n" + para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function main() {
  const dataDir = path.join(process.cwd(), "..", "data");
  const docs = JSON.parse(readFileSync(path.join(dataDir, "nhrc_index.json"), "utf-8"));
  console.log(`Loaded ${docs.length} documents from nhrc_index.json`);

  // Every chunk row for a given document carries the same content_hash, so
  // any one row for that document_id tells us its current hash - take the
  // first one seen per document.
  const { data: existingRows, error: existingErr } = await supabase
    .from("nhrc_embeddings")
    .select("document_id, content_hash");
  if (existingErr) throw existingErr;
  const existingHashes = new Map();
  for (const row of existingRows || []) {
    if (!existingHashes.has(row.document_id)) existingHashes.set(row.document_id, row.content_hash);
  }

  // Hash the document's identity (title/area/keywords/content) as a whole,
  // independent of how it happens to get split into chunks - so a change to
  // CHUNK_SIZE/CHUNK_OVERLAP alone never spuriously marks every unchanged
  // document as needing re-embedding.
  const changedDocs = [];
  let skipped = 0;
  for (const doc of docs) {
    const contentPath = path.join(dataDir, "nhrc_content", `${doc.document_id}.txt`);
    const content = existsSync(contentPath) ? readFileSync(contentPath, "utf-8") : undefined;
    const body = content || doc.summary || "";
    const hash = createHash("sha256")
      .update([doc.title || "", doc.area_name || "", (doc.keywords || []).join(" "), body].join("\n"))
      .digest("hex");
    if (existingHashes.get(doc.document_id) === hash) {
      skipped++;
      continue;
    }
    // A document with no usable text at all still gets one (empty-bodied)
    // chunk so it stays searchable by title/keywords alone.
    const bodyChunks = buildChunks(body);
    const chunkTexts = bodyChunks.length > 0 ? bodyChunks : [""];
    changedDocs.push({
      documentId: doc.document_id,
      hash,
      chunks: chunkTexts.map((chunkText, chunkIndex) => ({
        chunkIndex,
        chunkText,
        embedText: buildEmbedText(doc, chunkText),
      })),
    });
  }
  const totalChunks = changedDocs.reduce((sum, d) => sum + d.chunks.length, 0);
  console.log(
    `${changedDocs.length} documents need (re-)embedding, ${totalChunks} chunk(s) total (${skipped} documents unchanged, skipped)`
  );

  const pending = changedDocs.flatMap((doc) =>
    doc.chunks.map((chunk) => ({ documentId: doc.documentId, hash: doc.hash, ...chunk }))
  );

  // Writes a document's chunk rows to Supabase: delete its old rows, then
  // insert the fresh ones (so a document whose chunk count shrank doesn't
  // end up with leftover stale chunks from a longer previous version).
  async function writeDocument(documentId, chunkRows) {
    const rows = chunkRows.map((e) => ({
      document_id: e.documentId,
      chunk_index: e.chunkIndex,
      chunk_text: e.chunkText,
      embedding: halfvecLiteral(e.embedding),
      content_hash: e.hash,
    }));
    const { error: deleteError } = await supabase.from("nhrc_embeddings").delete().eq("document_id", documentId);
    if (deleteError) throw deleteError;
    const { error: insertError } = await supabase.from("nhrc_embeddings").insert(rows);
    if (insertError) throw insertError;
  }

  // Embedding a corpus with a few very long documents can mean thousands of
  // chunk-embedding calls, comfortably enough to hit a free-tier *daily*
  // quota (not just a per-minute one) partway through. Writing everything
  // only after every chunk in the whole run is embedded would mean a quota
  // error at chunk 2000 of 2472 loses ALL 2000 already-paid-for embeddings.
  // Instead, track remaining-chunk counts per document and write a document
  // to Supabase the moment all of its own chunks are embedded - so a crash
  // or quota cutoff only ever costs the one document that was in flight,
  // and every fully-embedded document up to that point is already saved
  // (the content_hash check at the top of this script means re-running
  // later picks up exactly where it left off).
  const chunksRemaining = new Map(changedDocs.map((d) => [d.documentId, d.chunks.length]));
  const embeddedByDoc = new Map(changedDocs.map((d) => [d.documentId, []]));

  let done = 0;
  let docsWritten = 0;
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const embeddings = await embedBatch(batch.map((b) => b.embedText));
    batch.forEach((b, idx) => {
      embeddedByDoc.get(b.documentId).push({ ...b, embedding: embeddings[idx] });
      chunksRemaining.set(b.documentId, chunksRemaining.get(b.documentId) - 1);
    });
    done += batch.length;
    console.log(`  embedded ${done}/${pending.length} chunk(s)`);

    const ready = [...chunksRemaining.entries()].filter(([, remaining]) => remaining === 0).map(([id]) => id);
    for (const documentId of ready) {
      await writeDocument(documentId, embeddedByDoc.get(documentId));
      docsWritten++;
      chunksRemaining.delete(documentId);
      embeddedByDoc.delete(documentId);
    }

    if (i + BATCH_SIZE < pending.length) await sleep(3_000); // stay well under free-tier per-minute limits
  }

  console.log(`Done. ${docsWritten} documents (${done} chunks) embedded/updated, ${skipped} already up to date.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
