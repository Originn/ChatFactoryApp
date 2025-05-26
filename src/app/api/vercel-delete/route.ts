import { NextRequest, NextResponse } from 'next/server';
import { Vercel } from '@vercel/sdk';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, projectName } = body;

    if (!projectId && !projectName) {
      return NextResponse.json({ 
        error: 'Missing required parameter: projectId or projectName' 
      }, { status: 400 });
    }

    const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
    if (!VERCEL_API_TOKEN) {
      return NextResponse.json({ 
        error: 'Vercel API token not configured on server'
      }, { status: 500 });
    }

    // Initialize Vercel SDK
    const vercel = new Vercel({
      bearerToken: VERCEL_API_TOKEN,
    });

    // Use projectId if available, otherwise use projectName
    const idOrName = projectId || projectName;

    console.log(`Attempting to delete Vercel project: ${idOrName}`);

    try {
      // Delete the project from Vercel
      await vercel.projects.deleteProject({
        idOrName: idOrName,
      });

      console.log(`✅ Successfully deleted Vercel project: ${idOrName}`);

      return NextResponse.json({
        success: true,
        message: `Project ${idOrName} deleted successfully from Vercel`,
        deletedProject: idOrName
      });

    } catch (vercelError: any) {
      console.error('Vercel deletion error:', vercelError);
      
      // If project doesn't exist, we can consider it a success
      if (vercelError.status === 404 || vercelError.message?.includes('not found')) {
        console.log(`⚠️  Project ${idOrName} not found in Vercel (may have been already deleted)`);
        return NextResponse.json({
          success: true,
          message: `Project ${idOrName} not found in Vercel (may have been already deleted)`,
          deletedProject: idOrName
        });
      }
      
      // For other errors, return the error
      return NextResponse.json({ 
        error: `Failed to delete project from Vercel: ${vercelError.message || 'Unknown error'}`,
        details: vercelError
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ 
      error: `Error processing delete request: ${error.message}` 
    }, { status: 500 });
  }
}
