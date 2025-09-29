import { adminDb } from '@/lib/firebase/admin/index';
import { FieldValue } from 'firebase-admin/firestore';
import {
  ProjectMapping,
  ProjectMappingDocument,
  ProjectStatus,
  ProjectType,
  ProjectReservationRequest,
  ProjectReservationResult,
  ProjectReleaseResult
} from '@/types/projectMapping';

/**
 * Service for managing Firebase project mappings and state synchronization
 * Handles project tracking, atomic reservations, and secret synchronization
 */
export class ProjectMappingService {
  private static readonly COLLECTION_NAME = 'firebaseProjects';

  /**
   * Find and atomically reserve an available project for a chatbot
   * @param request - Project reservation request with chatbot and user info
   * @returns Promise<ProjectReservationResult>
   */
  static async findAndReserveProject(request: ProjectReservationRequest): Promise<ProjectReservationResult> {
    try {
      console.log(`🔍 Searching project pool for chatbot: ${request.chatbotId}, user: ${request.userId}`);

      const db = adminDb;
      const projectsRef = db.collection(this.COLLECTION_NAME);

      // First, log pool status
      const allProjectsSnapshot = await projectsRef.get();
      const poolStatus = {
        total: allProjectsSnapshot.size,
        available: allProjectsSnapshot.docs.filter(doc => doc.data().status === 'available').length,
        inUse: allProjectsSnapshot.docs.filter(doc => doc.data().status === 'in-use').length
      };
      console.log(`📊 Pool Status: ${poolStatus.available} available, ${poolStatus.inUse} in-use, ${poolStatus.total} total`);

      // Use Firestore transaction for atomic reservation
      const result = await db.runTransaction(async (transaction) => {
        // Query for available projects
        const availableQuery = projectsRef
          .where('status', '==', 'available')
          .orderBy('lastUsedAt', 'asc') // Oldest first for fair rotation
          .limit(1);

        const snapshot = await transaction.get(availableQuery);

        if (snapshot.empty) {
          throw new Error('No available projects found in the pool');
        }

        const projectDoc = snapshot.docs[0];
        const projectData = projectDoc.data() as ProjectMappingDocument;
        const projectId = projectData.projectId;

        console.log(`🎯 Found candidate project: ${projectId} (type: ${projectData.projectType})`);
        console.log(`📅 Last used: ${projectData.lastUsedAt ? projectData.lastUsedAt.toDate().toLocaleString() : 'never'}`);

        // Double-check projectInUse field before reserving (Firestore-based verification)
        console.log(`🔐 Verifying project availability via projectInUse field...`);
        const isActuallyInUse = projectData.projectInUse === true;
        if (isActuallyInUse) {
          console.warn(`⚠️ Project ${projectId} marked available but projectInUse is true`);
          console.log(`🔄 Correcting status and continuing search...`);
          // Update Firestore to reflect actual status
          transaction.update(projectDoc.ref, {
            status: 'in-use',
            lastUsedAt: FieldValue.serverTimestamp() as any
          });
          throw new Error(`Project ${projectId} is actually in use, updated status`);
        }

        // Reserve the project atomically
        const updatedMapping: Partial<ProjectMappingDocument> = {
          chatbotId: request.chatbotId,
          userId: request.userId,
          status: 'in-use',
          projectInUse: true,
          deployedAt: FieldValue.serverTimestamp() as any,
          vercelUrl: request.vercelUrl || null,
          lastUsedAt: FieldValue.serverTimestamp() as any
        };

        transaction.update(projectDoc.ref, updatedMapping);

        // Convert Firestore document to ProjectMapping
        const reservedProject: ProjectMapping = {
          projectId: projectData.projectId,
          chatbotId: request.chatbotId,
          userId: request.userId,
          status: 'in-use',
          createdAt: projectData.createdAt ? projectData.createdAt.toDate() : new Date(),
          lastUsedAt: new Date(),
          deployedAt: new Date(),
          recycledAt: projectData.recycledAt?.toDate() || null,
          vercelUrl: request.vercelUrl || null,
          projectType: projectData.projectType,
          metadata: projectData.metadata
        };

        return reservedProject;
      });

      console.log(`🔐 Project-in-use status: Updated to true in Firestore for ${result.projectType} project`);

      console.log(`✅ PROJECT RESERVATION SUCCESSFUL!`);
      console.log(`🎯 Reserved Project: ${result.projectId}`);
      console.log(`🏷️  Project Type: ${result.projectType}`);
      console.log(`👤 Assigned to Chatbot: ${request.chatbotId}`);

      return {
        success: true,
        project: result
      };

    } catch (error: any) {
      console.error('❌ Error finding and reserving project:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Release a project back to the available pool after chatbot deletion
   * @param projectId - The project ID to release
   * @param chatbotId - The chatbot ID for verification
   * @returns Promise<ProjectReleaseResult>
   */
  static async releaseProject(projectId: string, chatbotId: string): Promise<ProjectReleaseResult> {
    try {
      console.log(`🔄 Releasing project ${projectId} from chatbot ${chatbotId}`);

      const db = adminDb;
      const projectRef = db.collection(this.COLLECTION_NAME).doc(projectId);

      let projectType: ProjectType = 'dedicated'; // default value

      // Use transaction to ensure atomic release
      await db.runTransaction(async (transaction) => {
        const projectDoc = await transaction.get(projectRef);

        if (!projectDoc.exists) {
          throw new Error(`Project mapping ${projectId} not found`);
        }

        const projectData = projectDoc.data() as ProjectMappingDocument;
        projectType = projectData.projectType; // store for use outside transaction

        // Verify this chatbot owns the project
        if (projectData.chatbotId !== chatbotId) {
          throw new Error(`Project ${projectId} is not assigned to chatbot ${chatbotId}`);
        }

        // Release the project
        const releasedMapping: Partial<ProjectMappingDocument> = {
          chatbotId: null,
          userId: null,
          status: 'available',
          projectInUse: false,
          recycledAt: FieldValue.serverTimestamp() as any,
          vercelUrl: null,
          lastUsedAt: FieldValue.serverTimestamp() as any
        };

        transaction.update(projectRef, releasedMapping);
      });

      console.log(`🔐 Project-in-use status: Updated to false in Firestore for ${projectType} project`);

      console.log(`✅ Successfully released project ${projectId} back to available pool`);

      return {
        success: true,
        message: `Project ${projectId} released and available for reuse`
      };

    } catch (error: any) {
      console.error(`❌ Error releasing project ${projectId}:`, error);
      return {
        success: false,
        message: `Failed to release project: ${error.message}`,
        details: error
      };
    }
  }

  /**
   * Mark a specific project as in use (for dedicated projects or manual assignments)
   * @param projectId - The project ID to mark as in use
   * @param chatbotId - The chatbot ID using the project
   * @param userId - The user ID owning the chatbot
   * @param vercelUrl - Optional Vercel deployment URL
   * @returns Promise<ProjectReleaseResult>
   */
  static async markProjectInUse(
    projectId: string,
    chatbotId: string,
    userId: string,
    vercelUrl?: string
  ): Promise<ProjectReleaseResult> {
    try {
      console.log(`📌 Marking project ${projectId} as in use by chatbot ${chatbotId}`);

      const db = adminDb;
      const projectRef = db.collection(this.COLLECTION_NAME).doc(projectId);

      await db.runTransaction(async (transaction) => {
        const projectDoc = await transaction.get(projectRef);

        if (!projectDoc.exists) {
          // Create new project mapping if it doesn't exist (for dedicated projects)
          const newMapping: ProjectMappingDocument = {
            projectId,
            chatbotId,
            userId,
            status: 'in-use',
            projectInUse: true,
            createdAt: FieldValue.serverTimestamp() as any,
            lastUsedAt: FieldValue.serverTimestamp() as any,
            deployedAt: FieldValue.serverTimestamp() as any,
            recycledAt: null,
            vercelUrl: vercelUrl || null,
            projectType: 'dedicated', // Assume dedicated if not in pool
            metadata: {
              projectName: `Dedicated Project ${projectId}`,
              region: 'us-central1',
              billingAccountId: process.env.BILLING_ACCOUNT_ID || ''
            }
          };

          transaction.set(projectRef, newMapping);
        } else {
          // Update existing project mapping
          const projectData = projectDoc.data() as ProjectMappingDocument;

          if (projectData.status === 'in-use' && projectData.chatbotId !== chatbotId) {
            throw new Error(`Project ${projectId} is already in use by chatbot ${projectData.chatbotId}`);
          }

          const updatedMapping: Partial<ProjectMappingDocument> = {
            chatbotId,
            userId,
            status: 'in-use',
            projectInUse: true,
            deployedAt: FieldValue.serverTimestamp() as any,
            vercelUrl: vercelUrl || null,
            lastUsedAt: FieldValue.serverTimestamp() as any
          };

          transaction.update(projectRef, updatedMapping);
        }
      });

      // Project-in-use status already updated in Firestore transaction above

      console.log(`✅ Successfully marked project ${projectId} as in use`);

      return {
        success: true,
        message: `Project ${projectId} marked as in use by chatbot ${chatbotId}`
      };

    } catch (error: any) {
      console.error(`❌ Error marking project ${projectId} as in use:`, error);
      return {
        success: false,
        message: `Failed to mark project as in use: ${error.message}`,
        details: error
      };
    }
  }

  /**
   * Add a new project to the mapping collection (for pool management)
   * @param projectId - The project ID to add
   * @param metadata - Project metadata
   * @param projectType - Type of project (pool or dedicated)
   * @returns Promise<ProjectReleaseResult>
   */
  static async addProjectToPool(
    projectId: string,
    metadata: { projectName: string; region: string; billingAccountId: string },
    projectType: ProjectType = 'pool'
  ): Promise<ProjectReleaseResult> {
    try {
      console.log(`➕ Adding project ${projectId} to the ${projectType} pool`);

      const db = adminDb;
      const projectRef = db.collection(this.COLLECTION_NAME).doc(projectId);

      // Check if project already exists
      const existingDoc = await projectRef.get();
      if (existingDoc.exists) {
        console.log(`ℹ️ Project ${projectId} already exists in mapping collection`);
        return {
          success: true,
          message: `Project ${projectId} already exists in pool`
        };
      }

      // Create new project mapping
      const newMapping: ProjectMappingDocument = {
        projectId,
        chatbotId: null,
        userId: null,
        status: 'available',
        projectInUse: false,
        createdAt: FieldValue.serverTimestamp() as any,
        lastUsedAt: FieldValue.serverTimestamp() as any,
        deployedAt: null,
        recycledAt: null,
        vercelUrl: null,
        projectType,
        metadata
      };

      await projectRef.set(newMapping);

      // Project-in-use status already set to false in Firestore document above

      console.log(`✅ Successfully added project ${projectId} to ${projectType} pool`);

      return {
        success: true,
        message: `Project ${projectId} added to ${projectType} pool`
      };

    } catch (error: any) {
      console.error(`❌ Error adding project ${projectId} to pool:`, error);
      return {
        success: false,
        message: `Failed to add project to pool: ${error.message}`,
        details: error
      };
    }
  }

  /**
   * Synchronize project status between Firestore and project secrets
   * @param projectId - Optional specific project to sync, or sync all if not provided
   * @returns Promise<ProjectReleaseResult>
   */
  static async syncProjectStatus(projectId?: string): Promise<ProjectReleaseResult> {
    try {
      console.log(`🔄 Synchronizing project status${projectId ? ` for ${projectId}` : ' for all projects'}`);

      const db = adminDb;
      const projectsRef = db.collection(this.COLLECTION_NAME);

      let query: any = projectsRef;
      if (projectId) {
        query = projectsRef.where('projectId', '==', projectId);
      }

      const snapshot = await query.get();
      let syncedCount = 0;
      let errorsCount = 0;
      const errors: string[] = [];

      for (const doc of snapshot.docs) {
        try {
          const projectData = doc.data() as ProjectMappingDocument;
          const pid = projectData.projectId;

          // Check consistency between status and projectInUse fields
          const statusInUse = projectData.status === 'in-use';
          const projectInUse = projectData.projectInUse === true;

          if (statusInUse !== projectInUse) {
            console.log(`🔄 Syncing project ${pid}: status=${projectData.status}, projectInUse=${projectInUse}`);

            // Update both fields to be consistent (projectInUse is more reliable)
            const updatedStatus: ProjectStatus = projectInUse ? 'in-use' : 'available';

            await doc.ref.update({
              status: updatedStatus,
              lastUsedAt: FieldValue.serverTimestamp() as any
            });

            syncedCount++;
            console.log(`✅ Synced project ${pid} status to: ${updatedStatus}`);
          }
        } catch (error: any) {
          errorsCount++;
          const errorMsg = `Failed to sync project ${doc.data().projectId}: ${error.message}`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      const totalProjects = snapshot.size;
      const message = `Sync completed: ${syncedCount} updated, ${errorsCount} errors, ${totalProjects} total projects`;

      console.log(`✅ ${message}`);

      return {
        success: errorsCount === 0,
        message,
        details: {
          totalProjects,
          syncedCount,
          errorsCount,
          errors: errors.length > 0 ? errors : undefined
        }
      };

    } catch (error: any) {
      console.error(`❌ Error during project status sync:`, error);
      return {
        success: false,
        message: `Sync failed: ${error.message}`,
        details: error
      };
    }
  }

  /**
   * Get all projects with their current status
   * @param status - Optional filter by status
   * @returns Promise<ProjectMapping[]>
   */
  static async getAllProjects(status?: ProjectStatus): Promise<ProjectMapping[]> {
    try {
      const db = adminDb;
      let query: any = db.collection(this.COLLECTION_NAME);

      if (status) {
        query = query.where('status', '==', status);
      }

      const snapshot = await query.orderBy('lastUsedAt', 'desc').get();
      const projects: ProjectMapping[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data() as ProjectMappingDocument;
        const project: ProjectMapping = {
          projectId: data.projectId,
          chatbotId: data.chatbotId,
          userId: data.userId,
          status: data.status,
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
          lastUsedAt: data.lastUsedAt ? data.lastUsedAt.toDate() : null,
          deployedAt: data.deployedAt?.toDate() || null,
          recycledAt: data.recycledAt?.toDate() || null,
          vercelUrl: data.vercelUrl,
          projectType: data.projectType,
          metadata: data.metadata
        };
        projects.push(project);
      });

      return projects;
    } catch (error: any) {
      console.error('❌ Error getting projects:', error);
      return [];
    }
  }


  /**
   * Find the project assigned to a specific chatbot
   * @param chatbotId - The chatbot ID to find the project for
   * @returns Promise<ProjectMapping | null>
   */
  static async findProjectByChatbot(chatbotId: string): Promise<ProjectMapping | null> {
    try {
      console.log(`🔍 Finding project for chatbot: ${chatbotId}`);

      const db = adminDb;
      const projectsRef = db.collection(this.COLLECTION_NAME);

      const query = projectsRef
        .where('chatbotId', '==', chatbotId)
        .where('status', '==', 'in-use')
        .limit(1);

      const snapshot = await query.get();

      if (snapshot.empty) {
        console.log(`📭 No project found for chatbot: ${chatbotId}`);
        return null;
      }

      const projectDoc = snapshot.docs[0];
      const data = projectDoc.data() as ProjectMappingDocument;

      const project: ProjectMapping = {
        projectId: data.projectId,
        chatbotId: data.chatbotId,
        userId: data.userId,
        status: data.status,
        createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
        lastUsedAt: data.lastUsedAt ? data.lastUsedAt.toDate() : null,
        deployedAt: data.deployedAt?.toDate() || null,
        recycledAt: data.recycledAt?.toDate() || null,
        vercelUrl: data.vercelUrl || null,
        projectType: data.projectType || 'dedicated',
        metadata: data.metadata || null
      };

      console.log(`🎯 Found project for chatbot ${chatbotId}: ${project.projectId} (${project.projectType})`);
      return project;

    } catch (error: any) {
      console.error(`❌ Error finding project for chatbot ${chatbotId}:`, error);
      return null;
    }
  }
}