const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "models/text-embedding-004";
const EMBEDDING_DIMENSIONS = 768; // Gemini output dimensions

type EmbeddingResponse = {
  embeddings?: Array<{ values: number[] }>;
  error?: { message?: string };
};

export function embeddingToHalfvec(embedding: number[]): string {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding must contain ${EMBEDDING_DIMENSIONS} dimensions. Found: ${embedding.length}`);
  }
  return `[${embedding.join(",")}]`;
}

export async function createEmbeddings(inputs: string[]): Promise<number[][]> {
  if (!inputs.length) return [];
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Server missing GEMINI_API_KEY; semantic indexing is not configured.");

  // Gemini batch embed
  const requests = inputs.map(input => ({
    model: EMBEDDING_MODEL,
    content: { parts: [{ text: input }] }
  }));

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  
  const payload = (await response.json()) as EmbeddingResponse;
  
  if (!response.ok || !payload.embeddings) {
    throw new Error(`Embedding request failed${payload.error?.message ? `: ${payload.error.message}` : ""}`);
  }

  const embeddings = payload.embeddings.map(item => item.values);
  if (embeddings.length !== inputs.length) throw new Error("Embedding service returned an incomplete result.");
  
  embeddings.forEach(embeddingToHalfvec);
  return embeddings;
}

export async function createEmbedding(input: string): Promise<number[]> {
  const [embedding] = await createEmbeddings([input]);
  return embedding;
}
