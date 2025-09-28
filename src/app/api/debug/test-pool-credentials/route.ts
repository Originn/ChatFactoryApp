import { NextRequest, NextResponse } from 'next/server';
import { PoolCredentialsService } from '@/services/poolCredentialsService';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId') || 'chatfactory-pool-001';

    console.log(`🧪 Testing pool credentials for: ${projectId}`);

    const credentials = await PoolCredentialsService.getPoolServiceAccount(projectId);

    return NextResponse.json({
      projectId,
      clientEmail: credentials.clientEmail,
      hasPrivateKey: !!credentials.privateKey,
      privateKeyLength: credentials.privateKey?.length || 0,
      privateKeyStart: credentials.privateKey?.substring(0, 50) + '...',
      status: 'success'
    });

  } catch (error: any) {
    console.error('❌ Error testing pool credentials:', error);
    return NextResponse.json(
      {
        error: 'Failed to get pool credentials',
        details: error.message,
        status: 'error'
      },
      { status: 500 }
    );
  }
}