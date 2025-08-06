import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  return NextResponse.json(
    { 
      error: 'YouTube authentication temporarily disabled',
      message: 'YouTube integration has been temporarily removed due to technical issues. This feature will be restored soon with a better implementation.'
    },
    { status: 503 }
  );
}