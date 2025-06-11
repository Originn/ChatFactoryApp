import * as admin from 'firebase-admin';

export interface CreateDatabaseOptions {
  projectId: string;
  databaseId: string;
  location?: string;
  type?: 'FIRESTORE_NATIVE' | 'DATASTORE_MODE';
}

export interface DatabaseResult {
  success: boolean;
  databaseId?: string;
  operation?: any;
  error?: string;
  details?: string;
}

/**
 * Service for managing Firestore databases programmatically using Firebase Admin SDK
 * Uses FirestoreAdminClient to create/manage databases without child processes
 */
export class FirebaseDbService {
  
  /**
   * Create a new Firestore database in a Firebase project using SDK
   */
  static async createDatabase(options: CreateDatabaseOptions): Promise<DatabaseResult> {
    const {
      projectId,
      databaseId,
      location = 'us-central1',
      type = 'FIRESTORE_NATIVE'
    } = options;

    try {
      console.log(`🔄 Creating Firestore database '${databaseId}' in project '${projectId}' using Firebase Admin SDK`);

      // Initialize FirestoreAdminClient through Firebase Admin
      const adminClient = new admin.firestore.v1.FirestoreAdminClient({
        projectId: projectId,
        // Uses Application Default Credentials or service account from environment
      });

      // Prepare the request for database creation with correct types
      const request = {
        parent: `projects/${projectId}`,
        databaseId: databaseId,
        database: {
          locationId: location,
          type: type as any, // Cast to avoid enum type issues
          concurrencyMode: 'OPTIMISTIC' as any, // Cast to avoid enum type issues
          appEngineIntegrationMode: 'DISABLED' as any // Cast to avoid enum type issues
        }
      };

      console.log(`📝 Creating database with request:`, {
        parent: request.parent,
        databaseId: request.databaseId,
        location: location,
        type: type
      });

      // Create the database (this is a long-running operation)
      const [operation] = await adminClient.createDatabase(request);
      
      console.log(`🔄 Database creation started. Operation: ${operation.name}`);

      // Wait for the operation to complete
      console.log(`⏳ Waiting for database creation to complete...`);
      
      // Handle the promise differently to avoid destructuring issues
      const result = await operation.promise();
      const database = Array.isArray(result) ? result[0] : result;

      console.log(`✅ Firestore database '${databaseId}' created successfully!`);
      console.log(`📋 Database details:`, {
        name: database?.name,
        locationId: database?.locationId,
        type: database?.type
      });

      return {
        success: true,
        databaseId: databaseId,
        operation: operation,
        details: `Database created at ${database?.name || 'unknown'}`
      };

    } catch (error: any) {
      console.error(`❌ Failed to create Firestore database:`, error);
      
      // Handle specific error cases
      if (error.code === 6) { // ALREADY_EXISTS
        console.log(`ℹ️  Database '${databaseId}' already exists in project '${projectId}'`);
        return {
          success: true,
          databaseId: databaseId,
          details: 'Database already exists'
        };
      }
      
      return {
        success: false,
        error: error.message || 'Unknown error creating database',
        details: error.toString()
      };
    }
  }

  /**
   * Check if a Firestore database exists in a project using SDK
   */
  static async checkDatabaseExists(projectId: string, databaseId: string): Promise<boolean> {
    try {
      const adminClient = new admin.firestore.v1.FirestoreAdminClient({
        projectId: projectId,
      });

      // Try to get the database
      const databasePath = adminClient.databasePath(projectId, databaseId);
      await adminClient.getDatabase({ name: databasePath });
      
      console.log(`✅ Database '${databaseId}' exists in project '${projectId}'`);
      return true;

    } catch (error: any) {
      if (error.code === 5) { // NOT_FOUND
        console.log(`❌ Database '${databaseId}' does not exist in project '${projectId}'`);
        return false;
      }
      
      console.error(`❌ Error checking database existence:`, error);
      return false;
    }
  }

  /**
   * List all databases in a Firebase project
   */
  static async listDatabases(projectId: string): Promise<string[]> {
    try {
      const adminClient = new admin.firestore.v1.FirestoreAdminClient({
        projectId: projectId,
      });

      const [response] = await adminClient.listDatabases({
        parent: `projects/${projectId}`
      });

      // The response has a databases property containing the array
      const databases = response.databases || [];
      
      const databaseIds = databases.map((db: any) => {
        const nameParts = db.name?.split('/');
        return nameParts?.[nameParts.length - 1] || '';
      }).filter((id: string) => id);

      console.log(`📋 Found ${databaseIds.length} databases in project '${projectId}':`, databaseIds);
      return databaseIds;

    } catch (error: any) {
      console.error(`❌ Error listing databases:`, error);
      return [];
    }
  }

  /**
   * Create default database (if it doesn't exist) using SDK
   */
  static async ensureDefaultDatabase(projectId: string, location = 'us-central1'): Promise<DatabaseResult> {
    try {
      // Check if default database exists
      const exists = await this.checkDatabaseExists(projectId, '(default)');
      
      if (exists) {
        console.log(`✅ Default database already exists in project ${projectId}`);
        return {
          success: true,
          databaseId: '(default)'
        };
      }

      // Create default database using SDK
      console.log(`🔄 Creating default Firestore database in project ${projectId}`);
      
      const result = await this.createDatabase({
        projectId,
        databaseId: '(default)',
        location,
        type: 'FIRESTORE_NATIVE'
      });

      return result;

    } catch (error: any) {
      console.error(`❌ Failed to ensure default database:`, error);
      
      return {
        success: false,
        error: error.message || 'Unknown error ensuring default database'
      };
    }
  }

  /**
   * Create database and wait for completion
   */
  static async createDatabaseAndWait(options: CreateDatabaseOptions): Promise<DatabaseResult> {
    return await this.createDatabase(options);
  }

  /**
   * Delete a database using SDK (use with caution!)
   */
  static async deleteDatabase(projectId: string, databaseId: string): Promise<DatabaseResult> {
    try {
      console.log(`🗑️  Deleting Firestore database '${databaseId}' in project '${projectId}'`);

      const adminClient = new admin.firestore.v1.FirestoreAdminClient({
        projectId: projectId,
      });

      const databasePath = adminClient.databasePath(projectId, databaseId);
      const [operation] = await adminClient.deleteDatabase({ name: databasePath });
      
      // Wait for deletion to complete - handle promise type properly
      await operation.promise();

      console.log(`✅ Database '${databaseId}' deleted successfully`);
      
      return {
        success: true,
        databaseId: databaseId,
        details: 'Database deleted successfully'
      };

    } catch (error: any) {
      console.error(`❌ Failed to delete database:`, error);
      
      return {
        success: false,
        error: error.message || 'Unknown error deleting database'
      };
    }
  }
}
