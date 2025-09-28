import { NextRequest, NextResponse } from 'next/server';
import { getAuthClient } from '@/lib/gcp-auth';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId') || 'chatfactory-pool-001';

    console.log(`🔍 Checking secret for project: ${projectId}`);

    const authClient = await getAuthClient();
    const secretManager = google.secretmanager('v1');
    const secretName = `projects/${projectId}/secrets/project-in-use/versions/latest`;

    console.log(`🔐 Secret path: ${secretName}`);

    const response = await secretManager.projects.secrets.versions.access({
      name: secretName,
      auth: authClient
    });

    const rawData = response.data.payload?.data || '';
    const secretValue = Buffer.from(rawData, 'base64').toString();
    const trimmedValue = secretValue.trim();
    const booleanResult = trimmedValue === 'true';

    console.log(`🔍 Raw secret data: "${rawData}"`);
    console.log(`🔍 Decoded secret: "${secretValue}"`);
    console.log(`🔍 Trimmed secret: "${trimmedValue}"`);
    console.log(`🔍 Boolean result: ${booleanResult}`);

    return NextResponse.json({
      projectId,
      secretPath: secretName,
      rawData,
      decodedValue: secretValue,
      trimmedValue,
      booleanResult,
      isInUse: booleanResult
    });

  } catch (error: any) {
    console.error('❌ Error checking secret:', error);
    return NextResponse.json(
      {
        error: 'Failed to check secret',
        details: error.message,
        code: error.code
      },
      { status: 500 }
    );
  }
}