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

    // 2. Set environment variables on the project
    const envVars = {
      CHATBOT_ID: chatbotId,
      NEXT_PUBLIC_CHATBOT_NAME: chatbotName || `Chatbot ${chatbotId}`,
      NEXT_PUBLIC_CHATBOT_LOGO_URL: chatbotData.logoUrl || '',
      // Firebase client configuration
      NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
      // Firebase Admin SDK (Server-side)
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
      FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
      FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
      // API Keys
      NEXT_PUBLIC_MISTRAL_API_KEY: process.env.NEXT_PUBLIC_MISTRAL_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY
    };
    
    // Filter out undefined values
    const filteredEnvVars = Object.fromEntries(
      Object.entries(envVars).filter(([key, value]) => value !== undefined)
    );
    
    // Debug: Log what environment variables we're setting
    console.log('Setting environment variables on Vercel project:');
    console.log('Keys:', Object.keys(filteredEnvVars));
    console.log('Total variables to set:', Object.keys(filteredEnvVars).length);
    console.log('Firebase API Key available:', !!filteredEnvVars.NEXT_PUBLIC_FIREBASE_API_KEY);
    
    // Set environment variables on the project
    console.log('Setting environment variables on project:', projectName);
    let successCount = 0;
    let skipCount = 0;
    
    for (const [key, value] of Object.entries(filteredEnvVars)) {
      try {
        const envResponse = await fetch(`https://api.vercel.com/v9/projects/${projectName}/env`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            key: key,
            value: value,
            type: 'encrypted',
            target: ['production', 'preview', 'development']
          })
        });
        
        if (!envResponse.ok) {
          const envError = await envResponse.json();
          // Only log error if it's not a "already exists" error
          if (envError.error?.code === 'ENV_ALREADY_EXISTS') {
            console.log(`⚠️  Environment variable already exists: ${key}`);
            skipCount++;
          } else {
            console.error(`❌ Failed to set env var ${key}:`, envError);
          }
        } else {
          console.log(`✅ Set environment variable: ${key}`);
          successCount++;
        }
      } catch (error) {
        console.error(`❌ Error setting env var ${key}:`, error);
      }
    }
    
    console.log(`📊 Environment variables summary: ${successCount} set, ${skipCount} already existed`);
    
    // Wait a moment for env vars to propagate
    await new Promise(resolve => setTimeout(resolve, 2000));

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
        return createSuccessResponse(deploymentData, projectName, true);
      }
      
      return NextResponse.json({ 
        error: `Failed to create deployment: ${errorData.error?.message || 'Unknown error'}`
      }, { status: 500 });
    }

    const deploymentData = await deploymentResponse.json();
    console.log('✅ Deployment created successfully:', deploymentData.id);
    console.log('🔗 Deployment URL:', deploymentData.url);
    
    return createSuccessResponse(deploymentData, projectName);
  } catch (error: any) {
    console.error('Deployment error:', error);
    return NextResponse.json({ 
      error: `Error deploying chatbot: ${error.message}` 
    }, { status: 500 });
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
function createSuccessResponse(deploymentData: any, projectName: string, isFallback = false) {
  return NextResponse.json({
    success: true,
    projectName,
    deploymentId: deploymentData.id,
    url: deploymentData.url ? 
         (deploymentData.url.startsWith('http') ? deploymentData.url : `https://${deploymentData.url}`) : 
         `https://${projectName}.vercel.app`,
    ...(isFallback && { note: 'Deployed using file-based deployment due to GitHub integration issues' })
  });
}
