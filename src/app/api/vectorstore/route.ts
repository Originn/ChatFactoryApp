import { NextRequest, NextResponse } from 'next/server';
import { PineconeService } from '@/services/pineconeService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, chatbotId, indexName, userId, userInputName, embeddingModel, requiredDimensions } = body;

    switch (action) {
      case 'create':
        if (!userId || !userInputName || !embeddingModel) {
          return NextResponse.json({ 
            error: 'Missing required fields: userId, userInputName, embeddingModel' 
          }, { status: 400 });
        }
        
        const sanitizedName = PineconeService.sanitizeIndexName(userInputName, userId);
        const isAvailable = await PineconeService.isIndexNameAvailable(sanitizedName);
        
        if (!isAvailable) {
          return NextResponse.json({ 
            error: `Index name "${userInputName}" is not available. Try a different name.`,
            suggestedName: sanitizedName
          }, { status: 409 });
        }
        
        const createResult = await PineconeService.createIndex(sanitizedName, userId, embeddingModel);
        return NextResponse.json({
          ...createResult,
          displayName: userInputName,
          sanitizedName
        });

      case 'delete':
        if (!indexName) {
          return NextResponse.json({ 
            error: 'Missing required field: indexName' 
          }, { status: 400 });
        }
        
        const deleteResult = await PineconeService.deleteIndex(indexName);
        return NextResponse.json(deleteResult);

      case 'stats':
        if (!indexName) {
          return NextResponse.json({ 
            error: 'Missing required field: indexName' 
          }, { status: 400 });
        }
        
        const statsResult = await PineconeService.getIndexStats(indexName);
        return NextResponse.json(statsResult);

      case 'exists':
        if (!indexName) {
          return NextResponse.json({ 
            error: 'Missing required field: indexName' 
          }, { status: 400 });
        }
        
        const exists = await PineconeService.indexExists(indexName);
        return NextResponse.json({ exists, indexName });

      case 'list':
        if (!userId) {
          return NextResponse.json({ 
            error: 'Missing required field: userId' 
          }, { status: 400 });
        }
        
        const listResult = await PineconeService.listUserIndexes(userId);
        return NextResponse.json(listResult);

      case 'list-with-dimensions':
        if (!userId) {
          return NextResponse.json({ 
            error: 'Missing required field: userId' 
          }, { status: 400 });
        }
        
        const listWithDimensionsResult = await PineconeService.listUserIndexesWithDimensions(userId, requiredDimensions);
        return NextResponse.json(listWithDimensionsResult);

      case 'validate-name':
        if (!userId || !userInputName) {
          return NextResponse.json({ 
            error: 'Missing required fields: userId, userInputName' 
          }, { status: 400 });
        }
        
        const validatedName = PineconeService.sanitizeIndexName(userInputName, userId);
        const nameAvailable = await PineconeService.isIndexNameAvailable(validatedName);
        
        return NextResponse.json({
          success: true,
          originalName: userInputName,
          sanitizedName: validatedName,
          available: nameAvailable
        });

      default:
        return NextResponse.json({ 
          error: 'Invalid action. Supported actions: create, delete, stats, exists, list, list-with-dimensions, validate-name' 
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Vectorstore API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
