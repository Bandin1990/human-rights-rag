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
// quota - a batch of 20 documents (each up to ~3000 chars) can trip it even
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
// area, curated keywords, then as much body content as reasonably fits a
// single embedding call.
function buildEmbedText(doc, content) {
  const parts = [
    doc.title,
    doc.area_name || "",
    (doc.keywords || []).join(" "),
    (content || doc.summary || "").slice(0, 3000),
  ];
  return parts.filter(Boolean).join("\n");
}

async function main() {
  const dataDir = path.join(process.cwd(), "..", "data");
  const docs = JSON.parse(readFileSync(path.join(dataDir, "nhrc_index.json"), "utf-8"));
  console.log(`Loaded ${docs.length} documents from nhrc_index.json`);

  const { data: existingRows, error: existingErr } = await supabase
    .from("nhrc_embeddings")
    .select("document_id, content_hash");
  if (existingErr) throw existingErr;
  const existingHashes = new Map((existingRows || []).map((r) => [r.document_id, r.content_hash]));

  const pending = [];
  for (const doc of docs) {
    const contentPath = path.join(dataDir, "nhrc_content", `${doc.document_id}.txt`);
    const content = existsSync(contentPath) ? readFileSync(contentPath, "utf-8") : undefined;
    const embedText = buildEmbedText(doc, content);
    const hash = createHash("sha256").update(embedText).digest("hex");
    if (existingHashes.get(doc.document_id) === hash) continue; // unchanged, skip
    pending.push({ documentId: doc.document_id, embedText, hash });
  }
  console.log(`${pending.length} documents need (re-)embedding (${docs.length - pending.length} unchanged, skipped)`);

  let done = 0;
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const embeddings = await embedBatch(batch.map((b) => b.embedText));
    const rows = batch.map((b, idx) => ({
      document_id: b.documentId,
      embedding: halfvecLiteral(embeddings[idx]),
      content_hash: b.hash,
    }));
    const { error } = await supabase.from("nhrc_embeddings").upsert(rows, { onConflict: "document_id" });
    if (error) throw error;
    done += batch.length;
    console.log(`  embedded ${done}/${pending.length}`);
    if (i + BATCH_SIZE < pending.length) await sleep(3_000); // stay well under free-tier per-minute limits
  }

  console.log(`Done. ${done} documents embedded/updated, ${docs.length - pending.length} already up to date.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
