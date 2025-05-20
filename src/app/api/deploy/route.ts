import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { collection, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

// Function to create a Vercel project using Vercel API (placeholder)
async function createVercelProject(projectName: string) {
  // For now, return a placeholder response
  return {
    projectId: `project-${Date.now()}`,
    projectName: projectName,
    deploymentId: `deployment-${Date.now()}`,
    url: `https://${projectName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()}.vercel.app`
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatbotId } = body;

    if (!chatbotId) {
      return NextResponse.json({ error: 'Missing chatbot ID' }, { status: 400 });
    }

    // Get the chatbot details
    const chatbotRef = doc(db, "chatbots", chatbotId);
    const chatbotSnap = await getDoc(chatbotRef);
    
    if (!chatbotSnap.exists()) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }
    
    const chatbotData = chatbotSnap.data();
    
    // Create a "fake" Vercel project (placeholder)
    const projectName = chatbotData.domain || `chatbot-${chatbotId}`;
    const vercelProject = await createVercelProject(projectName);
    
    // Instead of creating a new deployments collection document (which fails due to permissions),
    // just update the existing chatbot document (which works with your current rules)
    try {
      // Update the chatbot with deployment info
      await updateDoc(chatbotRef, {
        status: 'active',
        deployedUrl: vercelProject.url,
        vercelProjectId: vercelProject.projectId,
        deploymentTimestamp: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Return success response
      return NextResponse.json({ 
        success: true, 
        deployedUrl: vercelProject.url,
        vercelProjectId: vercelProject.projectId
      });
      
    } catch (error: any) {
      console.error('Firebase update error:', error);
      return NextResponse.json({ 
        error: `Error updating chatbot: ${error.message}` 
      }, { 
        status: 500 
      });
    }
  } catch (error: any) {
    console.error('Deployment error:', error);
    return NextResponse.json({ 
      error: `Error deploying chatbot: ${error.message}` 
    }, { 
      status: 500 
    });
  }
}