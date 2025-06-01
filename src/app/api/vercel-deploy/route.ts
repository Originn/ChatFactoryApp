import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebase/admin/index';
import { PineconeService } from '@/services/pineconeService';
import { DatabaseService } from '@/services/databaseService';
import { FirebaseProjectService } from '@/services/firebaseProjectService';

// Repository information
const REPO_OWNER = 'Originn';
const REPO_NAME = 'ChatFactoryTemplate';  // Your chatbot template repository
const REPO = `${REPO_OWNER}/${REPO_NAME}`;

// SIMPLIFIED: Always deploy from main branch to production
// No staging/preview workflow needed - direct to production deployment

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
        
        const projectDetailsResponse = await fetch(`https://api.vercel.com/v9/projects/${projectName}`, {
          headers: {
            'Authorization': `Bearer ${VERCEL_API_TOKEN}`
          }
        });
        
        if (projectDetailsResponse.ok) {
          const projectDetails = await projectDetailsResponse.json();
          repoId = projectDetails.link?.repoId;
          console.log(`Retrieved existing project with repoId: ${repoId}`);
        }
      } else {
        return NextResponse.json({ 
          error: `Failed to create Vercel project: ${errorData.error?.message || 'Unknown error'}`
        }, { status: 500 });
      }
    } else {
      const projectResult = await createProjectResponse.json();
      repoId = projectResult.link?.repoId;
      console.log(`Project created with repoId: ${repoId}`);
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

    // Handle authentication setup for separate Firebase projects
    console.log('🔥 Creating dedicated Firebase project for chatbot...');
    
    let dedicatedFirebaseProject = null;
    try {
      // Create dedicated Firebase project for this chatbot
      const firebaseResult = await FirebaseProjectService.createProjectForChatbot({
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
      
      // Dedicated Firebase client configuration (public)
      NEXT_PUBLIC_FIREBASE_API_KEY: dedicatedFirebaseProject?.config.apiKey || '',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: dedicatedFirebaseProject?.config.authDomain || '',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: dedicatedFirebaseProject?.config.projectId || '',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: dedicatedFirebaseProject?.config.storageBucket || '',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: dedicatedFirebaseProject?.config.messagingSenderId || '',
      NEXT_PUBLIC_FIREBASE_APP_ID: dedicatedFirebaseProject?.config.appId || '',
      NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '', // Keep from main project for analytics
      
      // Dedicated Firebase Admin SDK (Server-side, secure)
      FIREBASE_PROJECT_ID: dedicatedFirebaseProject?.config.projectId || '',
      FIREBASE_CLIENT_EMAIL: dedicatedFirebaseProject?.serviceAccount?.clientEmail || '',
      FIREBASE_PRIVATE_KEY: dedicatedFirebaseProject?.serviceAccount?.privateKey || '',
      
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
        return createSuccessResponse(deploymentData, projectName, chatbotConfig, true, false, dedicatedFirebaseProject);
      }
      
      return NextResponse.json({ 
        error: `Failed to create deployment: ${errorData.error?.message || 'Unknown error'}`
      }, { status: 500 });
    }

    const deploymentData = await deploymentResponse.json();
    console.log('✅ Deployment created successfully:', deploymentData.id);
    console.log('🔗 Deployment URL:', deploymentData.url);
    
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
      const deploymentUrl = deploymentData.url ? 
        (deploymentData.url.startsWith('http') ? deploymentData.url : `https://${deploymentData.url}`) : 
        `https://${projectName}.vercel.app`;
        
      const deploymentInfo: any = {
        vercelProjectId: projectName,
        deploymentUrl,
        deploymentId: deploymentData.id,
        status: 'live',
        target: 'production',
        gitRef: 'main',
        isStaged: false,
        // Dedicated Firebase project information
        firebaseProjectId: dedicatedFirebaseProject?.projectId,
        firebaseConfig: dedicatedFirebaseProject?.config,
      };
      
      // Only add customDomain if it exists
      // Don't add undefined values to avoid Firestore errors
      
      await DatabaseService.updateChatbotDeployment(chatbotId, deploymentInfo);
      
      console.log('✅ Database updates completed successfully');
    } catch (dbError) {
      console.error('❌ Failed to update database after deployment:', dbError);
      // Don't fail the entire deployment for database update issues
    }
    
    return createSuccessResponse(deploymentData, projectName, chatbotConfig, false, false, dedicatedFirebaseProject);
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
  return fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: projectName,
      project: projectName,
      target,
      files: []
      // Environment variables are set on the project, not in deployment
    })
  });
}

// Helper function to create success response
function createSuccessResponse(deploymentData: any, projectName: string, chatbotConfig: any, isFallback = false, isStaged = false, firebaseProject: any = null) {
  const deploymentUrl = deploymentData.url ? 
    (deploymentData.url.startsWith('http') ? deploymentData.url : `https://${deploymentData.url}`) : 
    `https://${projectName}.vercel.app`;
    
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
