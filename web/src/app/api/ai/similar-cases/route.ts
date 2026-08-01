import { NextResponse } from 'next/server';
import { searchKnowledge } from '@/lib/knowledge/repository';

export async function POST(request: Request) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'No query provided' }, { status: 400 });
    }

    // Use the existing knowledge repository to search for similar cases/documents.
    // The RAG store (from previous implementation) can find documents related to the facts.
    const searchResults = await searchKnowledge({ query });

    // Format the response for the screening UI
    const similarCases = searchResults.results.slice(0, 5).map(doc => ({
      id: doc.id,
      title: doc.title,
      summary: doc.summary,
      relevanceScore: 0.85, // Mock score if semantic search doesn't return one directly here
      year: doc.year || doc.buddhistYear,
      documentNumber: doc.documentNumber,
    }));

    return NextResponse.json({
      success: true,
      similarCases,
    });
  } catch (error: any) {
    console.error('Similar Cases Search error:', error);
    return NextResponse.json({ error: error.message || 'Similar Cases Search failed' }, { status: 500 });
  }
}
