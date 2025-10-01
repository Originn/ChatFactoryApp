import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🔍 Checking Vercel environment variables for testbot...');

    // Get Vercel token from environment
    const vercelToken = process.env.VERCEL_API_TOKEN;
    if (!vercelToken) {
      return NextResponse.json(
        { error: 'VERCEL_API_TOKEN not found in environment' },
        { status: 400 }
      );
    }

    // Get the latest testbot project
    const projectsResponse = await fetch('https://api.vercel.com/v9/projects', {
      headers: {
        'Authorization': `Bearer ${vercelToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!projectsResponse.ok) {
      throw new Error(`Failed to fetch projects: ${projectsResponse.status}`);
    }

    const projectsData = await projectsResponse.json();
    const testbotProjects = projectsData.projects.filter((p: any) =>
      p.name.toLowerCase().includes('testbot')
    );

    console.log(`🔍 Found ${testbotProjects.length} testbot project(s)`);

    if (testbotProjects.length === 0) {
      return NextResponse.json({
        message: 'No testbot projects found',
        availableProjects: projectsData.projects.map((p: any) => ({
          name: p.name,
          id: p.id,
          createdAt: p.createdAt
        })).slice(0, 10)
      });
    }

    // Get the most recent testbot project
    const latestProject = testbotProjects.sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    console.log(`🎯 Using latest testbot project: ${latestProject.name} (${latestProject.id})`);

    // Get environment variables for this project
    const envResponse = await fetch(
      `https://api.vercel.com/v9/projects/${latestProject.id}/env`,
      {
        headers: {
          'Authorization': `Bearer ${vercelToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!envResponse.ok) {
      throw new Error(`Failed to fetch environment variables: ${envResponse.status}`);
    }

    const envData = await envResponse.json();
    console.log(`📊 Found ${envData.envs.length} environment variables`);

    // Categorize and analyze environment variables
    const firebaseVars = envData.envs.filter((env: any) =>
      env.key.toLowerCase().includes('firebase') ||
      env.key.toLowerCase().includes('fire') ||
      env.key === 'NEXT_PUBLIC_FIREBASE_API_KEY' ||
      env.key === 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN' ||
      env.key === 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
    );

    const nextPublicVars = envData.envs.filter((env: any) =>
      env.key.startsWith('NEXT_PUBLIC_')
    );

    const criticalVars = [
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      'NEXT_PUBLIC_FIREBASE_APP_ID',
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL',
      'OPENAI_API_KEY'
    ];

    const foundCritical = criticalVars.map(varName => {
      const envVar = envData.envs.find((env: any) => env.key === varName);
      return {
        name: varName,
        found: !!envVar,
        target: envVar?.target || 'N/A',
        type: envVar?.type || 'N/A',
        hasValue: envVar ? (envVar.value ? 'YES' : 'NO') : 'NO'
      };
    });

    const result = {
      projectInfo: {
        name: latestProject.name,
        id: latestProject.id,
        createdAt: latestProject.createdAt,
        framework: latestProject.framework
      },
      summary: {
        totalEnvVars: envData.envs.length,
        firebaseVars: firebaseVars.length,
        nextPublicVars: nextPublicVars.length,
        criticalVarsMissing: foundCritical.filter(v => !v.found).length
      },
      criticalVariables: foundCritical,
      firebaseVariables: firebaseVars.map((env: any) => ({
        key: env.key,
        target: env.target,
        type: env.type,
        hasValue: env.value ? 'YES' : 'NO',
        valuePreview: env.value ? `${env.value.substring(0, 20)}...` : 'NO VALUE'
      })),
      nextPublicVariables: nextPublicVars.map((env: any) => ({
        key: env.key,
        target: env.target,
        type: env.type,
        hasValue: env.value ? 'YES' : 'NO'
      })),
      missingCritical: foundCritical.filter(v => !v.found).map(v => v.name)
    };

    console.log('📋 Environment variable analysis:', JSON.stringify(result.summary, null, 2));

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('❌ Error checking Vercel environment variables:', error);
    return NextResponse.json(
      {
        error: 'Failed to check Vercel environment variables',
        details: error.message
      },
      { status: 500 }
    );
  }
}