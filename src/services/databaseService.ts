// src/services/databaseService.ts
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

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
      
      const updateData: any = {
        deployment: {
          ...cleanDeploymentInfo,
          deployedAt: deploymentInfo.status === 'deployed' ? FieldValue.serverTimestamp() : null,
          lastDeploymentAt: FieldValue.serverTimestamp(),
        },
        status: deploymentInfo.status === 'deployed' ? 'active' : 'draft',
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

  static async updateVectorstoreDocumentCount(
    chatbotId: string,
    incrementBy: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const chatbotRef = adminDb.collection('chatbots').doc(chatbotId);
      
      await chatbotRef.update({
        'vectorstore.documentsCount': FieldValue.increment(incrementBy),
        'vectorstore.lastDocumentUpload': FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`✅ Updated vectorstore document count for chatbot ${chatbotId}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to update vectorstore document count:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export { DatabaseService };
export type { VectorstoreInfo, DeploymentInfo };
