import { NextRequest, NextResponse } from 'next/server';
import { ProjectMappingService } from '@/services/projectMappingService';

/**
 * API endpoint for pool management scripts to register/sync projects
 * This endpoint can be called without authentication for pool management automation
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, projectId, projectName, region = 'us-central1', billingAccountId } = body;

    if (!action || !projectId) {
      return NextResponse.json({
        error: 'Missing required fields: action, projectId'
      }, { status: 400 });
    }

    switch (action) {
      case 'register':
        if (!projectName) {
          return NextResponse.json({
            error: 'Missing required field: projectName'
          }, { status: 400 });
        }

        console.log(`🏭 Registering pool project: ${projectId}`);

        const metadata = {
          projectName,
          region,
          billingAccountId: billingAccountId || process.env.BILLING_ACCOUNT_ID || ''
        };

        const registerResult = await ProjectMappingService.addProjectToPool(
          projectId,
          metadata,
          'pool'
        );

        if (registerResult.success) {
          console.log(`✅ Successfully registered pool project: ${projectId}`);
        } else {
          console.error(`❌ Failed to register pool project ${projectId}:`, registerResult.message);
        }

        return NextResponse.json({
          success: registerResult.success,
          message: registerResult.message,
          projectId,
          status: 'available'
        });

      case 'mark-available':
        console.log(`🔓 Marking project as available: ${projectId}`);

        // This is typically called when a pool project is initially created
        // or when we want to manually mark a project as available
        const releaseResult = await ProjectMappingService.releaseProject(projectId, 'pool-init');

        return NextResponse.json({
          success: releaseResult.success,
          message: releaseResult.message || `Project ${projectId} marked as available`,
          projectId,
          status: 'available'
        });

      case 'sync-status':
        console.log(`🔄 Syncing status for project: ${projectId}`);

        const syncResult = await ProjectMappingService.syncProjectStatus(projectId);

        return NextResponse.json({
          success: syncResult.success,
          message: syncResult.message,
          details: syncResult.details
        });

      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: register, mark-available, sync-status'
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Pool management API error:', error);
    return NextResponse.json({
      error: `Failed to process request: ${error.message}`,
      details: error.stack
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      // Return summary of all pool projects
      console.log('📋 Getting pool projects summary');
      const projects = await ProjectMappingService.getAllProjects();
      const poolProjects = projects.filter(p => p.projectType === 'pool');

      return NextResponse.json({
        success: true,
        summary: {
          totalPoolProjects: poolProjects.length,
          available: poolProjects.filter(p => p.status === 'available').length,
          inUse: poolProjects.filter(p => p.status === 'in-use').length,
          recycling: poolProjects.filter(p => p.status === 'recycling').length,
          maintenance: poolProjects.filter(p => p.status === 'maintenance').length
        },
        projects: poolProjects.map(p => ({
          projectId: p.projectId,
          status: p.status,
          chatbotId: p.chatbotId,
          lastUsedAt: p.lastUsedAt,
          metadata: p.metadata
        }))
      });
    } else {
      // Return status of specific project
      console.log(`🔍 Getting status for project: ${projectId}`);
      const projects = await ProjectMappingService.getAllProjects();
      const project = projects.find(p => p.projectId === projectId);

      if (!project) {
        return NextResponse.json({
          error: 'Project not found in mapping service'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        project: {
          projectId: project.projectId,
          status: project.status,
          chatbotId: project.chatbotId,
          userId: project.userId,
          projectType: project.projectType,
          lastUsedAt: project.lastUsedAt,
          createdAt: project.createdAt,
          deployedAt: project.deployedAt,
          recycledAt: project.recycledAt,
          vercelUrl: project.vercelUrl,
          metadata: project.metadata
        }
      });
    }

  } catch (error: any) {
    console.error('Pool management GET API error:', error);
    return NextResponse.json({
      error: `Failed to get project status: ${error.message}`
    }, { status: 500 });
  }
}