import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';

// Repository information
const REPO_OWNER = 'Originn';
const REPO_NAME = 'ChatFactoryTemplate';  // Your chatbot template repository
const REPO = `${REPO_OWNER}/${REPO_NAME}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatbotId, chatbotName } = body;

    if (!chatbotId) {
      return NextResponse.json({ error: 'Missing chatbot ID' }, { status: 400 });
    }

    const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
    if (!VERCEL_API_TOKEN) {
      return NextResponse.json({ 
        error: 'Vercel API token not configured on server'
      }, { status: 500 });
    }

    // Fetch chatbot data from Firestore to get logo URL and other details
    let chatbotData = null;
    try {
      const chatbotRef = doc(db, "chatbots", chatbotId);
      const chatbotSnap = await getDoc(chatbotRef);
      
      if (chatbotSnap.exists()) {
        chatbotData = chatbotSnap.data();
        console.log('Chatbot data retrieved for deployment');
      } else {
        console.warn('Chatbot not found in Firestore, proceeding without logo');
      }
    } catch (firestoreError) {
      console.error('Error fetching chatbot data:', firestoreError);
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
    const chatbotConfig = {
      id: chatbotId,
      name: chatbotName || chatbotData?.name || `Chatbot ${chatbotId}`,
      description: chatbotData?.description || 'AI-powered chatbot',
      logoUrl: chatbotData?.logoUrl || '',
      primaryColor: chatbotData?.appearance?.primaryColor || '#3b82f6',
      bubbleStyle: chatbotData?.appearance?.bubbleStyle || 'rounded',
      requireAuth: chatbotData?.requireAuth || false,
      systemPrompt: chatbotData?.behavior?.systemPrompt || 'You are a helpful AI assistant.',
      llmModel: chatbotData?.aiConfig?.llmModel || 'gpt-3.5-turbo',
      temperature: chatbotData?.aiConfig?.temperature || 0.7,
      ...chatbotData
    };

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
      NEXT_PUBLIC_CHATBOT_REQUIRE_AUTH: chatbotConfig.requireAuth.toString(),
      
      // Firebase client configuration (public)
      NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
      NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
      
      // Firebase Admin SDK (Server-side, secure)
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
      FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
      FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY || '',
      
      // API Keys (Server-side, secure)
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      MISTRAL_API_KEY: process.env.MISTRAL_API_KEY || '',
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
      COHERE_API_KEY: process.env.COHERE_API_KEY || '',
      
      // Application URLs
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://chatfactory.ai',
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://chatfactory.ai/api'
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

    // 3. Create deployment
    // 3. Create deployment
    let deploymentResponse;
    
    // Create deployment payload based on whether we have repoId
    if (repoId) {
      console.log(`Using GitHub integration with repoId: ${repoId}`);
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
      deploymentResponse = await createFileBasedDeployment(VERCEL_API_TOKEN, projectName);
    }

    // Handle deployment response
    if (!deploymentResponse.ok) {
      const errorData = await deploymentResponse.json();
      console.error('Deployment failed:', JSON.stringify(errorData, null, 2));
      
      // If GitHub integration failed, fall back to file-based deployment
      if (repoId) {
        console.log('Falling back to file-based deployment');
        const fallbackResponse = await createFileBasedDeployment(VERCEL_API_TOKEN, projectName);
        
        if (!fallbackResponse.ok) {
          const fallbackError = await fallbackResponse.json();
          return NextResponse.json({ 
            error: `Failed to create deployment: ${fallbackError.error?.message || 'Unknown error'}`
          }, { status: 500 });
        }
        
        const deploymentData = await fallbackResponse.json();
        return createSuccessResponse(deploymentData, projectName, chatbotConfig, true);
      }
      
      return NextResponse.json({ 
        error: `Failed to create deployment: ${errorData.error?.message || 'Unknown error'}`
      }, { status: 500 });
    }

    const deploymentData = await deploymentResponse.json();
    console.log('✅ Deployment created successfully:', deploymentData.id);
    console.log('🔗 Deployment URL:', deploymentData.url);
    
    return createSuccessResponse(deploymentData, projectName, chatbotConfig);
  } catch (error: any) {
    console.error('Deployment error:', error);
    return NextResponse.json({ 
      error: `Error deploying chatbot: ${error.message}` 
    }, { status: 500 });
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
async function createFileBasedDeployment(token: string, projectName: string) {
  return fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: projectName,
      project: projectName,
      target: 'production',
      files: []
      // Environment variables are set on the project, not in deployment
    })
  });
}

// Helper function to create success response
function createSuccessResponse(deploymentData: any, projectName: string, chatbotConfig: any, isFallback = false) {
  const deploymentUrl = deploymentData.url ? 
    (deploymentData.url.startsWith('http') ? deploymentData.url : `https://${deploymentData.url}`) : 
    `https://${projectName}.vercel.app`;
    
  return NextResponse.json({
    success: true,
    projectName,
    deploymentId: deploymentData.id,
    url: deploymentUrl,
    chatbot: {
      id: chatbotConfig.id,
      name: chatbotConfig.name,
      logoUrl: chatbotConfig.logoUrl,
      hasLogo: !!chatbotConfig.logoUrl
    },
    environmentVariables: {
      chatbotId: !!chatbotConfig.id,
      chatbotName: !!chatbotConfig.name,
      logoUrl: !!chatbotConfig.logoUrl,
      firebaseConfig: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    },
    ...(isFallback && { note: 'Deployed using file-based deployment due to GitHub integration issues' }),
    debug: {
      timestamp: new Date().toISOString(),
      deploymentMethod: isFallback ? 'file-based' : 'git-integration'
    }
  });
}
