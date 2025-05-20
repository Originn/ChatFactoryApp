import { NextRequest, NextResponse } from 'next/server';

// Repository information
const REPO_OWNER = 'Originn';
const REPO_NAME = 'docsai-chatbot-template';
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

    // Sanitize project name for Vercel
    const projectName = (chatbotName || `chatbot-${chatbotId}`)
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

    // 2. Create deployment
    let deploymentResponse;
    const envVars = {
      CHATBOT_ID: chatbotId,
      NEXT_PUBLIC_CHATBOT_NAME: chatbotName || `Chatbot ${chatbotId}`
    };
    
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
          },
          env: envVars
        })
      });
    } else {
      console.log('Using file-based deployment (no repoId available)');
      deploymentResponse = await createFileBasedDeployment(VERCEL_API_TOKEN, projectName, envVars);
    }

    // Handle deployment response
    if (!deploymentResponse.ok) {
      const errorData = await deploymentResponse.json();
      console.error('Deployment failed:', JSON.stringify(errorData, null, 2));
      
      // If GitHub integration failed, fall back to file-based deployment
      if (repoId) {
        console.log('Falling back to file-based deployment');
        const fallbackResponse = await createFileBasedDeployment(VERCEL_API_TOKEN, projectName, envVars);
        
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
    return createSuccessResponse(deploymentData, projectName);
  } catch (error: any) {
    console.error('Deployment error:', error);
    return NextResponse.json({ 
      error: `Error deploying chatbot: ${error.message}` 
    }, { status: 500 });
  }
}

// Helper function for file-based deployment
async function createFileBasedDeployment(token: string, projectName: string, env: any) {
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
      files: [],
      env
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
