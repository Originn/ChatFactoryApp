import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin/index';
import { FieldValue } from 'firebase-admin/firestore';
import { Pinecone } from '@pinecone-database/pinecone';

export async function DELETE(req: NextRequest) {
  try {
    const { videoId, chatbotId, userId } = await req.json();

    if (!videoId || !chatbotId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters: videoId, chatbotId, userId' },
        { status: 400 }
      );
    }

    console.log(`🗑️ Starting video deletion process for video: ${videoId}`);

    // Get chatbot configuration to get Pinecone details
    const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();
    if (!chatbotDoc.exists) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }

    const chatbotData = chatbotDoc.data();
    const vectorstore = chatbotData?.vectorstore;
    
    if (!vectorstore || !vectorstore.indexName) {
      return NextResponse.json({ error: 'Vectorstore not configured for this chatbot' }, { status: 404 });
    }

    // Get video metadata to find the video name
    let videoName = videoId; // fallback
    let vectorCount = 0;
    
    try {
      console.log(`🔍 Searching for video: ${videoId}`);
      
      // Get video name from user_videos collection
      const userVideosQuery = await adminDb
        .collection('user_videos')
        .where('userId', '==', userId)
        .where('chatbotId', '==', chatbotId)
        .where('videoId', '==', videoId)
        .where('platform', '==', 'youtube')
        .limit(1)
        .get();

      if (!userVideosQuery.empty) {
        const videoData = userVideosQuery.docs[0].data();
        videoName = videoData.originalFileName?.replace('.youtube', '') || videoData.videoFileName?.replace('.youtube', '') || videoId;
        vectorCount = videoData.vectorCount || 0;
        console.log(`📹 Found video: "${videoName}" (${vectorCount} vectors)`);
      } else {
        console.log(`⚠️ Video not found in user_videos, using videoId as name`);
      }

      // Check processed videos collection for additional info
      const processedVideoDoc = await adminDb
        .collection('processed_youtube_videos')
        .doc(`${chatbotId}_${videoId}`)
        .get();
      
      if (processedVideoDoc.exists) {
        const processedData = processedVideoDoc.data();
        if (processedData?.vectorCount) {
          vectorCount = Math.max(vectorCount, processedData.vectorCount);
        }
        if (videoName === videoId && processedData?.title) {
          videoName = processedData.title;
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not retrieve video metadata:', error);
    }

    console.log(`🗑️ Deleting vectors for: "${videoName}"`);

    // Delete from Pinecone using query-then-delete approach
    try {
      const pineconeApiKey = process.env.PINECONE_API_KEY;
      
      if (!pineconeApiKey) {
        throw new Error('PINECONE_API_KEY not configured');
      }

      const pinecone = new Pinecone({ apiKey: pineconeApiKey });
      const index = pinecone.index(vectorstore.indexName);
      const namespace = chatbotData.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || undefined;

      // Get index dimensions
      let vectorDimensions = 512; // default
      try {
        const indexDescription = await pinecone.describeIndex(vectorstore.indexName);
        vectorDimensions = indexDescription.dimension || 512;
      } catch (e) {
        console.warn('⚠️ Could not get index dimensions, using default');
      }

      // Step 1: Query vectors to get IDs matching the filter
      const expectedVectorCount = vectorCount || 0;
      const queryTopK = expectedVectorCount > 0 ? expectedVectorCount + 10 : 1000; // Use exact count + buffer, fallback for unknown count
      
      const queryResponse = await index.namespace(namespace || '').query({
        vector: new Array(vectorDimensions).fill(0),
        filter: { "video_name": videoName },
        topK: queryTopK,
        includeMetadata: false,
        includeValues: false
      });
      
      if (!queryResponse.matches || queryResponse.matches.length === 0) {
        throw new Error(`No vectors found for video: ${videoName}`);
      }

      const foundVectorCount = queryResponse.matches.length;
      const vectorIdsToDelete = queryResponse.matches.map(match => match.id);
      
      // Validate we found the expected number of vectors
      if (expectedVectorCount > 0 && foundVectorCount !== expectedVectorCount) {
        console.warn(`⚠️ Vector count mismatch: expected ${expectedVectorCount}, found ${foundVectorCount}`);
        
        // If we found significantly fewer vectors than expected, something might be wrong
        if (foundVectorCount < expectedVectorCount * 0.8) { // Less than 80% of expected
          throw new Error(`Found only ${foundVectorCount} vectors but expected ${expectedVectorCount}. Aborting to prevent partial deletion.`);
        }
      }
      
      console.log(`📊 Found ${foundVectorCount} vectors to delete (expected: ${expectedVectorCount})`);

      // Step 2: Delete vectors by IDs
      await index.namespace(namespace || '').deleteMany(vectorIdsToDelete);
      
      console.log(`✅ Successfully deleted ${foundVectorCount} vectors from Pinecone`);

    } catch (error) {
      console.error('❌ Pinecone deletion failed:', error);
      return NextResponse.json(
        { 
          success: false,
          error: `Failed to delete vectors: ${error instanceof Error ? error.message : 'Unknown error'}`
        },
        { status: 500 }
      );
    }

    // Clean up database records (only reached if Pinecone deletion succeeded)
    const cleanupResults = {
      processedVideoRemoved: false,
      userVideoRemoved: false,
      documentCountUpdated: false
    };

    try {
      // Remove from processed_youtube_videos collection
      const processedVideoRef = adminDb.collection('processed_youtube_videos').doc(`${chatbotId}_${videoId}`);
      const processedVideoDoc = await processedVideoRef.get();
      
      if (processedVideoDoc.exists) {
        await processedVideoRef.delete();
        cleanupResults.processedVideoRemoved = true;
        console.log(`✅ Removed video from processed_youtube_videos collection`);
      }

      // Remove from user_videos collection
      const userVideosQuery = await adminDb
        .collection('user_videos')
        .where('userId', '==', userId)
        .where('chatbotId', '==', chatbotId)
        .where('videoId', '==', videoId)
        .where('platform', '==', 'youtube')
        .get();

      for (const doc of userVideosQuery.docs) {
        await doc.ref.delete();
        cleanupResults.userVideoRemoved = true;
        console.log(`✅ Removed video from user_videos collection`);
      }

      // Update chatbot document count
      await adminDb.collection('chatbots').doc(chatbotId).update({
        'vectorstore.documentCount': FieldValue.increment(-1)
      });
      cleanupResults.documentCountUpdated = true;
      console.log(`✅ Updated chatbot document count (-1 document)`);

    } catch (error) {
      console.error('⚠️ Database cleanup failed:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Video successfully deleted',
      cleanupResults,
      videoId,
      videoName
    });

  } catch (error) {
    console.error('❌ Video deletion error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown deletion error'
      },
      { status: 500 }
    );
  }
}