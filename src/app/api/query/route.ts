import { NextRequest, NextResponse } from 'next/server';
import { PineconeService } from '@/services/pineconeService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatbotId, query, topK = 5, minScore = 0.7 } = body;

    if (!chatbotId || !query) {
      return NextResponse.json({ 
        error: 'Missing required fields: chatbotId, query' 
      }, { status: 400 });
    }

    const result = await PineconeService.queryVectors(chatbotId, query, topK);

    if (result.success) {
      const relevantMatches = result.matches.filter(match => match.score >= minScore);
      
      const context = relevantMatches.map(match => ({
        content: match.metadata.source || '',
        score: match.score,
        document: match.metadata.documentName,
        chunkIndex: match.metadata.chunkIndex
      }));

      return NextResponse.json({
        success: true,
        matches: relevantMatches,
        context,
        totalMatches: result.matches.length,
        relevantMatches: relevantMatches.length
      });
    } else {
      return NextResponse.json({ 
        error: result.error || 'Failed to query vectorstore' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Query API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during query' 
    }, { status: 500 });
  }
}
