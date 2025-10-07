import { NextRequest, NextResponse } from 'next/server';
import { Vercel } from '@vercel/sdk';

/**
 * DELETE Vercel Project API
 * Handles deletion of Vercel projects securely on the server side
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, projectName } = await request.json();

    if (!projectId && !projectName) {
      return NextResponse.json(
        { success: false, message: 'Missing projectId or projectName' },
        { status: 400 }
      );
    }

    const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;

    if (!VERCEL_API_TOKEN) {
      console.warn('⚠️ VERCEL_API_TOKEN not configured');
      return NextResponse.json(
        { success: false, message: 'Vercel API token not configured' },
        { status: 500 }
      );
    }

    const vercel = new Vercel({ bearerToken: VERCEL_API_TOKEN });
    const idOrName = projectId || projectName;

    console.log(`🎯 Attempting to delete Vercel project: ${idOrName}`);

    try {
      await vercel.projects.deleteProject({ idOrName });
      console.log(`✅ Successfully deleted Vercel project: ${idOrName}`);

      return NextResponse.json({
        success: true,
        message: `Vercel project ${idOrName} deleted successfully`
      });
    } catch (vercelError: any) {
      if (vercelError.status === 404 || vercelError.message?.includes('not found')) {
        console.log(`⚠️ Vercel project ${idOrName} not found (may have been already deleted)`);
        return NextResponse.json({
          success: true,
          message: `Vercel project ${idOrName} not found (already deleted)`
        });
      } else {
        console.error('❌ Vercel deletion error:', vercelError);
        return NextResponse.json(
          { success: false, message: vercelError.message || 'Failed to delete Vercel project' },
          { status: 500 }
        );
      }
    }
  } catch (error: any) {
    console.error('❌ Error in Vercel deletion API:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}