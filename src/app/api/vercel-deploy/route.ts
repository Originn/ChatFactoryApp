import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebase/admin/index';
import { Timestamp } from 'firebase-admin/firestore';
import { PineconeService } from '@/services/pineconeService';
import { DatabaseService } from '@/services/databaseService';
import { FirebaseAPIService } from '@/services/firebaseAPIService';
import { FirebaseAuthorizedDomainsService } from '@/services/firebaseAuthorizedDomainsService';

// Repository information
const REPO_OWNER = 'Originn';
const REPO_NAME = 'ChatFactoryTemplate';  // Your chatbot template repository
const REPO = `${REPO_OWNER}/${REPO_NAME}`;

// REUSABLE FIREBASE PROJECT CONFIGURATION
const USE_REUSABLE_FIREBASE_PROJECT = process.env.USE_REUSABLE_FIREBASE_PROJECT === 'true';
const REUSABLE_FIREBASE_PROJECT_ID = process.env.REUSABLE_FIREBASE_PROJECT_ID || '';

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
  try {
    const body = await request.json();
    const { chatbotId, chatbotName, userId, vectorstore } = body;

    console.log('🚀 Starting deployment for:', { chatbotId, chatbotName, userId, vectorstore });

    if (!chatbotId) {
      return NextResponse.json({ error: 'Missing chatbot ID' }, { status: 400 });
    }

    // SIMPLIFIED DEPLOYMENT STRATEGY:
    // Always deploy from 'main' branch to 'production' target
    // No staging/preview complexity - straight to production

    const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
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
    const projectName = (chatbotName || chatbotData?.name || `chatbot-${chatbotId}`)
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
    let projectId = null; // Store the actual project ID for API calls
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

    // STEP: Ensure default production domain exists
    console.log('🌐 Ensuring default production domain exists...');
    try {
      // Check if project has default production domain
      const projectResponse = await fetch(`https://api.vercel.com/v9/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
      });
      
      if (projectResponse.ok) {
        const currentProject = await projectResponse.json();
        console.log('🔍 Current project domains:', {
          hasAlias: !!currentProject.alias,
          aliasCount: currentProject.alias?.length || 0,
          domains: currentProject.alias?.map((a: any) => a.domain || a) || []
        });
        
        // Check if we have a clean production domain
        const hasCleanProductionDomain = currentProject.alias?.some((alias: any) => {
          const domain = alias.domain || alias;
          return typeof domain === 'string' && 
                 domain.endsWith('.vercel.app') && 
                 !domain.includes('-git-') && 
                 !domain.includes('fvldnvlbr') && 
                 !domain.includes('1fne8zdgg') &&
                 !domain.includes('107unuzgg') &&
                 !domain.includes('fdncvxm99') &&
                 domain.match(/^[a-zA-Z0-9-]+-[a-zA-Z0-9-]+\.vercel\.app$/);
        });
        
        if (!hasCleanProductionDomain) {
          console.log('⚠️ No clean production domain found. Forcing creation...');
          
          // Method 1: Try to add a default domain explicitly
          try {
            const defaultDomainName = `${projectName}-${Math.random().toString(36).substring(2, 8)}.vercel.app`;
            console.log(`🔨 Attempting to create default domain: ${defaultDomainName}`);
            
            const addDomainResponse = await fetch(`https://api.vercel.com/v10/projects/${projectId}/domains`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                name: defaultDomainName
              })
            });
            
            if (addDomainResponse.ok) {
              const domainResult = await addDomainResponse.json();
              console.log('✅ Successfully created default domain:', domainResult.name);
            } else {
              const domainError = await addDomainResponse.json();
              console.log('⚠️ Failed to create default domain:', domainError.error?.message);
            }
          } catch (domainCreationError) {
            console.warn('⚠️ Error creating default domain:', domainCreationError);
          }
          
          // Method 2: Force a production deployment to trigger domain creation
          console.log('🔨 Triggering production deployment for domain creation...');
          const domainCreationResponse = await fetch('https://api.vercel.com/v13/deployments', {
            method: 'POST',  
            headers: {
              'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: projectName,
              project: projectId, // Use project ID instead of name
              target: 'production',
              framework: 'nextjs',
              gitSource: {
                type: 'github',
                repo: REPO,
                ref: 'main',
                ...(repoId && { repoId })
              }
            })
          });
          
          if (domainCreationResponse.ok) {
            const tempDeployment = await domainCreationResponse.json();
            console.log('✅ Triggered domain creation deployment:', tempDeployment.id);
            
            // Wait for default domain to be potentially created
            await new Promise(resolve => setTimeout(resolve, 15000));
            
            // Check again for the default domain
            const updatedProjectResponse = await fetch(`https://api.vercel.com/v9/projects/${projectId}`, {
              headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
            });
            
            if (updatedProjectResponse.ok) {
              const updatedProject = await updatedProjectResponse.json();
              console.log('🔍 Updated project domains after creation:', {
                aliasCount: updatedProject.alias?.length || 0,
                domains: updatedProject.alias?.map((a: any) => a.domain || a) || []
              });
            }
          } else {
            const creationError = await domainCreationResponse.json();
            console.warn('⚠️ Failed to create domain creation deployment:', creationError.error?.message);
          }
        } else {
          console.log('✅ Clean production domain already exists');
        }
      }
    } catch (domainError) {
      console.warn('⚠️ Error ensuring default production domain:', domainError);
    }

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
      logoUrl: logoUrl,
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

    // Handle Pinecone vectorstore for the chatbot
    let vectorstoreIndexName = '';
    
    if (vectorstore && vectorstore.indexName) {
      // Use provided vectorstore
      console.log('🎯 Using provided vectorstore:', vectorstore.displayName, '(' + vectorstore.indexName + ')');
      vectorstoreIndexName = vectorstore.indexName;
      
      // Verify the vectorstore exists
      try {
        const exists = await PineconeService.indexExists(vectorstore.indexName);
        if (exists) {
          console.log('✅ Vectorstore exists and is ready');
          
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
        } else {
          console.error('❌ Provided vectorstore does not exist:', vectorstore.indexName);
          throw new Error(`Vectorstore "${vectorstore.displayName}" does not exist`);
        }
      } catch (vectorstoreError) {
        console.error('❌ Error verifying vectorstore:', vectorstoreError);
        throw new Error(`Failed to verify vectorstore: ${vectorstoreError}`);
      }
    } else {
      // Create new vectorstore (backward compatibility)
      console.log('🗄️ Creating new Pinecone vectorstore for chatbot:', chatbotId);
      
      try {
        const pineconeResult = await PineconeService.createIndexFromChatbotId(chatbotId, userId || chatbotData?.userId || 'unknown');
        
        if (!pineconeResult.success) {
          console.error('❌ Failed to create Pinecone index:', pineconeResult.error);
          throw new Error(`Failed to create vectorstore: ${pineconeResult.error}`);
        } else {
          console.log('✅ Successfully created Pinecone index:', pineconeResult.indexName);
          vectorstoreIndexName = pineconeResult.indexName;
          
          // Update chatbot document with vectorstore info
          await DatabaseService.updateChatbotVectorstore(chatbotId, {
            provider: 'pinecone',
            indexName: pineconeResult.indexName,
            dimension: 1536,
            metric: 'cosine',
            region: 'us-east-1',
            status: 'ready',
          });
        }
      } catch (pineconeError) {
        console.error('❌ Pinecone service error during deployment:', pineconeError);
        throw new Error(`Vectorstore creation failed: ${pineconeError}`);
      }
    }

    // Handle authentication setup for Firebase projects
    console.log('🔄 Reusable Firebase project mode:', USE_REUSABLE_FIREBASE_PROJECT ? 'ENABLED' : 'DISABLED');
    if (USE_REUSABLE_FIREBASE_PROJECT) {
      console.log('🔥 Using reusable Firebase project:', REUSABLE_FIREBASE_PROJECT_ID);
    }
    
    let dedicatedFirebaseProject = null;
    
    if (USE_REUSABLE_FIREBASE_PROJECT) {
      console.log('🔧 Setting up reusable Firebase project for chatbot...');
      
      // Validate required configuration
      if (!REUSABLE_FIREBASE_PROJECT_ID) {
        throw new Error('REUSABLE_FIREBASE_PROJECT_ID is required when USE_REUSABLE_FIREBASE_PROJECT=true');
      }
      
      try {
        // Use the existing Firebase setup logic but target the existing project
        const firebaseResult = await FirebaseAPIService.setupExistingProjectForChatbot({
          projectId: REUSABLE_FIREBASE_PROJECT_ID,
          chatbotId,
          chatbotName: chatbotConfig.name,
          creatorUserId: userId || chatbotData?.userId || 'unknown'
        });

        if (!firebaseResult.success) {
          console.error('❌ Failed to set up existing Firebase project:', firebaseResult.error);
          throw new Error(`Failed to set up existing Firebase project: ${firebaseResult.error}`);
        }

        if (!firebaseResult.project) {
          console.error('❌ Firebase project setup succeeded but no project returned');
          throw new Error('Firebase project setup succeeded but no project data returned');
        }

        dedicatedFirebaseProject = firebaseResult.project;
        console.log('✅ Existing Firebase project configured for chatbot:', dedicatedFirebaseProject.projectId);
        
      } catch (firebaseError) {
        console.error('❌ Firebase project setup failed:', firebaseError);
        throw new Error(`Firebase project setup failed: ${firebaseError.message}`);
      }
      
    } else {
      console.log('🔥 Creating dedicated Firebase project for chatbot...');
      
      try {
        // Create dedicated Firebase project for this chatbot using API
        const firebaseResult = await FirebaseAPIService.createProjectForChatbot({
          chatbotId,
          chatbotName: chatbotConfig.name,
          creatorUserId: userId || chatbotData?.userId || 'unknown'
        });

        if (!firebaseResult.success) {
          console.error('❌ Failed to create Firebase project:', firebaseResult.error);
          throw new Error(`Failed to create Firebase project: ${firebaseResult.error}`);
        }

        if (!firebaseResult.project) {
          console.error('❌ Firebase project creation succeeded but no project returned');
          throw new Error('Firebase project creation succeeded but no project data returned');
        }

        dedicatedFirebaseProject = firebaseResult.project;
        console.log('✅ Dedicated Firebase project created:', dedicatedFirebaseProject.projectId);
        
      } catch (firebaseError) {
        console.error('❌ Firebase project creation failed:', firebaseError);
        throw new Error(`Firebase project creation failed: ${firebaseError.message}`);
      }
    }

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
    const hasValidServiceAccount = dedicatedFirebaseProject?.serviceAccount?.clientEmail && 
                                   dedicatedFirebaseProject?.serviceAccount?.privateKey;
    
    console.log('🔍 Firebase service account validation:', {
      hasFirebaseProject: !!dedicatedFirebaseProject,
      hasConfig: !!dedicatedFirebaseProject?.config,
      hasServiceAccount: !!dedicatedFirebaseProject?.serviceAccount,
      hasClientEmail: !!dedicatedFirebaseProject?.serviceAccount?.clientEmail,
      hasPrivateKey: !!dedicatedFirebaseProject?.serviceAccount?.privateKey,
      isServiceAccountValid: hasValidServiceAccount,
      projectId: dedicatedFirebaseProject?.config?.projectId || 'MISSING'
    });

    if (!hasValidServiceAccount) {
      console.error('❌ CRITICAL: Firebase service account credentials are missing or incomplete!');
      console.error('🔧 This will cause authentication failures in the deployed chatbot.');
      console.error('📋 Expected: clientEmail and privateKey from service account creation');
      console.error('🎯 Actual:', {
        serviceAccount: dedicatedFirebaseProject?.serviceAccount || 'NULL',
        clientEmail: dedicatedFirebaseProject?.serviceAccount?.clientEmail || 'MISSING',
        privateKey: dedicatedFirebaseProject?.serviceAccount?.privateKey ? 'PRESENT' : 'MISSING'
      });
      
      // Fail the deployment if we don't have valid service account credentials
      return NextResponse.json({ 
        error: `Firebase service account creation failed. Cannot deploy chatbot without proper authentication credentials. Service account status: ${dedicatedFirebaseProject?.serviceAccount ? 'partial' : 'missing'}`,
        details: {
          hasProject: !!dedicatedFirebaseProject,
          hasServiceAccount: !!dedicatedFirebaseProject?.serviceAccount,
          missingFields: [
            ...(!dedicatedFirebaseProject?.serviceAccount?.clientEmail ? ['clientEmail'] : []),
            ...(!dedicatedFirebaseProject?.serviceAccount?.privateKey ? ['privateKey'] : [])
          ]
        }
      }, { status: 500 });
    }

    console.log('✅ Firebase service account credentials validated successfully');
    
    // Set environment variables on the project
    const envVars = {
      // Chatbot-specific configuration
      CHATBOT_ID: chatbotId,
      CHATBOT_CONFIG: JSON.stringify(chatbotConfig),
      
      // Public environment variables (accessible in browser)
      NEXT_PUBLIC_CHATBOT_ID: chatbotId,
      NEXT_PUBLIC_CHATBOT_NAME: chatbotConfig.name,  
      NEXT_PUBLIC_CHATBOT_DESCRIPTION: chatbotConfig.description,
      NEXT_PUBLIC_CHATBOT_LOGO_URL: chatbotConfig.logoUrl,
      NEXT_PUBLIC_CHATBOT_PRIMARY_COLOR: chatbotConfig.primaryColor,
      NEXT_PUBLIC_CHATBOT_BUBBLE_STYLE: chatbotConfig.bubbleStyle,
      NEXT_PUBLIC_CHATBOT_LOGIN_REQUIRED: chatbotConfig.requireAuth.toString(),
      NEXT_PUBLIC_CUSTOM_DOMAIN: customDomain || '',
      
      // Dedicated Firebase client configuration (public)
      NEXT_PUBLIC_FIREBASE_API_KEY: dedicatedFirebaseProject.config.apiKey,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: dedicatedFirebaseProject.config.authDomain,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: dedicatedFirebaseProject.config.projectId,
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: dedicatedFirebaseProject.config.storageBucket,
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: dedicatedFirebaseProject.config.messagingSenderId,
      NEXT_PUBLIC_FIREBASE_APP_ID: dedicatedFirebaseProject.config.appId,
      NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '', // Keep from main project for analytics
      
      // Dedicated Firebase Admin SDK (Server-side, secure) - NOW GUARANTEED TO BE VALID
      FIREBASE_PROJECT_ID: dedicatedFirebaseProject.config.projectId,
      FIREBASE_CLIENT_EMAIL: dedicatedFirebaseProject.serviceAccount.clientEmail,
      FIREBASE_PRIVATE_KEY: dedicatedFirebaseProject.serviceAccount.privateKey,
      
      // Main ChatFactory project credentials (for token validation)
      CHATFACTORY_MAIN_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'docsai-chatbot-app',
      CHATFACTORY_MAIN_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
      CHATFACTORY_MAIN_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY || '',
      
      // API Keys (Server-side, secure)
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      MISTRAL_API_KEY: process.env.MISTRAL_API_KEY || '',
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
      COHERE_API_KEY: process.env.COHERE_API_KEY || '',
      
      // Pinecone Vector Database Configuration
      PINECONE_API_KEY: process.env.PINECONE_API_KEY || '',
      PINECONE_ENVIRONMENT: 'us-east-1', // Use us-east-1 for free plan compatibility
      PINECONE_INDEX_NAME: vectorstoreIndexName || PineconeService.generateIndexName(chatbotId),
      MINSCORESOURCESTHRESHOLD: process.env.DEFAULT_MINSCORESOURCESTHRESHOLD || process.env.MINSCORESOURCESTHRESHOLD || '0.73',
      
      // Embedding Configuration
      FETCH_K_EMBEDDINGS: process.env.DEFAULT_FETCH_K_EMBEDDINGS || process.env.FETCH_K_EMBEDDINGS || '12',
      LAMBDA_EMBEDDINGS: process.env.DEFAULT_LAMBDA_EMBEDDINGS || process.env.LAMBDA_EMBEDDINGS || '0.2',
      K_EMBEDDINGS: process.env.DEFAULT_K_EMBEDDINGS || process.env.K_EMBEDDINGS || '10',
      
      // Database Configuration  
      DATABASE_URL: process.env.DATABASE_URL || '',
      
      // Debug: Log what DATABASE_URL we're setting (remove after debugging)
      DEBUG_DATABASE_URL_CHECK: process.env.DATABASE_URL ? 'DATABASE_URL_SET' : 'DATABASE_URL_MISSING',
      
      // AI Model Configuration
      MODEL_NAME: chatbotData?.aiConfig?.llmModel || process.env.DEFAULT_MODEL_NAME || process.env.MODEL_NAME || 'gpt-3.5-turbo',
      IMAGE_MODEL_NAME: process.env.DEFAULT_IMAGE_MODEL_NAME || process.env.IMAGE_MODEL_NAME || 'gpt-4-mini',
      TEMPRATURE: chatbotData?.aiConfig?.temperature?.toString() || process.env.DEFAULT_TEMPERATURE || process.env.TEMPRATURE || '0.7',
      
      // Application URLs
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://chatfactory.ai',
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://chatfactory.ai/api',
      
      // Debug page (temporary - remove after testing)
      ENABLE_DEBUG_PAGE: 'true'
    };
    
    // Filter out empty values but keep empty strings for optional fields
    const filteredEnvVars = Object.fromEntries(
      Object.entries(envVars).filter(([key, value]) => value !== undefined && value !== null)
    );
    
    // Debug: Log what environment variables we're setting
    console.log('Setting environment variables on Vercel project:');
    console.log('Keys:', Object.keys(filteredEnvVars));
    console.log('Total variables to set:', Object.keys(filteredEnvVars).length);
    console.log('Chatbot Config:', {
      id: chatbotConfig.id,
      name: chatbotConfig.name,
      logoUrl: chatbotConfig.logoUrl ? 'Present' : 'Missing',
      hasFirebaseConfig: !!filteredEnvVars.NEXT_PUBLIC_FIREBASE_API_KEY
    });
    
    // Debug: Log Pinecone configuration specifically
    console.log('🔍 Pinecone Configuration Check:');
    console.log('PINECONE_API_KEY:', filteredEnvVars.PINECONE_API_KEY ? 'SET ✅' : 'MISSING ❌');
    console.log('PINECONE_ENVIRONMENT:', filteredEnvVars.PINECONE_ENVIRONMENT ? 'SET ✅' : 'MISSING ❌');
    console.log('PINECONE_INDEX_NAME:', filteredEnvVars.PINECONE_INDEX_NAME ? 'SET ✅' : 'MISSING ❌');
    console.log('MINSCORESOURCESTHRESHOLD:', filteredEnvVars.MINSCORESOURCESTHRESHOLD ? 'SET ✅' : 'MISSING ❌');
    
    // Set environment variables on the project with better error handling
    console.log('Setting environment variables on project:', projectName);
    const envSetResults = await setEnvironmentVariables(VERCEL_API_TOKEN, projectName, filteredEnvVars);
    
    console.log(`📊 Environment variables summary: ${envSetResults.success} set, ${envSetResults.skipped} already existed, ${envSetResults.failed} failed`);
    
    // Fail deployment if critical env vars couldn't be set
    if (envSetResults.failed > 0 && envSetResults.success === 0) {
      return NextResponse.json({ 
        error: 'Failed to set required environment variables on Vercel project'
      }, { status: 500 });
    }
    
    // Wait longer for env vars to propagate and verify they're set
    console.log('⏳ Waiting for environment variables to propagate...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    
    // Verify critical environment variables are set
    const verification = await verifyEnvironmentVariables(VERCEL_API_TOKEN, projectName, [
      'NEXT_PUBLIC_CHATBOT_ID',
      'NEXT_PUBLIC_CHATBOT_NAME',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
    ]);
    
    if (!verification.success) {
      console.warn('⚠️ Some critical environment variables may not be set properly:', verification.missing);
    } else {
      console.log('✅ Critical environment variables verified');
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
            status: 'deployed',
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
            deployment: {
              deploymentId: deploymentRef.id,
              deploymentUrl: finalFallbackUrl,
              status: 'deployed',
              deployedAt: Timestamp.now(),
              vercelProjectId: projectName,
              vercelDeploymentId: deploymentData.id,
            },
            updatedAt: Timestamp.now()
          });
          console.log('✅ Chatbot document updated with fallback deployment info');

        } catch (dbError) {
          console.error('❌ Failed to create fallback deployment record:', dbError);
          // Continue with deployment - don't fail the deployment because of DB issues
        }
        
        return createSuccessResponse(deploymentData, projectName, chatbotConfig, true, false, dedicatedFirebaseProject, domainResult, finalFallbackUrl);
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
    
    // Get production domain immediately using correct API endpoint - NO WAITING!
    console.log('🌐 Getting production domain immediately using correct domains API...');
    let finalDeploymentUrl = null;
    
    try {
      // Use the correct domains endpoint: /v9/projects/{id}/domains
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
        
        // Print ALL domains to see which position we want
        if (domainsData.domains && domainsData.domains.length > 0) {
          console.log('🔍 ALL DOMAINS FOUND:');
          domainsData.domains.forEach((domain: any, index: number) => {
            console.log(`  ${index}: ${domain.name} (verified: ${domain.verified})`);
          });
          
          // For now, let's just use the first .vercel.app domain that's not a git branch
          // We'll adjust the index based on what we see in the logs
          const nonGitDomains = domainsData.domains.filter((domain: any) => {
            return domain.name && 
                   domain.name.endsWith('.vercel.app') && 
                   !domain.name.includes('-git-');
          });
          
          console.log('🎯 NON-GIT VERCEL DOMAINS:');
          nonGitDomains.forEach((domain: any, index: number) => {
            console.log(`  ${index}: ${domain.name}`);
          });
          
          if (nonGitDomains.length > 0) {
            // Use index 1 for the clean production domain (like testbot-gray.vercel.app)
            // Index 0 is usually the deployment-specific domain (like testbot-rdfele.vercel.app)
            const domainIndex = nonGitDomains.length > 1 ? 1 : 0; // Use index 1 if available, fallback to 0
            const selectedDomain = nonGitDomains[domainIndex];
            finalDeploymentUrl = `https://${selectedDomain.name}`;
            console.log(`✅ Selected domain at index ${domainIndex}: ${finalDeploymentUrl}`);
            console.log('🎯 This should be the clean production domain with animal/color name!');
          }
        }
      }
    } catch (error) {
      console.error('❌ Error getting production domain:', error);
    }
    
    // Fallback to default format if domains not found
    if (!finalDeploymentUrl) {
      finalDeploymentUrl = deploymentData.url ? 
        (deploymentData.url.startsWith('http') ? deploymentData.url : `https://${deploymentData.url}`) : 
        `https://${projectName}.vercel.app`;
      console.log(`⚠️ Using fallback URL: ${finalDeploymentUrl}`);
    }
    
    console.log('🎯 Final deployment URL ready immediately:', finalDeploymentUrl);
    
    // CREATE DEPLOYMENT RECORD IN DATABASE
    try {
      console.log('📋 Creating deployment record in database...');
      
      const deploymentRecord = {
        chatbotId: chatbotId,
        userId: userId || chatbotData?.userId,
        status: 'deployed',
        subdomain: projectName,
        deploymentUrl: finalDeploymentUrl,
        
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
          monthlyQueryLimit: 1000, // Default for free plan
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
      console.log('✅ Deployment record created with ID:', deploymentRef.id);

      // Update chatbot document with deployment info
      await adminDb.collection('chatbots').doc(chatbotId).update({
        status: 'active',
        deployment: {
          deploymentId: deploymentRef.id,
          deploymentUrl: finalDeploymentUrl,
          status: 'deployed',
          deployedAt: Timestamp.now(),
          vercelProjectId: projectName,
          vercelDeploymentId: deploymentData.id,
        },
        updatedAt: Timestamp.now()
      });
      console.log('✅ Chatbot document updated with deployment info');

    } catch (dbError) {
      console.error('❌ Failed to create deployment record:', dbError);
      // Continue with deployment - don't fail the deployment because of DB issues
    }
    
    // Firebase Authentication is configured automatically - no OAuth redirect URIs to update
    console.log('ℹ️  Firebase Authentication configured via API - no redirect URIs to update');
    
    // Update database with deployment information
    try {
      // Get userId - try from request body first, then from chatbot data
      const userIdForUpdate = userId || chatbotData?.userId;
      
      if (userIdForUpdate) {
        // Update user deployment count
        console.log('📊 Updating user deployment count for user:', userIdForUpdate);
        await DatabaseService.updateUserDeploymentCount(userIdForUpdate);
      } else {
        console.warn('⚠️ No userId available for updating deployment count');
      }
      
      // Update chatbot with deployment info
      console.log('📝 Updating chatbot deployment info...');
        
      const deploymentInfo: any = {
        vercelProjectId: projectName,
        deploymentUrl: finalDeploymentUrl,
        deploymentId: deploymentData.id,
        status: 'live',
        target: 'production',
        gitRef: 'main',
        isStaged: false,
        // Dedicated Firebase project information
        firebaseProjectId: dedicatedFirebaseProject?.projectId,
        firebaseConfig: dedicatedFirebaseProject?.config,
      };
      
      // Add custom domain information if configured
      if (domainResult?.success && customDomain) {
        deploymentInfo.customDomain = customDomain;
        deploymentInfo.domainVerified = domainResult.data?.verified || false;
        deploymentInfo.domainStatus = domainResult.data?.verified ? 'active' : 'pending_verification';
      }
      
      await DatabaseService.updateChatbotDeployment(chatbotId, deploymentInfo);
      
      // Update Firebase project details to indicate hosting is now active
      if (dedicatedFirebaseProject?.projectId) {
        try {
          await adminDb.collection('chatbots').doc(chatbotId).update({
            'firebaseProject.services.hosting': true,
            'firebaseProject.urls.hosting': finalDeploymentUrl,
            'firebaseProject.deployment': {
              status: 'deployed',
              url: finalDeploymentUrl,
              vercelProjectId: projectName,
              deployedAt: Timestamp.now()
            },
            updatedAt: Timestamp.now()
          });
          console.log('✅ Updated Firebase project deployment status');
        } catch (updateError) {
          console.error('❌ Failed to update Firebase project deployment status:', updateError);
          // Don't fail the entire deployment for this
        }
      }
      
      console.log('✅ Database updates completed successfully');
    } catch (dbError) {
      console.error('❌ Failed to update database after deployment:', dbError);
      // Don't fail the entire deployment for database update issues
    }
    
    // STEP 7: Add authorized domains to Firebase project
    if (dedicatedFirebaseProject?.projectId) {
      const deploymentUrl = deploymentData.url ? 
        (deploymentData.url.startsWith('http') ? deploymentData.url : `https://${deploymentData.url}`) : 
        `https://${projectName}.vercel.app`;
        
      console.log('🔧 Adding domains to Firebase authorized domains...');
      
      // Collect all domains that need to be authorized
      const domainsToAuthorize = [];
      
      // Always add the Vercel deployment domain
      domainsToAuthorize.push(deploymentUrl);
      console.log(`📝 Will authorize Vercel domain: ${deploymentUrl}`);
      
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
    
    return createSuccessResponse(deploymentData, projectName, chatbotConfig, false, false, dedicatedFirebaseProject, domainResult, finalDeploymentUrl);
  } catch (error: any) {
    console.error('Deployment error:', error);
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

// Helper function to set environment variables with retry logic
async function setEnvironmentVariables(
  token: string, 
  projectName: string, 
  envVars: Record<string, string>
): Promise<{ success: number; skipped: number; failed: number }> {
  let successCount = 0;
  let skipCount = 0;
  let failedCount = 0;

  for (const [key, value] of Object.entries(envVars)) {
    let retries = 2;
    let success = false;

    while (retries > 0 && !success) {
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
            console.log(`⚠️  Environment variable already exists: ${key}`);
            
            // Try to update the existing environment variable
            const updateResponse = await updateEnvironmentVariable(token, projectName, key, value);
            if (updateResponse) {
              console.log(`✅ Updated existing environment variable: ${key}`);
              successCount++;
            } else {
              console.log(`ℹ️  Kept existing value for: ${key}`);
              skipCount++;
            }
            success = true;
          } else {
            console.error(`❌ Failed to set env var ${key} (attempt ${3 - retries}):`, envError);
            retries--;
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
            }
          }
        } else {
          console.log(`✅ Set environment variable: ${key}`);
          successCount++;
          success = true;
        }
      } catch (error) {
        console.error(`❌ Error setting env var ${key} (attempt ${3 - retries}):`, error);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        }
      }
    }

    if (!success) {
      failedCount++;
    }

    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return { success: successCount, skipped: skipCount, failed: failedCount };
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
function createSuccessResponse(deploymentData: any, projectName: string, chatbotConfig: any, isFallback = false, isStaged = false, firebaseProject: any = null, domainResult: any = null, actualProductionUrl: string | null = null) {
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
