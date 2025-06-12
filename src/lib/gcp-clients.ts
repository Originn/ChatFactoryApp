// src/lib/gcp-clients.ts
import { Storage } from '@google-cloud/storage';
import { CloudBillingClient } from '@google-cloud/billing';
import { ServiceUsageClient } from '@google-cloud/service-usage';
import { ProjectsClient } from '@google-cloud/resource-manager';
import { IAMCredentialsClient } from '@google-cloud/iam-credentials';
import { IdentityAwareProxyOAuthServiceClient } from '@google-cloud/iap';
import { getGCPCredentials } from './gcp-auth';

// Get credentials once for all clients
const credentials = getGCPCredentials() as any;

// Initialize SDK clients with shared credentials
// These are optimized for serverless environments with connection reuse
export const storageClient = new Storage(credentials);
export const billingClient = new CloudBillingClient(credentials);
export const serviceUsageClient = new ServiceUsageClient(credentials);
export const resourceManagerClient = new ProjectsClient(credentials);
export const iamCredentialsClient = new IAMCredentialsClient(credentials);
export const iapClient = new IdentityAwareProxyOAuthServiceClient(credentials);

console.log('✅ Google Cloud SDK clients initialized (including IAP OAuth)');
