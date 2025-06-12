import { NextRequest, NextResponse } from 'next/server';
import { ReusableFirebaseProjectService } from '@/services/reusableFirebaseProjectService';

/**
 * API endpoint for complete factory reset of the reusable Firebase project
 * This endpoint will wipe ALL data, users, and credentials from the project
 * making it like a brand new Firebase project
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, confirmToken } = body;

    // Safety check - require confirmation token
    if (confirmToken !== 'FACTORY_RESET_CONFIRMED') {
      return NextResponse.json({ 
        error: 'Invalid confirmation token. This operation requires explicit confirmation.' 
      }, { status: 400 });
    }

    console.log('🏭 API: Starting complete factory reset of Firebase project');
    console.log('⚠️  This will delete ALL data, users, and credentials!');

    // Call the factory reset service
    const resetResult = await ReusableFirebaseProjectService.factoryResetProject(projectId);

    if (resetResult.success) {
      console.log('✅ API: Factory reset completed successfully');
      
      return NextResponse.json({
        success: true,
        message: resetResult.message,
        details: resetResult.details,
        warning: 'All data, users, and credentials have been wiped from the project'
      });
    } else {
      console.error('❌ API: Factory reset failed:', resetResult.message);
      
      return NextResponse.json({
        success: false,
        error: `Factory reset failed: ${resetResult.message}`,
        details: resetResult.details
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('❌ API: Error during factory reset:', error);
    
    return NextResponse.json({ 
      error: `Factory reset error: ${error.message}`,
      details: error
    }, { status: 500 });
  }
}

/**
 * GET endpoint to check factory reset status and requirements
 */
export async function GET(request: NextRequest) {
  try {
    const projectId = process.env.REUSABLE_FIREBASE_PROJECT_ID;
    
    return NextResponse.json({
      success: true,
      message: 'Factory reset endpoint is available',
      projectId,
      reusableMode: process.env.USE_REUSABLE_FIREBASE_PROJECT === 'true',
      requirements: {
        confirmToken: 'FACTORY_RESET_CONFIRMED',
        warning: 'This operation will delete ALL data, users, and credentials from the Firebase project'
      }
    });

  } catch (error: any) {
    console.error('❌ API: Error checking factory reset status:', error);
    
    return NextResponse.json({ 
      error: `Status check failed: ${error.message}` 
    }, { status: 500 });
  }
}