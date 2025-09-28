import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin/index';
import { ProjectMappingService } from '@/services/projectMappingService';

/**
 * API endpoint to get system status including deployed chatbots and project mappings
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📊 Getting system status...');

    // Get all chatbots
    const chatbotsSnapshot = await adminDb.collection('chatbots').get();
    const chatbots = chatbotsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || null,
      updatedAt: doc.data().updatedAt?.toDate?.() || null
    }));

    // Get all firebase projects (old system)
    const firebaseProjectsSnapshot = await adminDb.collection('firebaseProjects').get();
    const firebaseProjects = firebaseProjectsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || null
    }));

    // Get all project mappings (new system)
    const projectMappings = await ProjectMappingService.getAllProjects();

    // Analyze current state
    const analysis = {
      totalChatbots: chatbots.length,
      activeChatbots: chatbots.filter(c => c.status === 'active' || c.deployment?.deploymentUrl).length,
      totalFirebaseProjects: firebaseProjects.length,
      totalProjectMappings: projectMappings.length,
      availablePoolProjects: projectMappings.filter(p => p.status === 'available' && p.projectType === 'pool').length,
      inUseProjects: projectMappings.filter(p => p.status === 'in-use').length,
      dedicatedProjects: projectMappings.filter(p => p.projectType === 'dedicated').length,
      poolProjects: projectMappings.filter(p => p.projectType === 'pool').length
    };

    // Find orphaned chatbots (chatbots without project mappings)
    const orphanedChatbots = chatbots.filter(chatbot => {
      const hasMapping = projectMappings.some(p => p.chatbotId === chatbot.id);
      const hasOldProject = firebaseProjects.some(p => p.chatbotId === chatbot.id);
      return !hasMapping && !hasOldProject && (chatbot.status === 'active' || chatbot.deployment?.deploymentUrl);
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      analysis,
      chatbots: chatbots.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        deploymentUrl: c.deployment?.deploymentUrl,
        firebaseProjectId: c.firebaseProjectId,
        createdAt: c.createdAt,
        userId: c.userId
      })),
      firebaseProjects: firebaseProjects.map(p => ({
        id: p.id,
        projectId: p.projectId,
        chatbotId: p.chatbotId,
        status: p.status,
        createdAt: p.createdAt
      })),
      projectMappings: projectMappings.map(p => ({
        projectId: p.projectId,
        chatbotId: p.chatbotId,
        userId: p.userId,
        status: p.status,
        projectType: p.projectType,
        lastUsedAt: p.lastUsedAt,
        vercelUrl: p.vercelUrl
      })),
      orphanedChatbots: orphanedChatbots.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        deploymentUrl: c.deployment?.deploymentUrl,
        userId: c.userId
      })),
      recommendations: {
        needsMigration: orphanedChatbots.length > 0,
        hasLegacyProjects: firebaseProjects.length > 0,
        poolHealth: analysis.availablePoolProjects > 0 ? 'healthy' : 'needs-projects'
      }
    });

  } catch (error: any) {
    console.error('❌ System status error:', error);
    return NextResponse.json({
      error: `Failed to get system status: ${error.message}`
    }, { status: 500 });
  }
}