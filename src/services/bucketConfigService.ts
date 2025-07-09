// DEBUG: Service for configuring Google Cloud Storage bucket permissions
import { Storage } from '@google-cloud/storage';

export class BucketConfigService {
  
  /**
   * Make a specific GCS bucket publicly readable
   * @param projectId - The GCP project ID
   * @param bucketName - The bucket name to make public
   * @returns Promise<{ success: boolean; message: string }>
   */
  static async makeBucketPublic(projectId: string, bucketName: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🌐 Making GCS bucket ${bucketName} public in project ${projectId}`);
      
      // Initialize project-specific storage client
      const credentials = this.getGoogleCloudCredentials();
      const storage = new Storage({
        projectId: projectId,
        ...(credentials && { credentials })
      });

      const bucket = storage.bucket(bucketName);
      
      // Check if bucket exists
      const [exists] = await bucket.exists();
      if (!exists) {
        return {
          success: false,
          message: `Bucket ${bucketName} does not exist in project ${projectId}`
        };
      }

      // Check current IAM policy
      const [policy] = await bucket.iam.getPolicy({ requestedPolicyVersion: 3 });
      
      // Check if already public
      const isAlreadyPublic = policy.bindings.some(binding => 
        binding.role === 'roles/storage.objectViewer' && 
        binding.members?.includes('allUsers')
      );

      if (isAlreadyPublic) {
        console.log(`✅ Bucket ${bucketName} is already publicly accessible`);
        return {
          success: true,
          message: `Bucket ${bucketName} is already publicly accessible`
        };
      }

      // Add public read access
      policy.bindings.push({
        role: 'roles/storage.objectViewer',
        members: ['allUsers']
      });

      await bucket.iam.setPolicy(policy);
      console.log(`✅ Made GCS bucket ${bucketName} publicly accessible`);

      return {
        success: true,
        message: `Bucket ${bucketName} is now publicly accessible`
      };

    } catch (error: any) {
      console.error(`❌ Failed to make bucket ${bucketName} public:`, error);
      return {
        success: false,
        message: `Failed to make bucket public: ${error.message}`
      };
    }
  }

  /**
   * Make the chatbot-document-images bucket public in the reusable project
   * @param reusableProjectId - The reusable Firebase project ID
   * @returns Promise<{ success: boolean; message: string }>
   */
  static async makeImagesBucketPublic(reusableProjectId?: string): Promise<{ success: boolean; message: string }> {
    const projectId = reusableProjectId || process.env.REUSABLE_FIREBASE_PROJECT_ID;
    
    if (!projectId) {
      return {
        success: false,
        message: 'REUSABLE_FIREBASE_PROJECT_ID not found in environment variables'
      };
    }

    const bucketName = `${projectId}-chatbot-document-images`;
    console.log(`🎯 Target bucket: ${bucketName}`);
    
    return await this.makeBucketPublic(projectId, bucketName);
  }

  /**
   * Create the chatbot-document-images bucket if it doesn't exist and make it public
   * @param reusableProjectId - The reusable Firebase project ID
   * @returns Promise<{ success: boolean; message: string }>
   */
  static async ensurePublicImagesBucket(reusableProjectId?: string): Promise<{ success: boolean; message: string }> {
    try {
      const projectId = reusableProjectId || process.env.REUSABLE_FIREBASE_PROJECT_ID;
      
      if (!projectId) {
        return {
          success: false,
          message: 'REUSABLE_FIREBASE_PROJECT_ID not found in environment variables'
        };
      }

      const bucketName = `${projectId}-chatbot-document-images`;
      const region = process.env.FIREBASE_DEFAULT_REGION || 'us-central1';
      
      console.log(`🪣 Ensuring public images bucket exists: ${bucketName}`);
      
      // Initialize storage client
      const credentials = this.getGoogleCloudCredentials();
      const storage = new Storage({
        projectId: projectId,
        ...(credentials && { credentials })
      });

      const bucket = storage.bucket(bucketName);
      
      // Check if bucket exists
      const [exists] = await bucket.exists();
      if (!exists) {
        console.log(`📦 Creating bucket ${bucketName}...`);
        
        // Create bucket with public access allowed
        const [newBucket] = await storage.createBucket(bucketName, {
          location: region,
          storageClass: 'STANDARD',
          uniformBucketLevelAccess: true,
          publicAccessPrevention: 'inherited'
        });
        
        // Make it public
        await newBucket.makePublic();
        console.log(`✅ Created and made bucket ${bucketName} public`);
        
        return {
          success: true,
          message: `Created and made bucket ${bucketName} publicly accessible`
        };
      } else {
        console.log(`📦 Bucket ${bucketName} exists, making it public...`);
        
        // Bucket exists, just make it public
        const result = await this.makeBucketPublic(projectId, bucketName);
        return result;
      }

    } catch (error: any) {
      console.error(`❌ Failed to ensure public images bucket:`, error);
      return {
        success: false,
        message: `Failed to ensure public bucket: ${error.message}`
      };
    }
  }

  /**
   * Get Google Cloud credentials configuration
   */
  private static getGoogleCloudCredentials() {
    // In production (Vercel), use JSON from environment variable
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      try {
        return JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      } catch (error) {
        console.error('❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', error);
        throw new Error('Invalid Google Cloud credentials JSON in environment variable');
      }
    }
    
    // In development, use the file path (if GOOGLE_APPLICATION_CREDENTIALS is set)
    // The Google Cloud libraries will automatically use this
    return undefined; // Let the library use default authentication
  }
}