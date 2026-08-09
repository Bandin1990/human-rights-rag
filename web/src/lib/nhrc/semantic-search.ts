/**
 * Real semantic search for Ask NHRC, backed by Gemini embeddings stored in
 * Supabase (public.nhrc_embeddings / match_nhrc_documents - see
 * supabase/nhrc_embeddings_schema.sql and web/scripts/embed-nhrc-documents.mjs).
 *
 * Replaces the old "does a keyword literally appear in the question text"
 * approach (still in repository.ts's findRelevantCases, kept as a fallback
 * when this isn't configured or comes back empty) with actual meaning-based
 * matching - a paraphrased question no longer needs to contain a stored
 * keyword verbatim.
 */
import { createEmbedding } from "@/lib/embeddings";
import { getPublicSupabaseClient } from "@/lib/supabase/server";

export interface SemanticMatch {
  documentId: string;
  similarity: number;
  // The actual chunk of the document that matched (see
  // supabase/nhrc_embeddings_schema.sql / embed-nhrc-documents.mjs) - a long
  // document is split into several chunks, so this is whichever piece was
  // closest to the question, not necessarily the start of the file. Callers
  // should prefer this over re-slicing the document's raw content from the
  // top when building an excerpt for the AI to read.
  chunkText?: string;
}

// Returns null (not an error) when semantic search isn't configured or the
// call fails - callers should fall back to keyword search either way.
export async function semanticSearch(
  question: string,
  matchCount: number = 15
): Promise<SemanticMatch[] | null> {
  const supabase = getPublicSupabaseClient();
  if (!supabase) return null;

  try {
    const embedding = await createEmbedding(question);
    const vectorLiteral = `[${embedding.join(",")}]`;

    const { data, error } = await supabase.rpc("match_nhrc_documents", {
      query_embedding: vectorLiteral,
      match_count: matchCount,
    });
    if (error) {
      console.error("match_nhrc_documents RPC failed", error);
      return null;
    }
    // The RPC returns snake_case columns (document_id, similarity) - map to
    // the camelCase SemanticMatch shape explicitly. A prior version of this
    // code cast `data` straight to SemanticMatch[] without this mapping, so
    // every match's `documentId` was actually undefined at the call site
    // (repository.ts's getCaseById(undefined) matches the first document
    // lacking a case_id) - semantic search silently never worked and every
    // Ask NHRC answer was quietly running on the keyword-substring fallback.
    return (
      (data || []) as { document_id: string; similarity: number; chunk_text?: string }[]
    ).map((row) => ({
      documentId: row.document_id,
      similarity: row.similarity,
      chunkText: row.chunk_text,
    }));
  } catch (error) {
    console.error("Semantic search failed; falling back to keyword search", error);
    return null;
  }
}
