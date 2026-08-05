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
    return (data || []) as SemanticMatch[];
  } catch (error) {
    console.error("Semantic search failed; falling back to keyword search", error);
    return null;
  }
}
