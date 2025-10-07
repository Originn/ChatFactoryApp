import { NextRequest, NextResponse } from 'next/server';
import { FirestoreSecretService } from '@/services/firestoreSecretService';

/**
 * API endpoint to update pool service account credentials in Firestore
 * Used by deployment scripts to upload keys after pool creation
 */
export async function POST(request: NextRequest) {
  try {
    const { poolNumber, privateKey, clientEmail } = await request.json();

    if (!poolNumber || !privateKey || !clientEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: poolNumber, privateKey, clientEmail' },
        { status: 400 }
      );
    }

    // Validate pool number format (e.g., "001", "025")
    if (!/^\d{3}$/.test(poolNumber)) {
      return NextResponse.json(
        { error: 'poolNumber must be 3 digits (e.g., "001", "025")' },
        { status: 400 }
      );
    }

    console.log(`🔐 Updating pool-${poolNumber} credentials in Firestore...`);
    console.log(`📧 Client Email: ${clientEmail}`);
    console.log(`🔑 Private Key length: ${privateKey.length} chars`);

    // Store the new credentials
    await FirestoreSecretService.setSecret(
      `pool-${poolNumber}-client-email`,
      clientEmail,
      {
        type: 'service_account_email',
        poolId: poolNumber,
        description: `Pool ${poolNumber} service account email`
      }
    );

    await FirestoreSecretService.setSecret(
      `pool-${poolNumber}-private-key`,
      privateKey,
      {
        type: 'service_account_key',
        poolId: poolNumber,
        description: `Pool ${poolNumber} service account key`
      }
    );

    console.log(`✅ Successfully updated pool-${poolNumber} credentials in Firestore`);

    // Verify by reading them back
    const storedEmail = await FirestoreSecretService.getSecret(`pool-${poolNumber}-client-email`);
    const storedKey = await FirestoreSecretService.getSecret(`pool-${poolNumber}-private-key`);

    const emailMatch = storedEmail === clientEmail;
    const keyMatch = storedKey === privateKey;

    if (emailMatch && keyMatch) {
      console.log(`✅ Verification passed: Both credentials stored and retrieved successfully`);
    } else {
      console.warn(`⚠️ Verification issue: emailMatch=${emailMatch}, keyMatch=${keyMatch}`);
    }

    return NextResponse.json({
      success: true,
      message: `Pool-${poolNumber} credentials updated successfully`,
      verification: {
        emailMatch,
        keyMatch,
        emailLength: storedEmail?.length,
        keyLength: storedKey?.length
      }
    });

  } catch (error: any) {
    console.error('❌ Error updating pool credentials:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update credentials' },
      { status: 500 }
    );
  }
}
