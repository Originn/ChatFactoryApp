import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin/index';
import { ProjectMappingService } from '@/services/projectMappingService';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'No authorization token provided' }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const status = searchParams.get('status');
    const projectId = searchParams.get('projectId');

    switch (action) {
      case 'list':
        console.log('📋 Listing projects with status filter:', status || 'all');
        const projects = await ProjectMappingService.getAllProjects(
          status as 'available' | 'in-use' | 'recycling' | 'maintenance' | undefined
        );

        return NextResponse.json({
          success: true,
          projects,
          summary: {
            total: projects.length,
            available: projects.filter(p => p.status === 'available').length,
            inUse: projects.filter(p => p.status === 'in-use').length,
            recycling: projects.filter(p => p.status === 'recycling').length,
            maintenance: projects.filter(p => p.status === 'maintenance').length
          }
        });

      case 'sync':
        console.log('🔄 Syncing project status between Firestore and secrets...');
        const syncResult = await ProjectMappingService.syncProjectStatus(projectId || undefined);

        return NextResponse.json({
          success: syncResult.success,
          message: syncResult.message,
          details: syncResult.details
        });

      case 'health':
        console.log('🏥 Performing project health check...');

        // Get all projects and perform basic health checks
        const allProjects = await ProjectMappingService.getAllProjects();
        const healthResults = {
          totalProjects: allProjects.length,
          healthyProjects: 0,
          issues: [] as any[]
        };

        for (const project of allProjects) {
          let isHealthy = true;
          const projectIssues: string[] = [];

          // Check for stale in-use projects (over 24 hours without update)
          const now = new Date();
          const hoursSinceLastUsed = (now.getTime() - project.lastUsedAt.getTime()) / (1000 * 60 * 60);

          if (project.status === 'in-use' && hoursSinceLastUsed > 24) {
            isHealthy = false;
            projectIssues.push(`Project has been in-use for ${Math.round(hoursSinceLastUsed)} hours without update`);
          }

          // Check for projects without chatbot assignments
          if (project.status === 'in-use' && !project.chatbotId) {
            isHealthy = false;
            projectIssues.push('Project marked as in-use but has no chatbot assignment');
          }

          // Check for projects in recycling state for too long
          if (project.status === 'recycling' && hoursSinceLastUsed > 2) {
            isHealthy = false;
            projectIssues.push(`Project has been in recycling state for ${Math.round(hoursSinceLastUsed)} hours`);
          }

          if (isHealthy) {
            healthResults.healthyProjects++;
          } else {
            healthResults.issues.push({
              projectId: project.projectId,
              projectType: project.projectType,
              status: project.status,
              chatbotId: project.chatbotId,
              lastUsedAt: project.lastUsedAt,
              issues: projectIssues
            });
          }
        }

        return NextResponse.json({
          success: true,
          health: healthResults,
          message: `Health check completed: ${healthResults.healthyProjects}/${healthResults.totalProjects} projects healthy`
        });

      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: list, sync, health'
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Project management API error:', error);
    return NextResponse.json({
      error: `Failed to process request: ${error.message}`
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'No authorization token provided' }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const body = await request.json();
    const { action, projectId, metadata, projectType } = body;

    switch (action) {
      case 'add-to-pool':
        if (!projectId || !metadata) {
          return NextResponse.json({
            error: 'Missing required fields: projectId, metadata'
          }, { status: 400 });
        }

        console.log(`➕ Adding project ${projectId} to ${projectType || 'pool'} pool`);
        const addResult = await ProjectMappingService.addProjectToPool(
          projectId,
          metadata,
          projectType || 'pool'
        );

        return NextResponse.json({
          success: addResult.success,
          message: addResult.message,
          details: addResult.details
        });

      case 'sync-all':
        console.log('🔄 Syncing all project statuses...');
        const syncAllResult = await ProjectMappingService.syncProjectStatus();

        return NextResponse.json({
          success: syncAllResult.success,
          message: syncAllResult.message,
          details: syncAllResult.details
        });

      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: add-to-pool, sync-all'
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Project management POST API error:', error);
    return NextResponse.json({
      error: `Failed to process request: ${error.message}`
    }, { status: 500 });
  }
}