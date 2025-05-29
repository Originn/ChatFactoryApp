import { NextRequest, NextResponse } from 'next/server';
import { PineconeService } from '@/services/pineconeService';
import { DatabaseService } from '@/services/databaseService';

export async function DELETE(request: NextRequest) {
  try {
    const { chatbotId, userId, deleteVectorstore = false } = await request.json();

    if (!chatbotId) {
      return NextResponse.json({ error: 'Missing chatbotId' }, { status: 400 });
    }

    const results = { vectorstoreDeleted: false, userUpdated: false, errors: [] as string[] };

    // Delete vectorstore if requested
    if (deleteVectorstore) {
      const result = await PineconeService.deleteIndex(chatbotId);
      results.vectorstoreDeleted = result.success;
      if (!result.success) results.errors.push(`Vectorstore: ${result.error}`);
    }

    // Update user stats
    if (userId) {
      const result = await DatabaseService.deleteUserDeployment(userId);
      results.userUpdated = result.success;
      if (!result.success) results.errors.push(`User stats: ${result.error}`);
    }

    return NextResponse.json({
      success: true,
      results,
      warnings: results.errors.length > 0 ? results.errors : undefined
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Deletion failed',
      details: error instanceof Error ? error.message : 'Unknown'
    }, { status: 500 });
  }
}
