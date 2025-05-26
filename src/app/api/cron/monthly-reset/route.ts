// src/app/api/cron/monthly-reset/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { UsageTrackingService } from '@/services/usageTrackingService';

// This endpoint should be called by a cron job on the 1st of each month
// Vercel Cron: https://vercel.com/docs/cron-jobs
// Example: 0 0 1 * * (runs at midnight on the 1st of every month)

export async function POST(request: NextRequest) {
  try {
    // Verify the request is from authorized source (cron job)
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET_TOKEN;
    
    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting monthly usage reset...');
    
    // Get all users who need monthly reset
    const usersToReset = await getUsersNeedingReset();
    console.log(`Found ${usersToReset.length} users needing reset`);

    // Reset usage for each user
    const resetPromises = usersToReset.map(async (userId) => {
      try {
        await UsageTrackingService.resetMonthlyUsage(userId);
        console.log(`Reset usage for user: ${userId}`);
        return { userId, success: true };
      } catch (error) {
        console.error(`Failed to reset usage for user ${userId}:`, error);
        return { userId, success: false, error: error.message };
      }
    });

    const results = await Promise.allSettled(resetPromises);
    
    // Calculate success/failure stats
    const successful = results.filter(r => 
      r.status === 'fulfilled' && r.value.success
    ).length;
    const failed = results.filter(r => 
      r.status === 'rejected' || 
      (r.status === 'fulfilled' && !r.value.success)
    ).length;

    console.log(`Monthly reset completed: ${successful} successful, ${failed} failed`);

    return NextResponse.json({
      success: true,
      message: `Monthly reset completed: ${successful} successful, ${failed} failed`,
      stats: { total: usersToReset.length, successful, failed }
    });

  } catch (error) {
    console.error('Monthly reset failed:', error);
    return NextResponse.json(
      { success: false, error: 'Monthly reset failed' },
      { status: 500 }
    );
  }
}

// Get users who need monthly usage reset
async function getUsersNeedingReset(): Promise<string[]> {
  try {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Get the first day of the current month
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    
    // Query users whose lastResetAt is before this month
    const usersRef = collection(db, 'users');
    const usersQuery = query(
      usersRef,
      where('usage.lastResetAt', '<', Timestamp.fromDate(firstDayOfMonth))
    );
    
    const usersSnapshot = await getDocs(usersQuery);
    return usersSnapshot.docs.map(doc => doc.id);
    
  } catch (error) {
    console.error('Failed to get users needing reset:', error);
    return [];
  }
}

// GET endpoint for checking reset status (for debugging)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET_TOKEN;
    
    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const usersNeedingReset = await getUsersNeedingReset();
    
    return NextResponse.json({
      usersNeedingReset: usersNeedingReset.length,
      nextResetDate: getNextResetDate(),
      currentMonth: new Date().getMonth() + 1,
      currentYear: new Date().getFullYear()
    });

  } catch (error) {
    console.error('Failed to check reset status:', error);
    return NextResponse.json(
      { error: 'Failed to check reset status' },
      { status: 500 }
    );
  }
}

function getNextResetDate(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString();
}
