import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ 
        error: 'Valid email address is required' 
      }, { status: 400 });
    }

    // Check if email already exists in waitlist
    const existingUser = await adminDb
      .collection('waitlist')
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();

    if (!existingUser.empty) {
      return NextResponse.json({ 
        message: 'You are already on our waitlist!',
        alreadyExists: true 
      });
    }

    // Add email to waitlist
    const waitlistEntry = {
      email: email.toLowerCase(),
      signupDate: new Date().toISOString(),
      source: 'coming-soon-page',
      userAgent: request.headers.get('user-agent') || '',
      ip: request.headers.get('x-forwarded-for') || 
          request.headers.get('x-real-ip') || 
          'unknown'
    };

    const docRef = await adminDb.collection('waitlist').add(waitlistEntry);

    console.log(`🎉 New waitlist signup: ${email} (ID: ${docRef.id})`);

    return NextResponse.json({
      success: true,
      message: 'Successfully joined the waitlist!',
      id: docRef.id
    });

  } catch (error) {
    console.error('Waitlist signup error:', error);
    
    return NextResponse.json({ 
      error: 'Failed to join waitlist. Please try again.' 
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Get waitlist statistics (admin only - add proper auth in production)
    const waitlistSnapshot = await adminDb.collection('waitlist').get();
    const totalCount = waitlistSnapshot.size;

    return NextResponse.json({
      totalSignups: totalCount,
      message: `${totalCount} users on waitlist`
    });

  } catch (error) {
    console.error('Waitlist stats error:', error);
    return NextResponse.json({ 
      error: 'Failed to get waitlist stats' 
    }, { status: 500 });
  }
}