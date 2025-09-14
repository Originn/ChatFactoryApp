// src/services/databaseService.ts
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { UserPDFMetadata } from '@/types/pdf';
import { UserVideoMetadata } from '@/types/video';

interface VectorstoreInfo {
  provider: 'pinecone';
  indexName: string;
  displayName?: string; // User-friendly name
  dimension: number;
  metric: 'cosine' | 'euclidean' | 'dotproduct';
  region: string;
  status: 'creating' | 'ready' | 'failed';
}

interface DeploymentInfo {
  vercelProjectId?: string;
  deploymentUrl?: string;
  customDomain?: string | null; // Allow null explicitly
  status: 'pending' | 'deploying' | 'deployed' | 'failed';
  target?: 'production' | 'preview';
}

class DatabaseService {
  static async updateChatbotVectorstore(
    chatbotId: string,
    vectorstoreInfo: VectorstoreInfo
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const chatbotRef = adminDb.collection('chatbots').doc(chatbotId);
      
      await chatbotRef.update({
        'vectorstore': {
          ...vectorstoreInfo,
          createdAt: FieldValue.serverTimestamp(),
          documentsCount: 0,
        },
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`✅ Updated chatbot ${chatbotId} with vectorstore info`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to update chatbot vectorstore:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async updateChatbotDeployment(
    chatbotId: string,
    deploymentInfo: DeploymentInfo
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const chatbotRef = adminDb.collection('chatbots').doc(chatbotId);
      
      // Filter out undefined values to avoid Firestore errors
      const cleanDeploymentInfo = Object.fromEntries(
        Object.entries(deploymentInfo).filter(([_, value]) => value !== undefined)
      );
      
      console.log('📦 Original deployment info:', deploymentInfo);
      console.log('🧹 Cleaned deployment info:', cleanDeploymentInfo);
      
      const chatbotStatus = deploymentInfo.status === 'deployed'
        ? (deploymentInfo.target === 'preview' ? 'preview' : 'active')
        : 'draft';

      const updateData: any = {
        deployment: {
          ...cleanDeploymentInfo,
          deployedAt: deploymentInfo.status === 'deployed' ? FieldValue.serverTimestamp() : null,
          lastDeploymentAt: FieldValue.serverTimestamp(),
        },
        status: chatbotStatus,
        updatedAt: FieldValue.serverTimestamp(),
      };
      
      console.log('💾 Final update data:', JSON.stringify(updateData, null, 2));
      
      await chatbotRef.update(updateData);

      console.log(`✅ Updated chatbot ${chatbotId} with deployment info`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to update chatbot deployment:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async updateUserDeploymentCount(
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const userRef = adminDb.collection('users').doc(userId);
      
      await userRef.update({
        'usage.deploymentsCreated': FieldValue.increment(1),
        'usage.activeDeployments': FieldValue.increment(1),
        'usage.monthlyDeployments': FieldValue.increment(1),
        'usage.lastDeploymentAt': FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`✅ Updated user ${userId} deployment count`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to update user deployment count:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async deleteUserDeployment(
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const userRef = adminDb.collection('users').doc(userId);
      
      await userRef.update({
        'usage.activeDeployments': FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`✅ Decremented user ${userId} active deployment count`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to decrement user deployment count:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }


  // PDF Metadata Management Methods
  static async createPDFMetadata(
    pdfMetadata: Omit<UserPDFMetadata, 'id' | 'uploadedAt'>
  ): Promise<{ success: boolean; pdfId?: string; error?: string }> {
    try {
      const pdfRef = adminDb.collection('user_pdfs').doc();
      
      const fullMetadata: UserPDFMetadata = {
        ...pdfMetadata,
        id: pdfRef.id,
        uploadedAt: new Date().toISOString(),
      };

      // Filter out undefined values for Firestore compatibility
      const cleanMetadata = Object.fromEntries(
        Object.entries(fullMetadata).filter(([_, value]) => value !== undefined)
      );

      await pdfRef.set(cleanMetadata);

      console.log(`✅ Created PDF metadata for ${pdfMetadata.pdfFileName} (document_id: ${(pdfMetadata as any).document_id})`);
      return { success: true, pdfId: pdfRef.id };
    } catch (error) {
      console.error(`❌ Failed to create PDF metadata:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async getUserPDFs(
    userId: string,
    chatbotId?: string
  ): Promise<{ success: boolean; pdfs: UserPDFMetadata[]; error?: string }> {
    try {
      let query = adminDb.collection('user_pdfs').where('userId', '==', userId);
      
      if (chatbotId) {
        query = query.where('chatbotId', '==', chatbotId);
      }
      
      const snapshot = await query.orderBy('uploadedAt', 'desc').get();
      
      const pdfs: UserPDFMetadata[] = snapshot.docs.map(doc => 
        doc.data() as UserPDFMetadata
      );

      console.log(`✅ Retrieved ${pdfs.length} PDFs for user ${userId}`);
      return { success: true, pdfs };
    } catch (error) {
      console.error(`❌ Failed to get user PDFs:`, error);
      return {
        success: false,
        pdfs: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async getPDFMetadata(
    pdfId: string
  ): Promise<{ success: boolean; pdf?: UserPDFMetadata; error?: string }> {
    try {
      const pdfDoc = await adminDb.collection('user_pdfs').doc(pdfId).get();
      
      if (!pdfDoc.exists) {
        return {
          success: false,
          error: 'PDF not found',
        };
      }

      const pdf = pdfDoc.data() as UserPDFMetadata;
      return { success: true, pdf };
    } catch (error) {
      console.error(`❌ Failed to get PDF metadata:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async updatePDFStatus(
    pdfId: string,
    status: UserPDFMetadata['status'],
    error?: string,
    vectorCount?: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date().toISOString(),
      };

      if (error) {
        updateData.error = error;
      }

      if (vectorCount !== undefined) {
        updateData.vectorCount = vectorCount;
      }

      await adminDb.collection('user_pdfs').doc(pdfId).update(updateData);

      console.log(`✅ Updated PDF ${pdfId} status to ${status}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to update PDF status:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async updatePDFPrivacy(
    pdfId: string,
    isPublic: boolean,
    newUrl?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = {
        isPublic,
        updatedAt: new Date().toISOString(),
      };

      if (isPublic && newUrl) {
        updateData.publicUrl = newUrl;
      } else if (!isPublic) {
        updateData.publicUrl = FieldValue.delete();
      }

      await adminDb.collection('user_pdfs').doc(pdfId).update(updateData);

      console.log(`✅ Updated PDF ${pdfId} privacy to ${isPublic ? 'public' : 'private'}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to update PDF privacy:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async deletePDFMetadata(
    pdfId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await adminDb.collection('user_pdfs').doc(pdfId).delete();

      console.log(`✅ Deleted PDF metadata ${pdfId}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to delete PDF metadata:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Video Metadata Management Methods
  static async createVideoMetadata(
    videoMetadata: Omit<UserVideoMetadata, 'id' | 'uploadedAt'>
  ): Promise<{ success: boolean; videoId?: string; error?: string }> {
    try {
      const videoRef = adminDb.collection('user_videos').doc();
      
      const fullMetadata: UserVideoMetadata = {
        ...videoMetadata,
        id: videoRef.id,
        uploadedAt: new Date().toISOString(),
      };

      // Filter out undefined values for Firestore compatibility
      const cleanMetadata = Object.fromEntries(
        Object.entries(fullMetadata).filter(([_, value]) => value !== undefined)
      );

      await videoRef.set(cleanMetadata);

      console.log(`✅ Created video metadata for ${videoMetadata.videoFileName}`);
      return { success: true, videoId: videoRef.id };
    } catch (error) {
      console.error(`❌ Failed to create video metadata:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async getUserVideos(
    userId: string,
    chatbotId?: string
  ): Promise<{ success: boolean; videos: UserVideoMetadata[]; error?: string }> {
    try {
      let query = adminDb.collection('user_videos').where('userId', '==', userId);
      
      if (chatbotId) {
        query = query.where('chatbotId', '==', chatbotId);
      }
      
      const snapshot = await query.orderBy('uploadedAt', 'desc').get();
      
      const videos: UserVideoMetadata[] = snapshot.docs.map(doc => 
        doc.data() as UserVideoMetadata
      );

      console.log(`✅ Retrieved ${videos.length} videos for user ${userId}`);
      return { success: true, videos };
    } catch (error) {
      console.error(`❌ Failed to get user videos:`, error);
      return {
        success: false,
        videos: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async updateVideoStatus(
    videoId: string,
    status: UserVideoMetadata['status'],
    error?: string,
    vectorCount?: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: Partial<UserVideoMetadata> = {
        status,
        updatedAt: new Date().toISOString(),
      };

      if (error) {
        updateData.error = error;
      }

      if (vectorCount !== undefined) {
        updateData.vectorCount = vectorCount;
      }

      await adminDb.collection('user_videos').doc(videoId).update(updateData);

      console.log(`✅ Updated video ${videoId} status to ${status}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to update video status:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async updateVideoPrivacy(
    videoId: string,
    isPublic: boolean,
    newUrl?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: Partial<UserVideoMetadata> = {
        isPublic,
        updatedAt: new Date().toISOString(),
      };

      // Handle publicUrl field separately to avoid TypeScript issues with FieldValue
      const dbUpdate: any = { ...updateData };
      
      if (isPublic && newUrl) {
        dbUpdate.publicUrl = newUrl;
      } else if (!isPublic) {
        dbUpdate.publicUrl = FieldValue.delete();
      }

      await adminDb.collection('user_videos').doc(videoId).update(dbUpdate);

      console.log(`✅ Updated video ${videoId} privacy to ${isPublic ? 'public' : 'private'}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to update video privacy:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }


  static async deleteVideoMetadata(
    videoId: string,
    userId: string,
    chatbotId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Delete from user_videos collection by document ID
      const videoDoc = await adminDb.collection('user_videos').doc(videoId).get();
      if (videoDoc.exists) {
        const videoData = videoDoc.data();
        // Verify ownership before deletion
        if (videoData?.userId === userId && videoData?.chatbotId === chatbotId) {
          await videoDoc.ref.delete();
          console.log(`✅ Deleted video metadata for ${videoId}`);
        } else {
          return {
            success: false,
            error: 'Video not found or access denied'
          };
        }
      }

      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to delete video metadata:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async deleteProcessedVideo(
    chatbotId: string,
    videoId: string,
    userId: string
  ): Promise<{ success: boolean; vectorCount?: number; error?: string }> {
    try {
      const docId = `${chatbotId}_${videoId}`;
      const processedVideoRef = adminDb.collection('processed_youtube_videos').doc(docId);
      
      const doc = await processedVideoRef.get();
      if (!doc.exists) {
        return {
          success: false,
          error: 'Processed video record not found'
        };
      }

      const videoData = doc.data();
      
      // Verify ownership
      if (videoData?.userId !== userId || videoData?.chatbotId !== chatbotId) {
        return {
          success: false,
          error: 'Video not found or access denied'
        };
      }

      const vectorCount = videoData?.vectorCount || 0;
      
      await processedVideoRef.delete();
      console.log(`✅ Deleted processed video record for ${videoId}`);

      return { 
        success: true, 
        vectorCount 
      };
    } catch (error) {
      console.error(`❌ Failed to delete processed video:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async updateVectorstoreDocumentCount(
    chatbotId: string,
    countChange: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (countChange === 0) {
        return { success: true }; // No change needed
      }

      const chatbotRef = adminDb.collection('chatbots').doc(chatbotId);
      
      await chatbotRef.update({
        'vectorstore.documentCount': FieldValue.increment(countChange),
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`✅ Updated vectorstore document count by ${countChange} for chatbot ${chatbotId}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to update vectorstore document count:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Document Deletion Support Methods for DocumentDeletionService Integration
  
  /**
   * Get all document_ids for a specific chatbot
   * Used by DocumentDeletionService to delete all documents when chatbot is deleted
   */
  static async getDocumentIdsByChatbot(
    chatbotId: string,
    userId: string
  ): Promise<string[]> {
    try {
      const documentIds: string[] = [];

      // Get PDF document IDs
      const pdfQuery = adminDb.collection('user_pdfs')
        .where('chatbotId', '==', chatbotId)
        .where('userId', '==', userId);
      
      const pdfSnapshot = await pdfQuery.get();
      pdfSnapshot.docs.forEach(doc => {
        const pdfData = doc.data() as UserPDFMetadata;
        if (pdfData.document_id) {
          documentIds.push(pdfData.document_id);
        }
      });

      // Get video document IDs (if they have document_id field)
      const videoQuery = adminDb.collection('user_videos')
        .where('chatbotId', '==', chatbotId)
        .where('userId', '==', userId);
      
      const videoSnapshot = await videoQuery.get();
      videoSnapshot.docs.forEach(doc => {
        const videoData = doc.data() as UserVideoMetadata;
        if ((videoData as any).document_id) {
          documentIds.push((videoData as any).document_id);
        }
      });

      console.log(`✅ Found ${documentIds.length} document IDs for chatbot ${chatbotId}`);
      return documentIds;
      
    } catch (error) {
      console.error(`❌ Failed to get document IDs for chatbot ${chatbotId}:`, error);
      return [];
    }
  }

  /**
   * Get document metadata by document_id (for deletion verification)
   */
  static async getDocumentByDocumentId(
    documentId: string,
    userId: string
  ): Promise<{ 
    success: boolean; 
    document?: UserPDFMetadata | UserVideoMetadata; 
    type?: 'pdf' | 'video';
    error?: string;
  }> {
    try {
      // Check PDFs first
      const pdfQuery = adminDb.collection('user_pdfs')
        .where('document_id', '==', documentId)
        .where('userId', '==', userId)
        .limit(1);
      
      const pdfSnapshot = await pdfQuery.get();
      if (!pdfSnapshot.empty) {
        const pdfData = pdfSnapshot.docs[0].data() as UserPDFMetadata;
        return { 
          success: true, 
          document: pdfData, 
          type: 'pdf' 
        };
      }

      // Check videos if no PDF found
      const videoQuery = adminDb.collection('user_videos')
        .where('document_id', '==', documentId)
        .where('userId', '==', userId)
        .limit(1);
      
      const videoSnapshot = await videoQuery.get();
      if (!videoSnapshot.empty) {
        const videoData = videoSnapshot.docs[0].data() as UserVideoMetadata;
        return { 
          success: true, 
          document: videoData, 
          type: 'video' 
        };
      }

      return {
        success: false,
        error: 'Document not found'
      };
      
    } catch (error) {
      console.error(`❌ Failed to get document by document_id ${documentId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete document metadata after successful deletion from external services
   * Called by DocumentDeletionService after vectors/graph nodes are deleted
   */
  static async deleteDocumentMetadata(
    documentId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Find and delete from PDFs
      const pdfQuery = adminDb.collection('user_pdfs')
        .where('document_id', '==', documentId)
        .where('userId', '==', userId)
        .limit(1);
      
      const pdfSnapshot = await pdfQuery.get();
      if (!pdfSnapshot.empty) {
        await pdfSnapshot.docs[0].ref.delete();
        console.log(`✅ Deleted PDF metadata for document_id: ${documentId}`);
        return { success: true };
      }

      // Find and delete from videos
      const videoQuery = adminDb.collection('user_videos')
        .where('document_id', '==', documentId)
        .where('userId', '==', userId)
        .limit(1);
      
      const videoSnapshot = await videoQuery.get();
      if (!videoSnapshot.empty) {
        await videoSnapshot.docs[0].ref.delete();
        console.log(`✅ Deleted video metadata for document_id: ${documentId}`);
        return { success: true };
      }

      return {
        success: false,
        error: 'Document metadata not found'
      };
      
    } catch (error) {
      console.error(`❌ Failed to delete document metadata for ${documentId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get chatbot configuration for deletion service parameters
   * Returns Pinecone index, namespace, and Firebase bucket info
   */
  static async getChatbotDeletionConfig(
    chatbotId: string,
    userId: string
  ): Promise<{
    success: boolean;
    config?: {
      pineconeIndex: string;
      pineconeNamespace?: string;
      firebaseBucket?: string;
      firebaseProjectId?: string;
    };
    error?: string;
  }> {
    try {
      const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();
      
      if (!chatbotDoc.exists) {
        return {
          success: false,
          error: 'Chatbot not found'
        };
      }

      const chatbotData = chatbotDoc.data();
      
      // Verify ownership
      if (chatbotData?.userId !== userId) {
        return {
          success: false,
          error: 'Access denied'
        };
      }

      const config = {
        pineconeIndex: chatbotData?.vectorstore?.indexName || `chatbot-${chatbotId}`,
        pineconeNamespace: chatbotData?.vectorstore?.namespace || "",
        firebaseBucket: chatbotData?.firebaseProjectId ? `${chatbotData.firebaseProjectId}.appspot.com` : undefined,
        firebaseProjectId: chatbotData?.firebaseProjectId
      };

      return { success: true, config };
      
    } catch (error) {
      console.error(`❌ Failed to get chatbot deletion config for ${chatbotId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export { DatabaseService };
export type { VectorstoreInfo, DeploymentInfo };
