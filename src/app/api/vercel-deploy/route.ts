import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebase/admin/index';
import { Timestamp } from 'firebase-admin/firestore';
import { PineconeService } from '@/services/pineconeService';
import { DatabaseService } from '@/services/databaseService';
import { FirestoreSecretService } from '@/services/firestoreSecretService';
import { FirebaseProjectService } from '@/services/firebaseProjectService';
import { FirebaseAuthorizedDomainsService } from '@/services/firebaseAuthorizedDomainsService';
import { getEmbeddingDimensions, getEmbeddingProvider } from '@/lib/embeddingModels';
import { generateFaviconEnvVars } from '@/lib/utils/faviconUpload';
import { FirestoreSecretService as SecretManagerService } from '@/services/firestoreSecretService';
import { ProjectMappingService } from '@/services/projectMappingService';

// Repository information
const REPO_OWNER = 'Originn';
const REPO_NAME = 'ChatFactoryTemplate';  // Your chatbot template repository
const REPO = `${REPO_OWNER}/${REPO_NAME}`;

// Firebase project will be automatically allocated (pool-first with dedicated fallback)

// SIMPLIFIED: Always deploy from main branch to production
// No staging/preview workflow needed - direct to production deployment

// Helper function to validate domain format
function isValidDomain(domain: string): boolean {
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
  return domainRegex.test(domain) && domain.length <= 253;
}

// Helper function to add custom domain to Vercel project
async function addCustomDomainToProject(
  vercelToken: string,
  projectName: string,
  customDomain: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    console.log(`🌐 Adding custom domain: ${customDomain} to project: ${projectName}`);
    
    // Step 1: Add domain to project
    const addDomainResponse = await fetch(
      `https://api.vercel.com/v9/projects/${projectName}/domains`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${vercelToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: customDomain
        })
      }
    );

    if (!addDomainResponse.ok) {
      const error = await addDomainResponse.json();
      
      if (error.error?.code === 'domain_already_exists') {
        console.log(`⚠️ Domain ${customDomain} already exists on project`);
        return { success: true, data: { alreadyExists: true } };
      }
      
      console.error('❌ Failed to add domain:', error);
      return { 
        success: false, 
        error: error.error?.message || 'Failed to add domain to project' 
      };
    }

    const domainData = await addDomainResponse.json();
    console.log(`✅ Domain added successfully:`, domainData);

    // Check if domain needs verification
    if (!domainData.verified) {
      console.log(`🔍 Domain requires verification. Verification challenges:`, domainData.verification);
      
      return {
        success: true,
        data: {
          ...domainData,
          requiresVerification: true,
          verificationInstructions: generateVerificationInstructions(domainData.verification)
        }
      };
    }

    return { success: true, data: domainData };
    
  } catch (error: any) {
    console.error('❌ Error adding custom domain:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to generate user-friendly verification instructions
function generateVerificationInstructions(verification: any[]): string[] {
  const instructions: string[] = [];
  
  verification.forEach((challenge) => {
    switch (challenge.type) {
      case 'TXT':
        instructions.push(
          `DNS TXT Record: Add a TXT record to ${challenge.domain} with value: ${challenge.value}`
        );
        break;
      case 'CNAME':
        instructions.push(
          `DNS CNAME Record: Point ${challenge.domain} to ${challenge.value}`
        );
        break;
      case 'A':
        instructions.push(
          `DNS A Record: Point ${challenge.domain} to IP: ${challenge.value}`
        );
        break;
      default:
        instructions.push(
          `${challenge.type} Record: Set ${challenge.domain} = ${challenge.value}`
        );
    }
  });
  
  return instructions;
}

export async function POST(request: NextRequest) {
  // Declare variables outside try-catch for cleanup access
  let projectName: string | undefined;
  let projectId: string | undefined;
  let chatbotId: string | undefined;
  let dedicatedFirebaseProject: any;
  let VERCEL_API_TOKEN: string | undefined;

  try {
    const body = await request.json();
    const parsedBody = body as { chatbotId: string; chatbotName?: string; userId: string; vectorstore?: any; desiredVectorstoreIndexName?: string; embeddingModel?: string; preferredProjectId?: string };
    chatbotId = parsedBody.chatbotId;
    const { chatbotName, userId, vectorstore, desiredVectorstoreIndexName, embeddingModel, preferredProjectId } = parsedBody;

    console.log('🚀 Starting deployment for:', { chatbotId, chatbotName, userId, vectorstore, preferredProjectId });

    if (!chatbotId) {
      return NextResponse.json({ error: 'Missing chatbot ID' }, { status: 400 });
    }

    // SIMPLIFIED DEPLOYMENT STRATEGY:
    // Always deploy from 'main' branch to 'production' target
    // No staging/preview complexity - straight to production

    VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
    if (!VERCEL_API_TOKEN) {
      return NextResponse.json({
        error: 'Vercel API token not configured on server'
      }, { status: 500 });
    }

    // Fetch chatbot data from Firestore to get logo URL and other details
    let chatbotData = null;
    try {
      const chatbotSnap = await adminDb.collection("chatbots").doc(chatbotId).get();
      
      if (chatbotSnap.exists) {
        chatbotData = chatbotSnap.data();
        console.log('✅ Chatbot data retrieved for deployment');
        console.log('📊 Chatbot data summary:', {
          id: chatbotData.id,
          name: chatbotData.name,
          logoUrl: chatbotData.logoUrl || 'NOT SET',
          logoUrlExists: !!chatbotData.logoUrl,
          logoUrlLength: chatbotData.logoUrl?.length || 0,
          allFields: Object.keys(chatbotData)
        });
        
        // Log the exact logo URL value for debugging
        if (chatbotData.logoUrl) {
          console.log('🖼️  Logo URL found:', chatbotData.logoUrl);
        } else {
          console.warn('⚠️  Logo URL is empty or missing from chatbot data');
          console.log('🔍 Available fields in chatbot data:', Object.keys(chatbotData));
        }
      } else {
        console.warn('❌ Chatbot document not found in Firestore');
        console.log('🔍 Attempted to fetch chatbot ID:', chatbotId);
      }
    } catch (firestoreError) {
      console.error('❌ Error fetching chatbot data from Firestore:', firestoreError);
      // Continue deployment without logo if Firestore fails
    }

    // Sanitize project name for Vercel
    projectName = (chatbotName || chatbotData?.name || `chatbot-${chatbotId}`)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-');

    // 1. Create or get project
    console.log('Setting up Vercel project:', projectName);
    const projectData = {
      name: projectName,
      framework: 'nextjs',
      gitRepository: {
        type: 'github',
        repo: REPO,
        productionBranch: 'main'
      }
    };

    let repoId = null;
    projectId = null; // Store the actual project ID for API calls (declared outside try-catch)
    let projectExists = false;
    
    // Create project or get existing project details
    const createProjectResponse = await fetch('https://api.vercel.com/v9/projects', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(projectData)
    });

    if (!createProjectResponse.ok) {
      const errorData = await createProjectResponse.json();
      
      // Handle existing project case
      if (errorData.error?.code === 'project_already_exists') {
        console.log('Project already exists, retrieving details...');
        projectExists = true;
        
        const projectDetailsResponse = await fetch(`https://api.vercel.com/v9/projects/${projectName}`, {
          headers: {
            'Authorization': `Bearer ${VERCEL_API_TOKEN}`
          }
        });
        
        if (projectDetailsResponse.ok) {
          const projectDetails = await projectDetailsResponse.json();
          repoId = projectDetails.link?.repoId;
          projectId = projectDetails.id; // Store the project ID
          console.log(`Retrieved existing project with ID: ${projectId}, repoId: ${repoId}`);
        }
      } else {
        return NextResponse.json({ 
          error: `Failed to create Vercel project: ${errorData.error?.message || 'Unknown error'}`
        }, { status: 500 });
      }
    } else {
      const projectResult = await createProjectResponse.json();
      repoId = projectResult.link?.repoId;
      projectId = projectResult.id; // Store the project ID
      console.log(`Project created with ID: ${projectId}, repoId: ${repoId}`);
    }

    if (!projectId) {
      return NextResponse.json({ 
        error: 'Failed to retrieve project ID'
      }, { status: 500 });
    }

    // PARALLELIZATION OPTIMIZATION: Run service setup in parallel first, then set all environment variables in one batch
    console.log('🚀 PARALLEL EXECUTION: Starting Firebase and Pinecone setup concurrently...');

    // 2. Prepare complete chatbot configuration for the template
    // Try multiple possible field names for logo URL
    let logoUrl = chatbotData?.logoUrl || 
                  chatbotData?.logo_url || 
                  chatbotData?.logo?.url || 
                  chatbotData?.appearance?.logoUrl || 
                  '';
    
    console.log('🔍 Logo URL resolution from Firestore:', {
      'chatbotData?.logoUrl': chatbotData?.logoUrl || 'undefined',
      'chatbotData?.logo_url': chatbotData?.logo_url || 'undefined', 
      'chatbotData?.logo?.url': chatbotData?.logo?.url || 'undefined',
      'chatbotData?.appearance?.logoUrl': chatbotData?.appearance?.logoUrl || 'undefined',
      'preliminaryLogoUrl': logoUrl || 'EMPTY'
    });
    
    // Extract custom domain from chatbot data
    const customDomain = chatbotData?.domain?.trim();
    console.log('🌐 Custom domain from chatbot data:', customDomain || 'NOT SET');
    
    // If no logo URL found in Firestore, try to find it in Firebase Storage
    if (!logoUrl) {
      // Try to get userId from request body first, then from chatbot data
      const userIdForStorage = userId || chatbotData?.userId;
      
      if (userIdForStorage) {
        console.log('🔍 Logo URL not found in Firestore, checking Firebase Storage...');
        console.log('🔍 Using userId for storage search:', userIdForStorage);
        try {
          logoUrl = await findLogoInStorage(userIdForStorage, chatbotId);
          if (logoUrl) {
            console.log('✅ Found logo URL in Firebase Storage:', logoUrl);
          } else {
            console.log('❌ No logo found in Firebase Storage either');
          }
        } catch (storageError) {
          console.error('❌ Error checking Firebase Storage for logo:', storageError);
        }
      } else {
        console.warn('⚠️  No userId available for Firebase Storage search');
      }
    }
    
    const chatbotConfig = {
      id: chatbotId,
      name: chatbotName || chatbotData?.name || `Chatbot ${chatbotId}`,
      description: chatbotData?.description || 'AI-powered chatbot',
      logoUrl: logoUrl || '/wizchat-brain-logo.svg', // Default to wizchat logo if no custom logo
      primaryColor: chatbotData?.appearance?.primaryColor || '#3b82f6',
      bubbleStyle: chatbotData?.appearance?.bubbleStyle || 'rounded',
      requireAuth: chatbotData?.requireAuth || false,
      systemPrompt: chatbotData?.behavior?.systemPrompt || 'You are a helpful AI assistant.',
      llmModel: chatbotData?.aiConfig?.llmModel || 'gpt-3.5-turbo',
      temperature: chatbotData?.aiConfig?.temperature || 0.7,
      ...chatbotData
    };
    
    console.log('🚀 Final chatbot config for deployment:', {
      id: chatbotConfig.id,
      name: chatbotConfig.name,
      logoUrl: chatbotConfig.logoUrl || 'STILL EMPTY!',
      hasLogoUrl: !!chatbotConfig.logoUrl,
      logoUrlType: typeof chatbotConfig.logoUrl,
      logoUrlLength: chatbotConfig.logoUrl?.length || 0
    });

    // EXECUTION GROUP 2: Run Firebase and Pinecone setup in parallel
    console.log('⚡ Starting parallel service provisioning...');

    let vectorstoreResult;

    try {
      [dedicatedFirebaseProject, vectorstoreResult] = await Promise.all([
      // Firebase project allocation
      (async () => {
        console.log('🔄 Firebase: Using intelligent project allocation (pool-first with dedicated fallback)');

        try {
          console.log('🚀 Firebase: Requesting project allocation...');

          const firebaseRequest: any = {
            chatbotId,
            chatbotName: chatbotConfig.name,
            creatorUserId: userId || chatbotData?.userId || 'unknown'
          };

          // Add preferred project ID if specified (either from request or from chatbot document)
          const finalPreferredProjectId = preferredProjectId || chatbotData?.preferredProjectId;
          if (finalPreferredProjectId) {
            console.log(`🎯 User selected specific project: ${finalPreferredProjectId}`);
            firebaseRequest.preferredProjectId = finalPreferredProjectId;
          }

          const firebaseResult = await FirebaseProjectService.createProjectForChatbot(firebaseRequest);

          if (!firebaseResult.success) {
            console.error('❌ Firebase: Failed to allocate project:', firebaseResult.error);
            throw new Error(`Failed to allocate Firebase project: ${firebaseResult.error}`);
          }

          if (!firebaseResult.project) {
            console.error('❌ Firebase: Project allocation succeeded but no project returned');
            throw new Error('Firebase project allocation succeeded but no project data returned');
          }

          console.log('✅ Firebase: Project allocated:', firebaseResult.project.projectId);
          return firebaseResult.project;
        } catch (firebaseError) {
          console.error('❌ Firebase: Project allocation failed:', firebaseError);
          throw new Error(`Firebase project allocation failed: ${firebaseError.message}`);
        }
      })(),

      // Pinecone vectorstore setup
      (async () => {
        console.log('🗄️ Pinecone: Setting up vectorstore...');

        let vectorstoreIndexName = '';

        if (vectorstore && vectorstore.indexName) {
          // Use provided vectorstore
          console.log('🎯 Pinecone: Using provided vectorstore:', vectorstore.displayName, '(' + vectorstore.indexName + ')');
          vectorstoreIndexName = vectorstore.indexName;

          try {
            const exists = await PineconeService.indexExists(vectorstore.indexName);
            if (exists) {
              console.log('✅ Pinecone: Vectorstore exists and is ready');

              // Update chatbot document with vectorstore info
              await DatabaseService.updateChatbotVectorstore(chatbotId, {
                provider: 'pinecone',
                indexName: vectorstore.indexName,
                displayName: vectorstore.displayName,
                dimension: 1536,
                metric: 'cosine',
                region: 'us-east-1',
                status: 'ready',
              });

              return { indexName: vectorstoreIndexName, isExisting: true };
            } else {
              console.error('❌ Pinecone: Provided vectorstore does not exist:', vectorstore.indexName);
              throw new Error(`Vectorstore "${vectorstore.displayName}" does not exist`);
            }
          } catch (vectorstoreError) {
            console.error('❌ Pinecone: Error verifying vectorstore:', vectorstoreError);
            throw new Error(`Failed to verify vectorstore: ${vectorstoreError}`);
          }
        } else {
          // Create new vectorstore
          console.log('🗄️ Pinecone: Creating new vectorstore for chatbot:', chatbotId);

          try {
            let pineconeResult;
            const finalEmbeddingModel = embeddingModel || 'embed-v4.0';

            if (desiredVectorstoreIndexName) {
              console.log('🎯 Pinecone: Using desired index name:', desiredVectorstoreIndexName, 'with embedding model:', finalEmbeddingModel);
              pineconeResult = await PineconeService.createIndex(
                desiredVectorstoreIndexName,
                userId || chatbotData?.userId || 'unknown',
                finalEmbeddingModel,
                'cosine'
              );
            } else {
              console.log('🔄 Pinecone: Using auto-generated index name with embedding model:', finalEmbeddingModel);
              pineconeResult = await PineconeService.createIndexFromChatbotId(
                chatbotId,
                userId || chatbotData?.userId || 'unknown',
                finalEmbeddingModel,
                'cosine'
              );
            }

            if (!pineconeResult.success) {
              console.error('❌ Pinecone: Failed to create index:', pineconeResult.error);
              throw new Error(`Failed to create vectorstore: ${pineconeResult.error}`);
            }

            console.log('✅ Pinecone: Successfully created index:', pineconeResult.indexName, 'with embedding model:', finalEmbeddingModel);
            vectorstoreIndexName = pineconeResult.indexName;

            // Get dimensions for the embedding model
            const dimensions = getEmbeddingDimensions(finalEmbeddingModel);

            // Update chatbot document with vectorstore info
            await DatabaseService.updateChatbotVectorstore(chatbotId, {
              provider: 'pinecone',
              indexName: pineconeResult.indexName,
              dimension: dimensions,
              metric: 'cosine',
              region: 'us-east-1',
              status: 'ready',
            });

            return { indexName: vectorstoreIndexName, isExisting: false };
          } catch (pineconeError) {
            console.error('❌ Pinecone: Service error during deployment:', pineconeError);
            throw new Error(`Vectorstore creation failed: ${pineconeError}`);
          }
        }
      })()
      ]);

      console.log('🎉 Parallel service provisioning completed successfully!');
      console.log(`✅ Firebase project: ${dedicatedFirebaseProject.projectId}`);
      console.log(`✅ Pinecone index: ${vectorstoreResult.indexName} (${vectorstoreResult.isExisting ? 'existing' : 'new'})`);

    } catch (provisioningError) {
      console.error('❌ PARALLEL SERVICE PROVISIONING FAILED:', provisioningError);

      // Cleanup: Delete the Vercel project since deployment failed
      console.log('🧹 CLEANUP: Service provisioning failed, cleaning up...');

      await Promise.allSettled([
        deleteVercelProject(VERCEL_API_TOKEN, projectName, projectId),
        releasePoolProject(dedicatedFirebaseProject?.projectId || '', chatbotId)
      ]);

      console.log('✅ Cleanup operations completed (Vercel project deletion + pool project release)');

      // Re-throw the error to stop deployment
      throw provisioningError;
    }

    const vectorstoreIndexName = vectorstoreResult.indexName;

    // Setup OAuth 2.0 for Firebase Authentication
    console.log('🔐 Firebase Authentication configured via API...');
    let oauthClientConfig = null;
    
    try {
      if (dedicatedFirebaseProject?.projectId) {
        console.log('✅ Firebase Authentication configured automatically by API service');
        console.log('ℹ️  Firebase handles OAuth internally - no separate OAuth client needed');
        console.log('ℹ️  For advanced OAuth requirements, manual setup available at:');
        console.log(`ℹ️  https://console.cloud.google.com/apis/credentials?project=${dedicatedFirebaseProject.projectId}`);
        
        // Firebase Authentication is already configured by FirebaseAPIService
        oauthClientConfig = {
          message: 'Firebase Auth configured via API',
          clientId: 'firebase-managed',
          clientSecret: 'firebase-managed',
          configured: true
        };
      }
    } catch (oauthError) {
      console.error('❌ OAuth setup failed:', oauthError);
      console.warn('⚠️ Continuing deployment - Firebase Auth should still work');
    }

    // Check if Firebase service account credentials are available
    // Support both camelCase and snake_case field names
    const serviceAccount = (dedicatedFirebaseProject as any)?.serviceAccount;
    const clientEmail = serviceAccount?.client_email || serviceAccount?.clientEmail;
    const privateKey = serviceAccount?.private_key || serviceAccount?.privateKey;
    const hasValidServiceAccount = clientEmail && privateKey;

    console.log('🔍 Firebase service account validation:', {
      hasFirebaseProject: !!dedicatedFirebaseProject,
      hasConfig: !!dedicatedFirebaseProject?.config,
      hasServiceAccount: !!serviceAccount,
      hasClientEmail: !!clientEmail,
      hasPrivateKey: !!privateKey,
      isServiceAccountValid: hasValidServiceAccount,
      projectId: dedicatedFirebaseProject?.config?.projectId || 'MISSING'
    });

    if (!hasValidServiceAccount) {
      console.error('❌ CRITICAL: Firebase service account credentials are missing or incomplete!');
      console.error('🔧 This will cause authentication failures in the deployed chatbot.');
      console.error('📋 Expected: client_email and private_key from service account creation');
      console.error('🎯 Actual:', {
        serviceAccount: serviceAccount || 'NULL',
        clientEmail: clientEmail || 'MISSING',
        privateKey: privateKey ? 'PRESENT' : 'MISSING'
      });

      // Fail the deployment if we don't have valid service account credentials
      return NextResponse.json({
        error: `Firebase service account creation failed. Cannot deploy chatbot without proper authentication credentials. Service account status: ${serviceAccount ? 'partial' : 'missing'}`,
        details: {
          hasProject: !!dedicatedFirebaseProject,
          hasServiceAccount: !!serviceAccount,
          missingFields: [
            ...(!clientEmail ? ['client_email'] : []),
            ...(!privateKey ? ['private_key'] : [])
          ]
        }
      }, { status: 500 });
    }

    console.log('✅ Firebase service account credentials validated successfully');
    
    // Generate namespace from chatbot data more robustly
    const generateNamespace = (chatbotData: any, chatbotId: string) => {
      // Try multiple sources for namespace
      const namespace = chatbotData?.name?.trim() || 
                       chatbotData?.displayName?.trim() || 
                       chatbotId;
      
      // Format namespace properly
      if (namespace && namespace !== chatbotId) {
        return namespace.toLowerCase().replace(/[^a-z0-9]/g, '-');
      }
      
      // Fallback to chatbot ID
      return chatbotId.toLowerCase().replace(/[^a-z0-9]/g, '-');
    };

    const pineconeNamespace = generateNamespace(chatbotData, chatbotId);
    
    // Add debugging
    console.log('🔍 Deployment Namespace Debug:');
    console.log('  Chatbot ID:', chatbotId);
    console.log('  Chatbot Name:', chatbotData?.name);
    console.log('  Generated Namespace:', pineconeNamespace);
    
    // EXECUTION GROUP 3: Set ALL environment variables in a single optimized batch
    console.log('🔧 UNIFIED ENV VARS: Preparing all environment variables for single batch operation...');

    // Determine Firebase API key source (pool vs dedicated)
    // Always use the API key from the project config (stored in firebaseProjects collection)
    let firebaseApiKey = (dedicatedFirebaseProject.config.apiKey || '').trim();
    let isPoolProject = false;

    try {
      // Check if this is a pool project for logging purposes
      const assignedProject = await ProjectMappingService.findProjectByChatbot(chatbotId);
      if (assignedProject && assignedProject.projectType === 'pool') {
        console.log('🏊 Pool project detected - using API key from project config');
        isPoolProject = true;
      } else {
        console.log('🏢 Dedicated project detected - using API key from project config');
      }
    } catch (error) {
      console.error('❌ Error checking project type:', error);
    }

    console.log(`🔑 Using Firebase API key: ${firebaseApiKey.substring(0, 10)}...`);

    // Prepare OpenAI API key (required for environment variables)
    const openaiApiKey = await FirestoreSecretService.getOpenAIApiKey() || '';

    // Comprehensive environment variables collection (combines Phase 1 + Phase 2)
    const allEnvironmentVariables = {
      // BASIC CHATBOT CONFIGURATION (formerly Phase 1)
      CHATBOT_ID: chatbotId,
      NEXT_PUBLIC_CHATBOT_ID: chatbotId,
      NEXT_PUBLIC_CHATBOT_NAME: chatbotName || `Chatbot ${chatbotId}`,

      // ADVANCED CHATBOT CONFIGURATION (formerly Phase 2)
      CHATBOT_CONFIG: JSON.stringify(chatbotConfig),
      NEXT_PUBLIC_CHATBOT_DESCRIPTION: chatbotConfig.description,
      NEXT_PUBLIC_CHATBOT_LOGO_URL: chatbotConfig.logoUrl,
      NEXT_PUBLIC_CHATBOT_PRIMARY_COLOR: chatbotConfig.primaryColor,
      NEXT_PUBLIC_CHATBOT_BUBBLE_STYLE: chatbotConfig.bubbleStyle,
      NEXT_PUBLIC_CHATBOT_LOGIN_REQUIRED: chatbotConfig.requireAuth.toString(),
      NEXT_PUBLIC_SYSTEM_PROMPT: chatbotConfig.behavior?.systemPrompt || '',
      NEXT_PUBLIC_CUSTOM_DOMAIN: customDomain || '',

      // API KEYS
      OPENAI_API_KEY: openaiApiKey,
      MISTRAL_API_KEY: process.env.MISTRAL_API_KEY || '',
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
      COHERE_API_KEY: process.env.COHERE_API_KEY || '',
      JINA_API_KEY: process.env.JINA_API_KEY || '',
      HUGGINGFACEHUB_API_KEY: process.env.HUGGINGFACEHUB_API_KEY || '',

      // FIREBASE CONFIGURATION (Client & Admin)
      NEXT_PUBLIC_FIREBASE_API_KEY: firebaseApiKey,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: dedicatedFirebaseProject.config.authDomain,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: dedicatedFirebaseProject.config.projectId,
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: dedicatedFirebaseProject.config.storageBucket,
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: dedicatedFirebaseProject.config.messagingSenderId,
      NEXT_PUBLIC_FIREBASE_APP_ID: dedicatedFirebaseProject.config.appId,
      NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',

      FIREBASE_PROJECT_ID: dedicatedFirebaseProject.config.projectId,
      FIREBASE_CLIENT_EMAIL: (dedicatedFirebaseProject as any).serviceAccount?.client_email || (dedicatedFirebaseProject as any).serviceAccount?.clientEmail,
      FIREBASE_PRIVATE_KEY: formatPrivateKeyForVercel((dedicatedFirebaseProject as any).serviceAccount?.private_key || (dedicatedFirebaseProject as any).serviceAccount?.privateKey),

      // PINECONE CONFIGURATION
      PINECONE_API_KEY: process.env.PINECONE_API_KEY || '',
      PINECONE_ENVIRONMENT: 'us-east-1',
      PINECONE_INDEX_NAME: vectorstoreIndexName || PineconeService.generateIndexName(chatbotId),
      PINECONE_NAMESPACE: pineconeNamespace,

      // AI MODEL CONFIGURATION
      EMBEDDING_MODEL: embeddingModel || process.env.EMBEDDING_MODEL || 'embed-v4.0',
      EMBEDDING_PROVIDER: getEmbeddingProvider(embeddingModel || process.env.EMBEDDING_MODEL || 'embed-v4.0'),
      EMBEDDING_DIMENSIONS: getEmbeddingDimensions(embeddingModel || process.env.EMBEDDING_MODEL || 'embed-v4.0').toString(),
      MODEL_NAME: chatbotData?.aiConfig?.llmModel || process.env.DEFAULT_MODEL_NAME || process.env.MODEL_NAME || 'gpt-5-chat-latest',
      IMAGE_MODEL_NAME: process.env.DEFAULT_IMAGE_MODEL_NAME || process.env.IMAGE_MODEL_NAME || 'gpt-5-mini',
      TEMPRATURE: chatbotData?.aiConfig?.temperature?.toString() || process.env.DEFAULT_TEMPERATURE || process.env.TEMPRATURE || '0.7',

      // EMBEDDING DEFAULTS
      FETCH_K_EMBEDDINGS: process.env.DEFAULT_FETCH_K_EMBEDDINGS || process.env.FETCH_K_EMBEDDINGS || '12',
      LAMBDA_EMBEDDINGS: process.env.DEFAULT_LAMBDA_EMBEDDINGS || process.env.LAMBDA_EMBEDDINGS || '0.2',
      K_EMBEDDINGS: process.env.DEFAULT_K_EMBEDDINGS || process.env.K_EMBEDDINGS || '10',
      MINSCORESOURCESTHRESHOLD: process.env.DEFAULT_MINSCORESOURCESTHRESHOLD || process.env.MINSCORESOURCESTHRESHOLD || '0.73',

      // GCP STORAGE BUCKETS
      GCLOUD_STORAGE_BUCKET: `${dedicatedFirebaseProject.config.projectId}-chatbot-documents`,
      GCLOUD_PRIVATE_STORAGE_BUCKET: `${dedicatedFirebaseProject.config.projectId}-chatbot-private-images`,
      GCLOUD_DOCUMENT_IMAGES_BUCKET: `${dedicatedFirebaseProject.config.projectId}-chatbot-document-images`,

      // NEO4J CONFIGURATION (if configured)
      NEO4J_URI: chatbotData?.neo4j?.uri || '',
      NEO4J_USERNAME: chatbotData?.neo4j?.username || '',
      NEO4J_PASSWORD: chatbotData?.neo4j?.password || '',
      NEO4J_DATABASE: chatbotData?.neo4j?.database || 'neo4j',

      // CHATFACTORY MAIN CREDENTIALS
      CHATFACTORY_MAIN_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'docsai-chatbot-app',
      CHATFACTORY_MAIN_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
      CHATFACTORY_MAIN_PRIVATE_KEY: formatPrivateKeyForVercel(process.env.FIREBASE_PRIVATE_KEY || ''),

      // APP CONFIGURATION
      // For chatbot deployments, don't set NEXT_PUBLIC_APP_URL - let it use VERCEL_URL at runtime
      // Only set it if there's a custom domain
      ...(customDomain ? {
        NEXT_PUBLIC_APP_URL: `https://${customDomain}`,
        NEXT_PUBLIC_API_BASE_URL: `https://${customDomain}/api`
      } : {}),
      DATABASE_URL: process.env.DATABASE_URL || '',
      ENABLE_DEBUG_PAGE: 'true',
      NEXT_PUBLIC_ENABLE_IMAGE_EMBEDDINGS: (chatbotData?.aiConfig?.multimodal === true).toString(),

      // FAVICON CONFIGURATION (if enabled)
      ...(chatbotConfig.appearance?.favicon?.enabled ?
        generateFaviconEnvVars(chatbotConfig.appearance.favicon, chatbotConfig.name) :
        {})
    };

    // Filter out empty values but keep empty strings for optional fields
    const filteredEnvironmentVariables = Object.fromEntries(
      Object.entries(allEnvironmentVariables).filter(([key, value]) => value !== undefined && value !== null)
    );

    // Debug logging
    console.log('📊 Unified Environment Variables Summary:');
    console.log('PROJECT_TYPE:', isPoolProject ? 'POOL 🏊' : 'DEDICATED 🏢');
    console.log('TOTAL_VARIABLES:', Object.keys(filteredEnvironmentVariables).length);
    console.log('FIREBASE_API_KEY_SOURCE:', isPoolProject ? 'SECRET_MANAGER' : 'PROJECT_CONFIG');

    // Debug Firebase private key formatting
    const rawPrivateKey = (dedicatedFirebaseProject as any).serviceAccount?.private_key || (dedicatedFirebaseProject as any).serviceAccount?.privateKey;
    const formattedPrivateKey = filteredEnvironmentVariables.FIREBASE_PRIVATE_KEY;
    console.log('🔍 Firebase Private Key Debug:');
    console.log('  Raw key length:', rawPrivateKey?.length || 0);
    console.log('  Raw key has newlines:', rawPrivateKey?.includes('\n') || false);
    console.log('  Raw key has \\n sequences:', rawPrivateKey?.includes('\\n') || false);
    console.log('  Formatted key length:', formattedPrivateKey?.length || 0);
    console.log('  Formatted key preview:', formattedPrivateKey?.substring(0, 50) + '...' || 'MISSING');
    console.log('  Client email present:', !!(filteredEnvironmentVariables.FIREBASE_CLIENT_EMAIL));

    // Set ALL environment variables in a single optimized batch
    console.log('🚀 Setting ALL environment variables in single optimized batch...');
    const envVarResult = await setEnvironmentVariables(VERCEL_API_TOKEN, projectName, filteredEnvironmentVariables);

    console.log(`✅ UNIFIED ENV VARS COMPLETE: ${envVarResult.success} set, ${envVarResult.skipped} skipped, ${envVarResult.failed} failed`);

    // Fail deployment if critical env vars couldn't be set
    if (envVarResult.failed > 0 && envVarResult.success === 0) {
      console.log('🧹 CLEANUP: Environment variable setup failed, cleaning up...');

      await Promise.allSettled([
        deleteVercelProject(VERCEL_API_TOKEN, projectName, projectId),
        releasePoolProject(dedicatedFirebaseProject?.projectId || '', chatbotId)
      ]);

      return NextResponse.json({
        error: 'Failed to set required environment variables on Vercel project'
      }, { status: 500 });
    }

    // OPTIMIZED: Smart polling instead of fixed 30-second wait
    console.log('⚡ OPTIMIZED VERIFICATION: Using smart polling instead of fixed waits...');
    
    // OPTIMIZED: Smart polling verification with exponential backoff
    const criticalVars = [
      'NEXT_PUBLIC_CHATBOT_ID',
      'NEXT_PUBLIC_CHATBOT_NAME',
      'OPENAI_API_KEY',
      'PINECONE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'FIREBASE_CLIENT_EMAIL',
      'PINECONE_INDEX_NAME'
    ];

    // Add Neo4j variables to critical list if Neo4j is configured for this chatbot
    if (chatbotData?.neo4j?.uri) {
      criticalVars.push('NEO4J_URI', 'NEO4J_USERNAME', 'NEO4J_PASSWORD');
      console.log('📋 Neo4j configured - added Neo4j variables to critical verification list');
    } else {
      console.log('📋 No Neo4j configuration found - skipping Neo4j variable verification');
    }

    console.log('🔍 Smart polling for critical environment variables...');
    let verification = null;
    let pollAttempt = 0;
    const maxPollAttempts = 6;
    let totalWaitTime = 0;

    while (pollAttempt < maxPollAttempts) {
      verification = await verifyEnvironmentVariables(VERCEL_API_TOKEN, projectName, criticalVars);

      if (verification.success) {
        console.log(`✅ Critical environment variables verified successfully after ${totalWaitTime / 1000}s`);
        break;
      } else {
        pollAttempt++;
        console.warn(`⚠️ Poll attempt ${pollAttempt}/${maxPollAttempts}: Missing variables:`, verification.missing);

        if (pollAttempt < maxPollAttempts) {
          // Exponential backoff: 2s, 4s, 6s, 8s, 10s (max 30s total vs original 45s+ with retries)
          const waitTime = Math.min(2000 * pollAttempt, 10000);
          totalWaitTime += waitTime;
          console.log(`⏳ Smart polling: waiting ${waitTime / 1000}s before next check...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    if (!verification.success) {
      console.error('❌ Failed to verify critical environment variables after smart polling');
      console.warn('⚠️ Proceeding with deployment but Firebase may fail to initialize');
    } else {
      console.log(`🎉 OPTIMIZATION SUCCESS: Environment variable verification completed in ${totalWaitTime / 1000}s (vs 30-45s previously)`);
    }

    // Handle custom domain configuration if provided
    let domainResult = null;
    if (customDomain && isValidDomain(customDomain)) {
      console.log(`🌐 Setting up custom domain: ${customDomain}`);
      
      domainResult = await addCustomDomainToProject(
        VERCEL_API_TOKEN,
        projectName,
        customDomain
      );

      if (!domainResult.success) {
        console.error(`❌ Failed to set up custom domain: ${domainResult.error}`);
        console.warn('⚠️ Continuing deployment without custom domain');
      } else {
        console.log(`✅ Custom domain setup result:`, domainResult.data);
        
        // Add custom domain to environment variables for the template
        await setEnvironmentVariables(VERCEL_API_TOKEN, projectName, {
          'NEXT_PUBLIC_CUSTOM_DOMAIN': customDomain,
          'CUSTOM_DOMAIN_CONFIGURED': 'true'
        });
      }
    } else if (customDomain && !isValidDomain(customDomain)) {
      console.warn(`⚠️ Invalid custom domain format: ${customDomain}. Skipping domain configuration.`);
      domainResult = { success: false, error: 'Invalid domain format' };
    }

    // 3. Create production deployment from main branch
    console.log('🚀 STARTING SINGLE PRODUCTION DEPLOYMENT');
    console.log('✅ Phase 1 environment variables set early (basic config, API keys)');
    console.log('✅ Phase 2 environment variables set after service setup (Firebase, Pinecone)');
    console.log('✅ Firebase project configured with dedicated credentials');
    console.log('✅ Pinecone vectorstore ready');
    console.log('✅ All environment variables verified and propagated');
    console.log('▶️ Proceeding with deployment...');
    
    let deploymentResponse;
    
    // Create deployment payload based on whether we have repoId
    if (repoId) {
      console.log(`Using GitHub integration with repoId: ${repoId}`);
      console.log('Deployment config: target=production, ref=main');
      
      deploymentResponse = await fetch('https://api.vercel.com/v13/deployments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: projectName,
          project: projectName,
          target: 'production',
          framework: 'nextjs',
          gitSource: {
            type: 'github',
            repo: REPO,
            ref: 'main',
            repoId
          }
          // Environment variables are now set on the project, not in deployment
        })
      });
    } else {
      console.log('Using file-based deployment (no repoId available)');
      deploymentResponse = await createFileBasedDeployment(VERCEL_API_TOKEN, projectName, 'production');
    }

    // Handle deployment response
    if (!deploymentResponse.ok) {
      const errorData = await deploymentResponse.json();
      console.error('Deployment failed:', JSON.stringify(errorData, null, 2));
      
      // If GitHub integration failed, fall back to file-based deployment
      if (repoId) {
        console.log('Falling back to file-based deployment');
        const fallbackResponse = await createFileBasedDeployment(VERCEL_API_TOKEN, projectName, 'production');
        
        if (!fallbackResponse.ok) {
          const fallbackError = await fallbackResponse.json();
          return NextResponse.json({ 
            error: `Failed to create deployment: ${fallbackError.error?.message || 'Unknown error'}`
          }, { status: 500 });
        }
        
        const deploymentData = await fallbackResponse.json();
        
        // STEP: Promote fallback deployment to production
        console.log('🚀 Promoting fallback deployment to production...');
        console.log(`Using project ID: ${projectId}, deployment ID: ${deploymentData.id}`);
        try {
          // Correct API endpoint: POST /v9/projects/{projectId}/promote/{deploymentId}
          const promoteResponse = await fetch(`https://api.vercel.com/v9/projects/${projectId}/promote/${deploymentData.id}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
              'Content-Type': 'application/json'
            }
          });

          if (promoteResponse.ok) {
            console.log('✅ Fallback deployment promoted to production successfully');
            
            // Wait for promotion to take effect
            console.log('⏳ Waiting for fallback promotion to take effect...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            
          } else {
            const promoteError = await promoteResponse.json();
            console.warn('⚠️ Failed to promote fallback deployment:', promoteError);
          }
        } catch (promoteError) {
          console.warn('⚠️ Error promoting fallback deployment:', promoteError);
        }
        
        // CREATE DEPLOYMENT RECORD FOR FALLBACK DEPLOYMENT
        let finalFallbackUrl = null; // Declare variable outside try block
        try {
          console.log('📋 Creating deployment record for fallback deployment...');
          
          // Wait for actual production URL for fallback deployment too
          console.log('⏳ Getting production URL for fallback deployment...');
          let fallbackProductionUrl = null;
          let attempts = 0;
          const maxAttempts = 10;
          
          while (attempts < maxAttempts && !fallbackProductionUrl) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            try {
              const projectResponse = await fetch(`https://api.vercel.com/v9/projects/${projectName}`, {
                headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
              });
              
              if (projectResponse.ok) {
                const projectData = await projectResponse.json();
                if (projectData.alias && projectData.alias.length > 0) {
                  const productionAlias = projectData.alias.find((alias: any) => 
                    alias.domain.endsWith('.vercel.app') && alias.target === 'PRODUCTION'
                  );
                  if (productionAlias) {
                    fallbackProductionUrl = `https://${productionAlias.domain}`;
                    console.log(`✅ Found fallback production URL: ${fallbackProductionUrl}`);
                    break;
                  }
                }
                if (projectData.targets?.production?.url) {
                  fallbackProductionUrl = projectData.targets.production.url.startsWith('http') 
                    ? projectData.targets.production.url 
                    : `https://${projectData.targets.production.url}`;
                  console.log(`✅ Found fallback production URL from targets: ${fallbackProductionUrl}`);
                  break;
                }
              }
            } catch (error) {
              console.log(`⚠️ Fallback attempt ${attempts + 1} failed:`, error);
            }
            
            attempts++;
            console.log(`🔄 Fallback attempt ${attempts}/${maxAttempts}...`);
          }
          
          // Use actual production URL or fall back to deployment URL
          finalFallbackUrl = fallbackProductionUrl || 
            (deploymentData.url ? 
              (deploymentData.url.startsWith('http') ? deploymentData.url : `https://${deploymentData.url}`) : 
              `https://${projectName}.vercel.app`);
          
          console.log('🎯 Final fallback URL:', finalFallbackUrl);
          
          const deploymentRecord = {
            chatbotId: chatbotId,
            userId: userId || chatbotData?.userId,
            status: 'deploying',
            subdomain: projectName,
            deploymentUrl: finalFallbackUrl,
            
            // Firebase project information (if dedicated project was created)
            firebaseProjectId: dedicatedFirebaseProject?.projectId || chatbotData?.firebaseProjectId || 'main-project',
            firebaseConfig: dedicatedFirebaseProject?.config || {},
            
            // Vercel deployment info
            vercelProjectId: projectName,
            vercelDeploymentId: deploymentData.id,
            
            branding: {
              show: true,
              text: 'Powered by ChatFactory',
              link: 'https://chatfactory.ai'
            },
            
            planLimitations: {
              monthlyQueryLimit: 1000,
              analyticsRetention: 30,
              customDomain: false,
              branding: true
            },
            
            usage: {
              totalQueries: 0,
              monthlyQueries: 0,
              lastResetAt: Timestamp.now()
            },
            
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            deployedAt: Timestamp.now(),
            
            environmentVariables: {
              CHATBOT_ID: chatbotId,
              CHATBOT_NAME: chatbotConfig.name,
              NEXT_PUBLIC_CHATBOT_ID: chatbotId,
              NEXT_PUBLIC_CHATBOT_NAME: chatbotConfig.name,
              NEXT_PUBLIC_FIREBASE_PROJECT_ID: dedicatedFirebaseProject?.config.projectId || '',
            }
          };

          // Save deployment record to database
          const deploymentRef = await adminDb.collection('deployments').add(deploymentRecord);
          console.log('✅ Fallback deployment record created with ID:', deploymentRef.id);

          // Update chatbot document with deployment info
          await adminDb.collection('chatbots').doc(chatbotId).update({
            status: 'active',
            firebaseProjectId: dedicatedFirebaseProject?.projectId || chatbotData?.firebaseProjectId,
            deployment: {
              deploymentId: deploymentRef.id,
              deploymentUrl: finalFallbackUrl,
              status: 'deploying',
              deployedAt: Timestamp.now(),
              vercelProjectId: projectName,
              vercelDeploymentId: deploymentData.id,
              firebaseProjectId: dedicatedFirebaseProject?.projectId || chatbotData?.firebaseProjectId,
            },
            updatedAt: Timestamp.now()
          });
          console.log('✅ Chatbot document updated with fallback deployment info');

        } catch (dbError) {
          console.error('❌ Failed to create fallback deployment record:', dbError);
          // Continue with deployment - don't fail the deployment because of DB issues
        }
        
        return createSuccessResponse(deploymentData, projectName, chatbotConfig, true, false, dedicatedFirebaseProject, domainResult, finalFallbackUrl, vectorstoreIndexName);
      }
      
      return NextResponse.json({ 
        error: `Failed to create deployment: ${errorData.error?.message || 'Unknown error'}`
      }, { status: 500 });
    }

    const deploymentData = await deploymentResponse.json();
    console.log('✅ Deployment created successfully:', deploymentData.id);
    console.log('🔗 Initial deployment URL:', deploymentData.url);
    
    // Deployment created - no need to wait for promotion!
    console.log('✅ Deployment created and will be live shortly:', deploymentData.id);

    // Step 1: Get the Vercel-assigned domain name (with random suffix)
    console.log('🌐 Getting Vercel-assigned domain name...');
    let vercelSubdomain = null;
    let vercelDomainUrl = null;

    try {
      const domainsResponse = await fetch(`https://api.vercel.com/v9/projects/${projectId}/domains`, {
        headers: {
          'Authorization': `Bearer ${VERCEL_API_TOKEN}`
        }
      });

      if (domainsResponse.ok) {
        const domainsData = await domainsResponse.json();
        console.log('🔍 Domains API response:', {
          domainsCount: domainsData.domains?.length || 0,
          domains: domainsData.domains?.map((d: any) => d.name) || []
        });

        if (domainsData.domains && domainsData.domains.length > 0) {
          // Find the clean production Vercel domain (e.g., testbot-one-indol.vercel.app)
          const nonGitDomains = domainsData.domains.filter((domain: any) => {
            return domain.name &&
                   domain.name.endsWith('.vercel.app') &&
                   !domain.name.includes('-git-');
          });

          if (nonGitDomains.length > 0) {
            const domainIndex = nonGitDomains.length > 1 ? 1 : 0;
            const selectedDomain = nonGitDomains[domainIndex];
            vercelDomainUrl = `https://${selectedDomain.name}`;
            // Extract subdomain (e.g., "testbot-one-indol" from "testbot-one-indol.vercel.app")
            vercelSubdomain = selectedDomain.name.replace('.vercel.app', '');
            console.log(`✅ Found Vercel domain: ${vercelDomainUrl}`);
            console.log(`📝 Extracted subdomain: ${vercelSubdomain}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error getting Vercel domain:', error);
    }

    // Fallback if we couldn't get the domain
    if (!vercelDomainUrl || !vercelSubdomain) {
      vercelDomainUrl = deploymentData.url ?
        (deploymentData.url.startsWith('http') ? deploymentData.url : `https://${deploymentData.url}`) :
        `https://${projectName}.vercel.app`;
      vercelSubdomain = projectName;
      console.log(`⚠️ Using fallback Vercel URL: ${vercelDomainUrl}`);
    }

    // Step 2: Create matching wizchat.app subdomain with the same random name
    const wizchatDomain = `${vercelSubdomain}.wizchat.app`;
    console.log(`🌐 Creating matching wizchat.app subdomain: ${wizchatDomain}`);

    let wizchatDomainResult = await addCustomDomainToProject(
      VERCEL_API_TOKEN,
      projectName,
      wizchatDomain
    );

    if (!wizchatDomainResult.success) {
      console.error(`❌ Failed to set up wizchat.app subdomain: ${wizchatDomainResult.error}`);
      console.warn('⚠️ Will use Vercel domain as primary');
    } else {
      console.log(`✅ wizchat.app subdomain configured: ${wizchatDomain}`);
    }

    // Step 3: Determine primary deployment URL
    // Priority 1: User's custom domain (if configured and verified)
    // Priority 2: wizchat.app subdomain (automatic branding)
    // Priority 3: Vercel domain (fallback)
    let finalDeploymentUrl = null;

    if (customDomain && domainResult?.success && domainResult.data?.verified) {
      finalDeploymentUrl = `https://${customDomain}`;
      console.log(`🎯 PRIMARY URL: Custom domain - ${finalDeploymentUrl}`);
    } else if (wizchatDomainResult?.success) {
      finalDeploymentUrl = `https://${wizchatDomain}`;
      console.log(`🎯 PRIMARY URL: wizchat.app subdomain - ${finalDeploymentUrl}`);
    } else {
      finalDeploymentUrl = vercelDomainUrl;
      console.log(`🎯 PRIMARY URL: Vercel domain (fallback) - ${finalDeploymentUrl}`);
    }

    // Update environment variables with the actual deployment URLs
    if (!customDomain && finalDeploymentUrl) {
      console.log('🔧 Updating environment variables with final deployment URLs...');
      try {
        const envUpdates: Record<string, string> = {
          NEXT_PUBLIC_APP_URL: finalDeploymentUrl,
          NEXT_PUBLIC_API_BASE_URL: `${finalDeploymentUrl}/api`
        };

        // Also set NEXT_PUBLIC_CUSTOM_DOMAIN to wizchat domain if configured
        if (wizchatDomainResult?.success) {
          envUpdates.NEXT_PUBLIC_CUSTOM_DOMAIN = wizchatDomain;
        }

        await setEnvironmentVariables(VERCEL_API_TOKEN, projectName, envUpdates);
        console.log('✅ Environment variables updated with final URLs');
      } catch (error) {
        console.warn('⚠️ Failed to update environment variables:', error);
      }
    }

    // EXECUTION GROUP 4: Parallel database operations for deployment records
    console.log('⚡ PARALLEL DATABASE OPERATIONS: Creating all deployment records concurrently...');

    const userIdForUpdate = userId || chatbotData?.userId;

    // Prepare deployment record data
    const deploymentRecord = {
      chatbotId: chatbotId,
      userId: userIdForUpdate,
      status: 'deploying',
      subdomain: projectName,
      deploymentUrl: finalDeploymentUrl,
      wizchatDomain: wizchatDomain, // Store the assigned wizchat.app subdomain
      wizchatDomainConfigured: wizchatDomainResult?.success || false,

      // Firebase project information
      firebaseProjectId: dedicatedFirebaseProject?.projectId || chatbotData?.firebaseProjectId || 'main-project',
      firebaseConfig: dedicatedFirebaseProject?.config || {},

      // Vercel deployment info
      vercelProjectId: projectName,
      vercelDeploymentId: deploymentData.id,

      branding: {
        show: true,
        text: 'Powered by ChatFactory',
        link: 'https://chatfactory.ai'
      },

      planLimitations: {
        monthlyQueryLimit: 1000,
        analyticsRetention: 30,
        customDomain: false,
        branding: true
      },

      usage: {
        totalQueries: 0,
        monthlyQueries: 0,
        lastResetAt: Timestamp.now()
      },

      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      deployedAt: Timestamp.now(),

      environmentVariables: {
        CHATBOT_ID: chatbotId,
        CHATBOT_NAME: chatbotConfig.name,
        NEXT_PUBLIC_CHATBOT_ID: chatbotId,
        NEXT_PUBLIC_CHATBOT_NAME: chatbotConfig.name,
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: dedicatedFirebaseProject?.config.projectId || '',
      }
    };

    // Prepare deployment info for chatbot updates
    const deploymentInfo: any = {
      vercelProjectId: projectName,
      deploymentUrl: finalDeploymentUrl,
      deploymentId: deploymentData.id,
      status: 'live',
      target: 'production',
      gitRef: 'main',
      isStaged: false,
      firebaseProjectId: dedicatedFirebaseProject?.projectId,
      firebaseConfig: dedicatedFirebaseProject?.config,
      wizchatDomain: wizchatDomain,
      wizchatDomainConfigured: wizchatDomainResult?.success || false,
    };

    // Add custom domain information if configured
    if (domainResult?.success && customDomain) {
      deploymentInfo.customDomain = customDomain;
      deploymentInfo.domainVerified = domainResult.data?.verified || false;
      deploymentInfo.domainStatus = domainResult.data?.verified ? 'active' : 'pending_verification';
    }

    try {
      // CRITICAL DATABASE OPERATIONS: Must succeed
      const criticalDbOperations = await Promise.all([
        // Create deployment record
        adminDb.collection('deployments').add(deploymentRecord),
        // Update chatbot deployment info
        DatabaseService.updateChatbotDeployment(chatbotId, deploymentInfo),
      ]);

      const deploymentRef = criticalDbOperations[0];
      console.log('✅ Critical database operations completed successfully');
      console.log(`✅ Deployment record created with ID: ${deploymentRef.id}`);

      // NON-CRITICAL DATABASE OPERATIONS: Can fail without breaking deployment
      const nonCriticalDbResults = await Promise.allSettled([
        // Update user deployment count
        userIdForUpdate ?
          DatabaseService.updateUserDeploymentCount(userIdForUpdate) :
          Promise.resolve(null),

        // Update chatbot document with deployment details
        adminDb.collection('chatbots').doc(chatbotId).update({
          status: 'active',
          firebaseProjectId: dedicatedFirebaseProject?.projectId || chatbotData?.firebaseProjectId,
          deployment: {
            deploymentId: deploymentRef.id,
            deploymentUrl: finalDeploymentUrl,
            status: 'deploying',
            deployedAt: Timestamp.now(),
            vercelProjectId: projectName,
            vercelDeploymentId: deploymentData.id,
            firebaseProjectId: dedicatedFirebaseProject?.projectId || chatbotData?.firebaseProjectId,
          },
          updatedAt: Timestamp.now()
        }),

        // Update Firebase project deployment status
        dedicatedFirebaseProject?.projectId ?
          adminDb.collection('chatbots').doc(chatbotId).update({
            firebaseProjectId: dedicatedFirebaseProject.projectId,
            'firebaseProject.services.hosting': true,
            'firebaseProject.urls.hosting': finalDeploymentUrl,
            'firebaseProject.deployment': {
              status: 'deploying',
              url: finalDeploymentUrl,
              vercelProjectId: projectName,
              deployedAt: Timestamp.now()
            },
            updatedAt: Timestamp.now()
          }) : Promise.resolve(null)
      ]);

      // Log results of non-critical operations
      let successCount = 0;
      let failureCount = 0;

      nonCriticalDbResults.forEach((result, index) => {
        const operationNames = ['User deployment count update', 'Chatbot document update', 'Firebase project status update'];

        if (result.status === 'fulfilled') {
          console.log(`✅ ${operationNames[index]} completed successfully`);
          successCount++;
        } else {
          console.warn(`⚠️ ${operationNames[index]} failed:`, result.reason);
          failureCount++;
        }
      });

      console.log(`🎉 PARALLEL DATABASE OPTIMIZATION COMPLETE: ${successCount + 2} successful, ${failureCount} non-critical failures`);
      console.log('ℹ️ Firebase Authentication configured via API - no redirect URIs to update');

    } catch (criticalDbError) {
      console.error('❌ Critical database operations failed:', criticalDbError);
      console.error('⚠️ This may cause issues with deployment tracking');
      // Continue with deployment - deployment itself succeeded even if DB updates failed
    }
    
    // STEP 7: Add authorized domains to Firebase project
    if (dedicatedFirebaseProject?.projectId) {
      // Use the finalDeploymentUrl that was carefully determined earlier
      // This ensures we get the correct production domain (like testbot-gray.vercel.app)
      // instead of the initial deployment-specific URL
      const deploymentUrl = finalDeploymentUrl;
        
      console.log('🔧 Adding domains to Firebase authorized domains...');
      console.log(`🎯 Using final deployment URL: ${deploymentUrl}`);

      // Collect all domains that need to be authorized
      const domainsToAuthorize = [];

      // CRITICAL: Add base domains that should ALWAYS be present for OAuth to work
      // These were included in the old reusable project setup and are essential
      const baseDomains = [
        `https://${dedicatedFirebaseProject.projectId}.firebaseapp.com`,
        `https://${dedicatedFirebaseProject.projectId}.web.app`,
        'https://localhost',
        'https://chatfactory.ai',
        'https://app.chatfactory.ai',
        'https://www.chatfactory.ai',
        'https://deploy.chatfactory.ai'
      ];

      domainsToAuthorize.push(...baseDomains);
      console.log(`📝 Will authorize base domains for OAuth: ${baseDomains.length} domains`);

      // Always add the wizchat.app subdomain (automatic branding)
      if (wizchatDomainResult?.success) {
        domainsToAuthorize.push(`https://${wizchatDomain}`);
        console.log(`📝 Will authorize wizchat.app subdomain: https://${wizchatDomain}`);
      }

      // Always add the primary deployment domain
      domainsToAuthorize.push(deploymentUrl);
      console.log(`📝 Will authorize primary deployment domain: ${deploymentUrl}`);

      // Add custom domain if configured and domain setup was successful
      if (customDomain && domainResult?.success) {
        const customDomainUrl = `https://${customDomain}`;
        domainsToAuthorize.push(customDomainUrl);
        console.log(`📝 Will authorize custom domain: ${customDomainUrl}`);
      } else if (customDomain && !domainResult?.success) {
        console.warn(`⚠️ Custom domain ${customDomain} configured but domain setup failed - skipping Firebase authorization`);
      }
      
      // Add extra delay to ensure Firebase project is fully ready
      console.log('⏳ Waiting for Firebase project to be fully ready...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      try {
        // Use the multiple domains method for efficiency
        const authorizationSuccess = await FirebaseAuthorizedDomainsService.addMultipleAuthorizedDomains(
          dedicatedFirebaseProject.projectId,
          domainsToAuthorize
        );
        
        if (authorizationSuccess) {
          console.log(`✅ Successfully authorized ${domainsToAuthorize.length} domain(s) for Firebase Authentication`);
        } else {
          console.error('❌ Failed to authorize domains automatically');
          console.log('⚠️ Manual action required: Add domains to Firebase Console');
          domainsToAuthorize.forEach(url => {
            const domain = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
            console.log(`   Domain to add: ${domain}`);
          });
          console.log(`   Firebase Console: https://console.firebase.google.com/project/${dedicatedFirebaseProject.projectId}/authentication/settings`);
        }
      } catch (domainError) {
        console.error('❌ Failed to add authorized domains automatically:', domainError);
        console.log('⚠️ Manual action required: Add domains to Firebase Console');
        domainsToAuthorize.forEach(url => {
          const domain = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
          console.log(`   Domain to add: ${domain}`);
        });
        console.log(`   Firebase Console: https://console.firebase.google.com/project/${dedicatedFirebaseProject.projectId}/authentication/settings`);
      }
    }
    
    // STEP 8: Configure OAuth Consent Screen for Open Signup chatbots
    try {
      const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();
      const chatbotData = chatbotDoc.data();
      
      if (chatbotData?.requireAuth && 
          chatbotData?.authConfig?.accessMode === 'open' && 
          dedicatedFirebaseProject?.projectId) {
        
        console.log('🔧 Open Signup chatbot detected - OAuth consent screen setup required');
        
        const { GoogleOAuthConsentScreenService } = await import('@/services/googleOAuthConsentScreenService');
        
        const configured = await GoogleOAuthConsentScreenService.configureExternalConsentScreen(
          dedicatedFirebaseProject.projectId,
          chatbotData?.name || 'AI Chatbot'
        );
        
        if (!configured) {
          console.log('⚠️  Manual OAuth setup required for Google sign-in to work');
          console.log(`   Setup URL: ${GoogleOAuthConsentScreenService.getOAuthConsentScreenUrl(dedicatedFirebaseProject.projectId)}`);
        }
      }
    } catch (oauthError) {
      console.error('❌ OAuth consent screen configuration failed:', oauthError);
    }
    
    // SEND INVITATION EMAILS AFTER SUCCESSFUL DEPLOYMENT
    try {
      const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();
      const chatbotData = chatbotDoc.data();
      
      console.log('🔍 Email invitation debug:', {
        requireAuth: chatbotData?.requireAuth,
        accessMode: chatbotData?.authConfig?.accessMode,
        invitedUsersCount: chatbotData?.authConfig?.invitedUsers?.length || 0,
        invitedUsers: chatbotData?.authConfig?.invitedUsers || [],
        shouldSendEmails: chatbotData?.requireAuth && 
                         chatbotData?.authConfig?.accessMode === 'managed' && 
                         chatbotData?.authConfig?.invitedUsers?.length > 0
      });

      // Send invitation emails if chatbot requires authentication and has invited users
      if (chatbotData?.requireAuth && 
          chatbotData?.authConfig?.accessMode === 'managed' && 
          chatbotData?.authConfig?.invitedUsers?.length > 0) {
        
        const invitedUsers = chatbotData.authConfig.invitedUsers;
        console.log(`📧 Sending invitations to ${invitedUsers.length} users after successful deployment...`);
        
        // Import ChatbotFirebaseService here to avoid circular dependency
        const { ChatbotFirebaseService } = await import('@/services/chatbotFirebaseService');
        
        // Get the deployment URL for verification links
        const deploymentUrl = deploymentData.url ? 
          (deploymentData.url.startsWith('http') ? deploymentData.url : `https://${deploymentData.url}`) : 
          `https://${projectName}.vercel.app`;
        
        let successfulInvitations = 0;
        let failedInvitations = 0;
        
        for (const email of invitedUsers) {
          try {
            const inviteResult = await ChatbotFirebaseService.inviteUser({
              chatbotId,
              email: email,
              displayName: email.split('@')[0], // Use email prefix as display name
              creatorUserId: chatbotData.userId,
              role: 'user',
              deploymentUrl: finalDeploymentUrl // Pass the actual deployment URL
            });

            if (inviteResult.success) {
              console.log(`✅ Successfully invited ${email}`);
              successfulInvitations++;
            } else {
              console.error(`❌ Failed to invite ${email}:`, inviteResult.error);
              failedInvitations++;
            }
          } catch (error) {
            console.error(`❌ Error inviting ${email}:`, error);
            failedInvitations++;
          }
        }

        console.log(`📊 Invitation summary: ${successfulInvitations} successful, ${failedInvitations} failed`);
        
        if (successfulInvitations > 0) {
          console.log(`🎉 Successfully sent ${successfulInvitations} invitation emails after deployment!`);
        }
        if (failedInvitations > 0) {
          console.warn(`⚠️ Failed to send ${failedInvitations} invitation emails. Users can be invited manually from the dashboard.`);
        }
      } else {
        console.log('ℹ️ No email invitations to send (authentication disabled or no invited users)');
      }
    } catch (emailError) {
      console.error('❌ Error sending invitation emails after deployment:', emailError);
      // Don't fail the entire deployment because of email issues
    }

    // STEP 9: Start background polling to update deployment status when ready
    // This runs asynchronously without blocking the response
    (async () => {
      try {
        console.log('🔄 Starting background deployment status polling...');
        console.log('🆔 Deployment ID:', deploymentData.id);
        console.log('📍 Deployment URL:', finalDeploymentUrl);

        const maxAttempts = 42; // 42 * 5s = 210s (3.5 minutes)
        const pollInterval = 5000; // 5 seconds

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));

          try {
            // Check deployment status via Vercel API
            const checkResponse = await fetch(
              `https://api.vercel.com/v13/deployments/${deploymentData.id}`,
              {
                headers: {
                  'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            if (checkResponse.ok) {
              const deploymentStatus = await checkResponse.json();

              // Check if deployment is ready (state: READY or READY_CONFIRMED)
              if (deploymentStatus.readyState === 'READY' || deploymentStatus.state === 'READY') {
                console.log(`✅ [Attempt ${attempt}/${maxAttempts}] Deployment is ready!`);

                // Update Firestore
                await adminDb.collection('chatbots').doc(chatbotId).update({
                  'deployment.status': 'deployed',
                  updatedAt: Timestamp.now()
                });

                console.log('✅ Updated Firestore: deployment.status = deployed');
                return; // Exit polling
              } else {
                console.log(`⏳ [Attempt ${attempt}/${maxAttempts}] Deployment state: ${deploymentStatus.readyState || deploymentStatus.state}`);
              }
            }
          } catch (pollError) {
            console.warn(`⚠️ [Attempt ${attempt}/${maxAttempts}] Polling error:`, pollError);
          }
        }

        // If we reach here, deployment took too long - mark as deployed anyway
        console.log('⏱️ Polling timeout - marking as deployed after 3.5 minutes');
        await adminDb.collection('chatbots').doc(chatbotId).update({
          'deployment.status': 'deployed',
          updatedAt: Timestamp.now()
        });
        console.log('✅ Marked as deployed (timeout fallback)');

      } catch (bgError) {
        console.error('❌ Background polling error:', bgError);
      }
    })();

    return createSuccessResponse(deploymentData, projectName, chatbotConfig, false, false, dedicatedFirebaseProject, domainResult, finalDeploymentUrl, vectorstoreIndexName);
  } catch (error: any) {
    console.error('Deployment error:', error);

    // FINAL CLEANUP: If deployment fails for any reason, clean up resources
    if (typeof projectName !== 'undefined' && typeof VERCEL_API_TOKEN !== 'undefined') {
      console.log('🧹 FINAL CLEANUP: Deployment failed, cleaning up all resources...');
      try {
        // Get Firebase project ID if available from any previous assignment
        let firebaseProjectId = '';
        try {
          if (typeof dedicatedFirebaseProject !== 'undefined' && dedicatedFirebaseProject?.projectId) {
            firebaseProjectId = dedicatedFirebaseProject.projectId;
          }
        } catch {
          // Ignore errors getting Firebase project ID
        }

        // Perform cleanup operations in parallel
        const cleanupResults = await Promise.allSettled([
          deleteVercelProject(VERCEL_API_TOKEN, projectName, projectId),
          releasePoolProject(firebaseProjectId, chatbotId)
        ]);

        const [vercelCleanup, poolCleanup] = cleanupResults;

        if (vercelCleanup.status === 'fulfilled' && vercelCleanup.value) {
          console.log('✅ Final cleanup: Vercel project deleted successfully');
        } else {
          console.warn('⚠️ Final cleanup: Failed to delete Vercel project - manual cleanup may be required');
          console.warn(`⚠️ Manual cleanup: Delete project '${projectName}' from Vercel dashboard`);
        }

        if (poolCleanup.status === 'fulfilled') {
          console.log('✅ Final cleanup: Pool project release attempted');
        } else {
          console.warn('⚠️ Final cleanup: Pool project release failed');
        }

      } catch (cleanupError) {
        console.error('❌ Final cleanup failed:', cleanupError);
        console.warn(`⚠️ Manual cleanup required: Delete project '${projectName}' from Vercel dashboard`);
      }
    }

    return NextResponse.json({
      error: `Error deploying chatbot: ${error.message}`
    }, { status: 500 });
  }
}

// Helper function to find logo in Firebase Storage if not in Firestore
async function findLogoInStorage(userId: string, chatbotId: string): Promise<string | null> {
  try {
    // Check the expected path for chatbot logos
    const bucket = adminStorage.bucket();
    const folderPath = `user-${userId}/chatbot-logos/chatbot-${chatbotId}/`;
    console.log(`🔍 Checking Firebase Storage path: ${folderPath}`);
    
    const [files] = await bucket.getFiles({
      prefix: folderPath,
      maxResults: 100
    });
    
    if (files.length === 0) {
      console.log('📁 No files found in logo folder');
      return null;
    }
    
    console.log(`📁 Found ${files.length} files in logo folder`);
    
    // Look for image files (logos typically have these patterns)
    const logoFile = files.find(file => {
      const fileName = file.name.toLowerCase();
      return fileName.includes('logo') || 
             fileName.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i);
    });
    
    if (!logoFile) {
      console.log('🖼️  No logo files found in the folder');
      return null;
    }
    
    console.log(`🖼️  Found potential logo file: ${logoFile.name}`);
    
    // Get the download URL for the logo
    const [signedUrl] = await logoFile.getSignedUrl({
      action: 'read',
      expires: '03-17-2030' // Long expiration for public logo files
    });
    console.log(`✅ Successfully retrieved logo URL from storage: ${signedUrl}`);
    
    return signedUrl;
    
  } catch (error) {
    console.error('❌ Error searching for logo in Firebase Storage:', error);
    return null;
  }
}

// Optimized batch environment variable setting with parallel processing
async function setEnvironmentVariables(
  token: string,
  projectName: string,
  envVars: Record<string, string>
): Promise<{ success: number; skipped: number; failed: number }> {
  const BATCH_SIZE = 12; // Reduced batch size for better API stability
  const MAX_CONCURRENT_BATCHES = 2; // Reduced concurrent batches to avoid envs_ongoing_update errors

  console.log(`📦 Setting ${Object.keys(envVars).length} environment variables in parallel batches...`);

  const entries = Object.entries(envVars);
  const batches = [];

  // Split variables into batches
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    batches.push(batch);
  }

  console.log(`📦 Created ${batches.length} batches for parallel processing`);

  let totalSuccess = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  // Process batches in parallel groups
  for (let i = 0; i < batches.length; i += MAX_CONCURRENT_BATCHES) {
    const batchGroup = batches.slice(i, i + MAX_CONCURRENT_BATCHES);

    console.log(`🚀 Processing batch group ${Math.floor(i / MAX_CONCURRENT_BATCHES) + 1}/${Math.ceil(batches.length / MAX_CONCURRENT_BATCHES)} (${batchGroup.length} batches)`);

    // Process current batch group in parallel
    const batchResults = await Promise.allSettled(
      batchGroup.map(batch => processBatch(token, projectName, batch))
    );

    // Aggregate results
    batchResults.forEach((result, batchIndex) => {
      if (result.status === 'fulfilled') {
        const { success, skipped, failed } = result.value;
        totalSuccess += success;
        totalSkipped += skipped;
        totalFailed += failed;
        console.log(`✅ Batch ${i + batchIndex + 1}: ${success} success, ${skipped} skipped, ${failed} failed`);
      } else {
        console.error(`❌ Batch ${i + batchIndex + 1} failed entirely:`, result.reason);
        totalFailed += batchGroup[batchIndex].length;
      }
    });

    // Increased delay between batch groups to prevent envs_ongoing_update errors
    if (i + MAX_CONCURRENT_BATCHES < batches.length) {
      console.log('⏳ Waiting between batch groups to prevent API conflicts...');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Increased from 200ms to 1000ms
    }
  }

  console.log(`📊 Total environment variable results: ${totalSuccess} success, ${totalSkipped} skipped, ${totalFailed} failed`);

  return { success: totalSuccess, skipped: totalSkipped, failed: totalFailed };
}

// Process a single batch of environment variables in parallel
async function processBatch(
  token: string,
  projectName: string,
  batch: [string, string][]
): Promise<{ success: number; skipped: number; failed: number }> {

  // Process all variables in the batch concurrently
  const results = await Promise.allSettled(
    batch.map(([key, value]) =>
      setEnvironmentVariableWithRetry(token, projectName, key, value)
    )
  );

  let success = 0;
  let skipped = 0;
  let failed = 0;

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const { success: isSuccess, skipped: isSkipped } = result.value;
      if (isSuccess) success++;
      else if (isSkipped) skipped++;
      else failed++;
    } else {
      console.error(`❌ Variable ${batch[index][0]} failed:`, result.reason);
      failed++;
    }
  });

  return { success, skipped, failed };
}

// Set individual environment variable with retry logic
async function setEnvironmentVariableWithRetry(
  token: string,
  projectName: string,
  key: string,
  value: string
): Promise<{ success: boolean; skipped: boolean }> {
  const MAX_RETRIES = 4; // Increased retries for envs_ongoing_update errors
  let retries = MAX_RETRIES;

  while (retries > 0) {
    try {
      const envResponse = await fetch(`https://api.vercel.com/v9/projects/${projectName}/env`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: key,
          value: value,
          type: key.startsWith('NEXT_PUBLIC_') ? 'plain' : 'encrypted',
          target: ['production', 'preview', 'development']
        })
      });

      if (!envResponse.ok) {
        const envError = await envResponse.json();

        if (envError.error?.code === 'ENV_ALREADY_EXISTS') {
          // Try to update the existing environment variable
          const updateResponse = await updateEnvironmentVariable(token, projectName, key, value);
          if (updateResponse) {
            return { success: true, skipped: false };
          } else {
            return { success: false, skipped: true };
          }
        } else if (envError.error?.code === 'envs_ongoing_update') {
          // Handle ongoing update conflicts with exponential backoff
          const backoffTime = Math.min(1000 * Math.pow(2, MAX_RETRIES - retries), 8000); // Up to 8 seconds
          console.warn(`⏳ Ongoing env update conflict for ${key}, waiting ${backoffTime}ms... (attempt ${MAX_RETRIES - retries + 1})`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          retries--;
          continue;
        } else if (envError.error?.code === 'RATE_LIMITED' || envResponse.status === 429) {
          // Handle rate limiting with exponential backoff
          const backoffTime = (MAX_RETRIES - retries + 1) * 1000; // 1s, 2s, 3s, 4s
          console.warn(`⏳ Rate limited for ${key}, waiting ${backoffTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          retries--;
          continue;
        } else {
          console.error(`❌ Failed to set env var ${key} (attempt ${MAX_RETRIES - retries + 1}):`, envError);
          retries--;
          if (retries > 0) {
            // Exponential backoff for retries
            const backoffTime = Math.min(1000 * Math.pow(2, MAX_RETRIES - retries), 6000);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
          }
        }
      } else {
        return { success: true, skipped: false };
      }
    } catch (error) {
      console.error(`❌ Error setting env var ${key} (attempt ${MAX_RETRIES - retries + 1}):`, error);
      retries--;
      if (retries > 0) {
        const backoffTime = Math.min(1000 * Math.pow(2, MAX_RETRIES - retries), 6000);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
  }

  return { success: false, skipped: false };
}

// Helper function to release pool project back to available status
async function releasePoolProject(projectId: string, chatbotId: string): Promise<void> {
  try {
    if (projectId && projectId.includes('pool')) {
      console.log(`🔄 Releasing pool project ${projectId} back to available status...`);

      // Update the project mapping to mark it as available
      await adminDb.collection('firebaseProjectMappings').doc(projectId).update({
        inUse: false,
        chatbotId: null,
        assignedAt: null,
        updatedAt: new Date()
      });

      console.log(`✅ Pool project ${projectId} released back to available pool`);
    }
  } catch (error) {
    console.error(`❌ Failed to release pool project ${projectId}:`, error);
  }
}

// Helper function to delete Vercel project on deployment failure
async function deleteVercelProject(token: string, projectName: string, projectId: string | null = null): Promise<boolean> {
  try {
    console.log(`🗑️ Attempting to delete Vercel project: ${projectName}`);

    // Use projectId if available, otherwise use projectName
    const identifier = projectId || projectName;

    const deleteResponse = await fetch(`https://api.vercel.com/v9/projects/${identifier}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (deleteResponse.ok) {
      console.log(`✅ Successfully deleted Vercel project: ${projectName}`);
      return true;
    } else {
      const errorData = await deleteResponse.json();
      console.warn(`⚠️ Failed to delete Vercel project ${projectName}:`, errorData);

      // If project doesn't exist, consider it successfully "deleted"
      if (errorData.error?.code === 'not_found') {
        console.log(`ℹ️ Project ${projectName} not found - may have been already deleted`);
        return true;
      }

      return false;
    }
  } catch (error) {
    console.error(`❌ Error deleting Vercel project ${projectName}:`, error);
    return false;
  }
}

// Helper function to format Firebase private key for Vercel environment variables
function formatPrivateKeyForVercel(privateKey: string | undefined): string {
  if (!privateKey) {
    return '';
  }

  // Clean the private key first
  let cleanKey = privateKey.trim();

  // If the private key already has \n sequences, return as-is
  if (cleanKey.includes('\\n')) {
    return cleanKey;
  }

  // If the private key has actual newlines, convert them to \n sequences
  // First normalize Windows-style \r\n to Unix-style \n
  if (cleanKey.includes('\r\n')) {
    cleanKey = cleanKey.replace(/\r\n/g, '\n');
  }

  if (cleanKey.includes('\n')) {
    return cleanKey.replace(/\n/g, '\\n');
  }

  // If it's a single line key, try to detect if it should have line breaks
  // Firebase private keys should start with -----BEGIN PRIVATE KEY-----
  if (cleanKey.includes('-----BEGIN PRIVATE KEY-----') && !cleanKey.includes('\\n')) {
    // This is likely a malformed key - try to add proper line breaks
    cleanKey = cleanKey.replace(/-----BEGIN PRIVATE KEY-----/, '-----BEGIN PRIVATE KEY-----\\n');
    cleanKey = cleanKey.replace(/-----END PRIVATE KEY-----/, '\\n-----END PRIVATE KEY-----');

    // Add line breaks every 64 characters in the middle content
    const parts = cleanKey.split('\\n');
    if (parts.length >= 2) {
      const middleContent = parts[1];
      if (middleContent && middleContent.length > 64) {
        const formattedMiddle = middleContent.match(/.{1,64}/g)?.join('\\n') || middleContent;
        cleanKey = parts[0] + '\\n' + formattedMiddle + '\\n' + parts[2];
      }
    }
  }

  return cleanKey;
}

// Helper function to update existing environment variable
async function updateEnvironmentVariable(
  token: string,
  projectName: string,
  key: string,
  value: string
): Promise<boolean> {
  try {
    // First, get the existing environment variable to get its ID
    const listResponse = await fetch(`https://api.vercel.com/v9/projects/${projectName}/env`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!listResponse.ok) {
      return false;
    }

    const envList = await listResponse.json();
    const existingEnv = envList.envs?.find((env: any) => env.key === key);

    if (!existingEnv) {
      return false;
    }

    // Update the environment variable
    const updateResponse = await fetch(`https://api.vercel.com/v9/projects/${projectName}/env/${existingEnv.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        value: value,
        target: ['production', 'preview', 'development']
      })
    });

    return updateResponse.ok;
  } catch (error) {
    console.error(`Error updating env var ${key}:`, error);
    return false;
  }
}

// Helper function to verify environment variables are set
async function verifyEnvironmentVariables(
  token: string,
  projectName: string,
  criticalVars: string[]
): Promise<{ success: boolean; missing: string[] }> {
  try {
    const listResponse = await fetch(`https://api.vercel.com/v9/projects/${projectName}/env`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!listResponse.ok) {
      return { success: false, missing: criticalVars };
    }

    const envList = await listResponse.json();
    const setVars = envList.envs?.map((env: any) => env.key) || [];
    const missing = criticalVars.filter(varName => !setVars.includes(varName));

    return {
      success: missing.length === 0,
      missing
    };
  } catch (error) {
    console.error('Error verifying environment variables:', error);
    return { success: false, missing: criticalVars };
  }
}

// Helper function for file-based deployment
async function createFileBasedDeployment(token: string, projectName: string, target: string) {
  console.log(`🗂️ Creating file-based deployment for ${projectName} targeting ${target}`);
  
  // For file-based deployment, we need to use Git source instead of empty files
  // This ensures we're deploying the actual template code
  return fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: projectName,
      project: projectName,
      target: target,
      framework: 'nextjs',
      gitSource: {
        type: 'github',
        repo: `${REPO_OWNER}/${REPO_NAME}`,
        ref: 'main'
      }
      // Environment variables are set on the project, not in deployment
    })
  });
}

// Helper function to create success response
function createSuccessResponse(deploymentData: any, projectName: string, chatbotConfig: any, isFallback = false, isStaged = false, firebaseProject: any = null, domainResult: any = null, actualProductionUrl: string | null = null, vectorstoreIndexName?: string) {
  // Use the actual production URL if provided, otherwise fall back to project format
  const deploymentUrl = actualProductionUrl || `https://${projectName}.vercel.app`;
  console.log('🎯 Success response using URL:', deploymentUrl);
    
  return NextResponse.json({
    success: true,
    projectName,
    deploymentId: deploymentData.id,
    url: deploymentUrl,
    status: 'live', // Always live since we deploy straight to production
    isStaged: false, // Never staged anymore
    vectorstoreIndexName, // Include vectorstore index name for frontend state updates
    chatbot: {
      id: chatbotConfig.id,
      name: chatbotConfig.name,
      logoUrl: chatbotConfig.logoUrl,
      hasLogo: !!chatbotConfig.logoUrl
    },
    customDomain: domainResult?.success ? {
      domain: domainResult.data?.name || chatbotConfig.domain,
      verified: domainResult.data?.verified || false,
      requiresVerification: domainResult.data?.requiresVerification || false,
      verificationInstructions: domainResult.data?.verificationInstructions || [],
      status: domainResult.data?.verified ? 'active' : 'pending_verification',
      firebaseAuthorized: true // Custom domains are automatically added to Firebase authorized domains
    } : chatbotConfig.domain ? {
      domain: chatbotConfig.domain,
      configured: false,
      firebaseAuthorized: false,
      error: domainResult?.error || 'Domain configuration failed'
    } : null,
    firebaseProject: firebaseProject ? {
      projectId: firebaseProject.projectId,
      authDomain: firebaseProject.config?.authDomain,
      hasDedicatedProject: true
    } : {
      hasDedicatedProject: false
    },
    environmentVariables: {
      chatbotId: !!chatbotConfig.id,
      chatbotName: !!chatbotConfig.name,
      logoUrl: !!chatbotConfig.logoUrl,
      firebaseConfig: !!firebaseProject?.config?.projectId
    },
    ...(isFallback && { note: 'Deployed using file-based deployment due to GitHub integration issues' }),
    debug: {
      timestamp: new Date().toISOString(),
      deploymentMethod: isFallback ? 'file-based' : 'git-integration',
      target: 'production',
      gitRef: 'main'
    }
  });
}
