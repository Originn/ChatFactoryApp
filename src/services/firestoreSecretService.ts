import { adminDb } from '@/lib/firebase/admin/index';
import { Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';

export interface PoolServiceAccount {
  clientEmail: string;
  privateKey: string;
  projectId: string;
}

export interface SecretMetadata {
  type: 'api_key' | 'service_account_email' | 'service_account_key';
  poolId?: string;
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  encrypted: boolean;
}

export interface SecretDocument {
  value: string;
  metadata: SecretMetadata;
}

/**
 * Service for managing secrets in Firestore instead of Google Secret Manager
 * Provides cost-effective secret storage with proper encryption
 */
export class FirestoreSecretService {
  private static readonly COLLECTION = 'secrets';
  private static readonly ENCRYPTION_KEY = process.env.FIRESTORE_ENCRYPTION_KEY || 'default-dev-key-change-in-production';
  private static readonly ALGORITHM = 'aes-256-cbc';

  /**
   * Get a secret value from Firestore
   * @param secretName - The name of the secret
   * @returns Promise<string | null>
   */
  static async getSecret(secretName: string): Promise<string | null> {
    try {
      const secretDoc = await adminDb.collection(this.COLLECTION).doc(secretName).get();

      if (!secretDoc.exists) {
        console.warn(`🔍 Secret not found: ${secretName}`);
        return null;
      }

      const data = secretDoc.data() as SecretDocument;
      let value = data.value;

      // Decrypt if encrypted
      if (data.metadata.encrypted) {
        try {
          value = this.decrypt(value);
        } catch (decryptError) {
          console.error(`❌ Failed to decrypt secret ${secretName}:`, decryptError);
          return null;
        }
      }

      console.log(`✅ Retrieved secret: ${secretName}`);
      return value;

    } catch (error) {
      console.error(`❌ Error retrieving secret ${secretName}:`, error);
      return null;
    }
  }

  /**
   * Store a secret value in Firestore
   * @param secretName - The name of the secret
   * @param value - The secret value
   * @param metadata - Secret metadata
   * @returns Promise<void>
   */
  static async setSecret(
    secretName: string,
    value: string,
    metadata: Partial<SecretMetadata> = {}
  ): Promise<void> {
    try {
      // Determine if value should be encrypted (private keys and sensitive data)
      const shouldEncrypt = metadata.type === 'service_account_key' ||
                           secretName.includes('private-key') ||
                           secretName.includes('PRIVATE_KEY');

      let storedValue = value;
      if (shouldEncrypt) {
        storedValue = this.encrypt(value);
      }

      const secretDoc: SecretDocument = {
        value: storedValue,
        metadata: {
          type: metadata.type || 'api_key',
          ...(metadata.poolId !== undefined && { poolId: metadata.poolId }),
          ...(metadata.description !== undefined && { description: metadata.description }),
          createdAt: metadata.createdAt || Timestamp.now(),
          updatedAt: Timestamp.now(),
          encrypted: shouldEncrypt
        }
      };

      await adminDb.collection(this.COLLECTION).doc(secretName).set(secretDoc);
      console.log(`✅ Stored secret: ${secretName} (encrypted: ${shouldEncrypt})`);

    } catch (error) {
      console.error(`❌ Error storing secret ${secretName}:`, error);
      throw error;
    }
  }

  /**
   * Get service account credentials for a specific pool project
   * @param poolProjectId - The pool project ID (e.g., 'chatfactory-pool-001')
   * @returns Promise<PoolServiceAccount>
   */
  static async getPoolServiceAccount(poolProjectId: string): Promise<PoolServiceAccount> {
    try {
      console.log(`🔐 Retrieving service account credentials for ${poolProjectId}...`);

      // Extract pool number (e.g., '001' from 'chatfactory-pool-001')
      const poolNumber = poolProjectId.split('-').pop();
      if (!poolNumber) {
        throw new Error(`Invalid pool project ID format: ${poolProjectId}`);
      }

      // Get both secrets in parallel
      const clientEmailSecret = `pool-${poolNumber}-client-email`;
      const privateKeySecret = `pool-${poolNumber}-private-key`;

      console.log(`🔍 Fetching secrets: ${clientEmailSecret}, ${privateKeySecret}`);

      const [clientEmail, privateKey] = await Promise.all([
        this.getSecret(clientEmailSecret),
        this.getSecret(privateKeySecret)
      ]);

      if (!clientEmail || !privateKey) {
        throw new Error(`Missing credentials for ${poolProjectId}: clientEmail=${!!clientEmail}, privateKey=${!!privateKey}`);
      }

      const serviceAccount: PoolServiceAccount = {
        clientEmail: clientEmail.trim(),
        privateKey: privateKey.trim(),
        projectId: poolProjectId
      };

      console.log(`✅ Pool credentials loaded: ${serviceAccount.clientEmail}`);
      return serviceAccount;

    } catch (error) {
      console.error(`❌ Failed to get pool service account for ${poolProjectId}:`, error);
      throw error;
    }
  }

  /**
   * Get the shared pool Firebase API key
   * @returns Promise<string | null>
   */
  static async getPoolFirebaseApiKey(): Promise<string | null> {
    return this.getSecret('POOL_FIREBASE_API_KEY');
  }

  /**
   * Get OpenAI API key
   * @returns Promise<string | null>
   */
  static async getOpenAIApiKey(): Promise<string | null> {
    return this.getSecret('OPENAI_API_KEY');
  }

  /**
   * Get Langextract API key
   * @returns Promise<string | null>
   */
  static async getLangextractApiKey(): Promise<string | null> {
    return this.getSecret('LANGEXTRACT_API_KEY');
  }

  /**
   * List all secrets (for debugging/migration)
   * @returns Promise<string[]>
   */
  static async listSecrets(): Promise<string[]> {
    try {
      const snapshot = await adminDb.collection(this.COLLECTION).get();
      return snapshot.docs.map(doc => doc.id);
    } catch (error) {
      console.error('❌ Error listing secrets:', error);
      return [];
    }
  }

  /**
   * Delete a secret
   * @param secretName - The name of the secret to delete
   * @returns Promise<void>
   */
  static async deleteSecret(secretName: string): Promise<void> {
    try {
      await adminDb.collection(this.COLLECTION).doc(secretName).delete();
      console.log(`🗑️ Deleted secret: ${secretName}`);
    } catch (error) {
      console.error(`❌ Error deleting secret ${secretName}:`, error);
      throw error;
    }
  }

  /**
   * Check if a secret exists
   * @param secretName - The name of the secret
   * @returns Promise<boolean>
   */
  static async secretExists(secretName: string): Promise<boolean> {
    try {
      const secretDoc = await adminDb.collection(this.COLLECTION).doc(secretName).get();
      return secretDoc.exists;
    } catch (error) {
      console.error(`❌ Error checking if secret exists ${secretName}:`, error);
      return false;
    }
  }

  /**
   * Encrypt a value using AES-256-CBC
   */
  private static encrypt(text: string): string {
    const key = crypto.scryptSync(this.ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt a value using AES-256-CBC
   */
  private static decrypt(text: string): string {
    const key = crypto.scryptSync(this.ENCRYPTION_KEY, 'salt', 32);
    const parts = text.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted format');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}