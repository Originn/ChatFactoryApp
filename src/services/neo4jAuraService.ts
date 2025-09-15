/**
 * Neo4j AuraDB API Service - Programmatic Instance Management
 *
 * Comprehensive service for managing Neo4j AuraDB instances via REST API:
 * - OAuth 2.0 authentication with token caching
 * - Instance creation, status monitoring, and deletion
 * - User-specific instance provisioning for multi-tenant architecture
 * - Robust error handling and retry logic
 *
 * Key Features:
 * ✅ Automatic token refresh and caching (1-hour expiration)
 * ✅ Instance creation with customizable parameters
 * ✅ Status polling with exponential backoff
 * ✅ Secure credential management
 * ✅ Instance cleanup and billing management
 */

interface AuraAuthToken {
  access_token: string;
  expires_at: number; // Unix timestamp
  token_type: 'Bearer';
}

interface AuraProject {
  id: string;
  name: string;
  status: string;
}

interface AuraInstance {
  id: string;
  name: string;
  status: 'creating' | 'running' | 'paused' | 'deleted' | 'failed';
  connection_url: string;
  tenant_id: string;
  cloud_provider: string;
  region: string;
  memory: string;
  username: string;
  password: string;
}

interface CreateInstanceRequest {
  name: string;
  version: string;
  region: string;
  memory: string;
  type: string;
  tenant_id: string;
  cloud_provider: 'gcp' | 'aws' | 'azure';
}

interface CreateInstanceResponse {
  success: boolean;
  instance?: AuraInstance;
  error?: string;
}

export class Neo4jAuraService {
  private static readonly AURA_API_BASE = 'https://api.neo4j.io';
  private static readonly TOKEN_ENDPOINT = '/oauth/token';
  private static readonly PROJECTS_ENDPOINT = '/v1/projects';
  private static readonly INSTANCES_ENDPOINT = '/v1/instances';

  // Token cache to avoid frequent API calls (tokens expire in 1 hour)
  private static tokenCache: AuraAuthToken | null = null;

  /**
   * Get OAuth 2.0 bearer token for Aura API authentication
   */
  private static async getAccessToken(): Promise<string> {
    console.log('🔐 Getting Neo4j Aura access token...');

    // Check if we have a valid cached token
    if (this.tokenCache && Date.now() < this.tokenCache.expires_at) {
      console.log('✅ Using cached token');
      return this.tokenCache.access_token;
    }

    const clientId = process.env.NEO4J_AURA_CLIENT_ID;
    const clientSecret = process.env.NEO4J_AURA_CLIENT_SECRET;

    console.log(`🔍 Client ID present: ${!!clientId}`);
    console.log(`🔍 Client Secret present: ${!!clientSecret}`);
    console.log(`🔍 Client ID value: ${clientId ? clientId.substring(0, 8) + '...' : 'undefined'}`);

    if (!clientId || !clientSecret) {
      const errorMsg = 'Missing Neo4j Aura API credentials. Please set NEO4J_AURA_CLIENT_ID and NEO4J_AURA_CLIENT_SECRET environment variables.';
      console.error('❌', errorMsg);
      throw new Error(errorMsg);
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
      console.log('🔐 Requesting Neo4j Aura API token...');

      const response = await fetch(`${this.AURA_API_BASE}${this.TOKEN_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`
        },
        body: 'grant_type=client_credentials'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get Aura API token: ${response.status} - ${errorText}`);
      }

      const tokenData = await response.json();

      // Cache token with 1-hour expiration (minus 5 minutes for safety)
      this.tokenCache = {
        access_token: tokenData.access_token,
        expires_at: Date.now() + (55 * 60 * 1000), // 55 minutes
        token_type: 'Bearer'
      };

      console.log('✅ Successfully obtained Aura API token');
      return tokenData.access_token;

    } catch (error) {
      console.error('❌ Failed to get Aura API token:', error);
      throw error;
    }
  }

  /**
   * Get the default project ID for creating instances
   */
  private static async getDefaultProjectId(): Promise<string> {
    const token = await this.getAccessToken();

    try {
      console.log('📋 Fetching Aura projects...');

      const response = await fetch(`${this.AURA_API_BASE}${this.PROJECTS_ENDPOINT}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch projects: ${response.status} - ${errorText}`);
      }

      const projects: AuraProject[] = await response.json();

      if (projects.length === 0) {
        throw new Error('No Aura projects found. Please create a project in the Neo4j Aura Console.');
      }

      // Use the first active project
      const activeProject = projects.find(p => p.status === 'active') || projects[0];
      console.log(`📋 Using project: ${activeProject.name} (${activeProject.id})`);

      return activeProject.id;

    } catch (error) {
      console.error('❌ Failed to fetch Aura projects:', error);
      throw error;
    }
  }

  /**
   * Create a new AuraDB instance for a chatbot
   */
  static async createInstance(
    chatbotId: string,
    chatbotName: string,
    options: {
      region?: string;
      memory?: string;
      cloudProvider?: 'gcp' | 'aws' | 'azure';
    } = {}
  ): Promise<CreateInstanceResponse> {
    try {
      const token = await this.getAccessToken();
      const projectId = await this.getDefaultProjectId();

      const instanceName = `chatbot-${chatbotId}`;
      const instanceRequest: CreateInstanceRequest = {
        name: instanceName,
        version: '5',
        region: options.region || 'us-central1',
        memory: options.memory || '1GB',
        type: 'enterprise-db',
        tenant_id: projectId,
        cloud_provider: options.cloudProvider || 'gcp'
      };

      console.log(`🏗️ Creating AuraDB instance: ${instanceName}...`);
      console.log(`📍 Region: ${instanceRequest.region}, Memory: ${instanceRequest.memory}, Provider: ${instanceRequest.cloud_provider}`);

      const response = await fetch(`${this.AURA_API_BASE}${this.INSTANCES_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(instanceRequest)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to create instance: ${response.status} - ${errorText}`);
        return {
          success: false,
          error: `Failed to create AuraDB instance: ${response.status} - ${errorText}`
        };
      }

      const instance: AuraInstance = await response.json();

      console.log(`✅ AuraDB instance created successfully: ${instance.id}`);
      console.log(`🔗 Connection URL: ${instance.connection_url}`);
      console.log(`⏳ Status: ${instance.status}`);

      return {
        success: true,
        instance
      };

    } catch (error) {
      console.error('❌ Error creating AuraDB instance:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get instance status and details
   */
  static async getInstanceStatus(instanceId: string): Promise<AuraInstance | null> {
    try {
      const token = await this.getAccessToken();

      const response = await fetch(`${this.AURA_API_BASE}${this.INSTANCES_ENDPOINT}/${instanceId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Instance not found
        }
        throw new Error(`Failed to get instance status: ${response.status}`);
      }

      const instance: AuraInstance = await response.json();
      return instance;

    } catch (error) {
      console.error(`❌ Error getting instance status for ${instanceId}:`, error);
      return null;
    }
  }

  /**
   * Wait for instance to become ready with exponential backoff
   */
  static async waitForInstanceReady(
    instanceId: string,
    maxWaitMinutes: number = 10
  ): Promise<AuraInstance | null> {
    const startTime = Date.now();
    const maxWaitMs = maxWaitMinutes * 60 * 1000;
    let attempt = 0;

    console.log(`⏳ Waiting for instance ${instanceId} to become ready (max ${maxWaitMinutes} minutes)...`);

    while (Date.now() - startTime < maxWaitMs) {
      const instance = await this.getInstanceStatus(instanceId);

      if (!instance) {
        console.error('❌ Instance not found or deleted');
        return null;
      }

      console.log(`📊 Instance status: ${instance.status} (attempt ${attempt + 1})`);

      if (instance.status === 'running') {
        console.log(`✅ Instance ${instanceId} is ready!`);
        return instance;
      }

      if (instance.status === 'failed') {
        console.error(`❌ Instance ${instanceId} failed to create`);
        return null;
      }

      // Exponential backoff: 5s, 10s, 20s, 40s, 60s (max)
      const waitMs = Math.min(5000 * Math.pow(2, attempt), 60000);
      console.log(`⏳ Waiting ${waitMs/1000}s before next check...`);

      await new Promise(resolve => setTimeout(resolve, waitMs));
      attempt++;
    }

    console.error(`⏰ Timeout waiting for instance ${instanceId} to become ready`);
    return null;
  }

  /**
   * Delete an AuraDB instance
   */
  static async deleteInstance(instanceId: string): Promise<boolean> {
    try {
      const token = await this.getAccessToken();

      console.log(`🗑️ Deleting AuraDB instance: ${instanceId}...`);

      const response = await fetch(`${this.AURA_API_BASE}${this.INSTANCES_ENDPOINT}/${instanceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`⚠️ Instance ${instanceId} not found (may already be deleted)`);
          return true; // Consider as success if already deleted
        }

        const errorText = await response.text();
        console.error(`❌ Failed to delete instance: ${response.status} - ${errorText}`);
        return false;
      }

      console.log(`✅ Successfully initiated deletion of instance: ${instanceId}`);
      return true;

    } catch (error) {
      console.error(`❌ Error deleting instance ${instanceId}:`, error);
      return false;
    }
  }

  /**
   * List all instances (useful for debugging and management)
   */
  static async listInstances(): Promise<AuraInstance[]> {
    try {
      const token = await this.getAccessToken();

      const response = await fetch(`${this.AURA_API_BASE}${this.INSTANCES_ENDPOINT}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to list instances: ${response.status}`);
      }

      const instances: AuraInstance[] = await response.json();
      return instances;

    } catch (error) {
      console.error('❌ Error listing instances:', error);
      return [];
    }
  }

  /**
   * Test API connectivity and permissions
   */
  static async testConnection(): Promise<{ success: boolean; error?: string; projectCount?: number }> {
    try {
      console.log('🧪 Testing Neo4j Aura API connection...');

      const token = await this.getAccessToken();

      // Test by fetching projects
      const response = await fetch(`${this.AURA_API_BASE}${this.PROJECTS_ENDPOINT}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API test failed: ${response.status}`);
      }

      const projects: AuraProject[] = await response.json();

      console.log(`✅ Neo4j Aura API connection successful. Found ${projects.length} projects.`);

      return {
        success: true,
        projectCount: projects.length
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Neo4j Aura API connection failed:', errorMessage);

      return {
        success: false,
        error: errorMessage
      };
    }
  }
}

export type { AuraInstance, CreateInstanceResponse };