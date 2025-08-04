import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin/index';
import crypto from 'crypto';

// Simple encryption for API keys (in production, use proper key management)
const ENCRYPTION_KEY = process.env.YOUTUBE_KEYS_ENCRYPTION_KEY || 'your-32-character-secret-key-here!!';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = textParts.join(':');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt token');
  }
}

export async function POST(req: NextRequest) {
  try {
    const { keys, userId } = await req.json();

    if (!keys || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Validate API keys format
    if (!keys.clientId || !keys.clientSecret || !keys.apiKey) {
      return NextResponse.json(
        { error: 'Invalid API keys format' },
        { status: 400 }
      );
    }

    // Encrypt the API keys
    const encryptedKeys = {
      clientId: encrypt(keys.clientId),
      clientSecret: encrypt(keys.clientSecret),
      apiKey: encrypt(keys.apiKey),
    };

    // Save to Firestore
    await adminDb.collection('youtube_api_keys').doc(userId).set({
      encryptedKeys,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving YouTube API keys:', error);
    return NextResponse.json(
      { error: 'Failed to save API keys' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Get from Firestore
    const doc = await adminDb.collection('youtube_api_keys').doc(userId).get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'API keys not found' },
        { status: 404 }
      );
    }

    const data = doc.data();
    
    if (!data?.encryptedKeys) {
      return NextResponse.json(
        { error: 'Invalid API keys data' },
        { status: 500 }
      );
    }

    // Decrypt the API keys
    const keys = {
      clientId: decrypt(data.encryptedKeys.clientId),
      clientSecret: decrypt(data.encryptedKeys.clientSecret),
      apiKey: decrypt(data.encryptedKeys.apiKey),
    };

    return NextResponse.json({ keys });
  } catch (error) {
    console.error('Error loading YouTube API keys:', error);
    return NextResponse.json(
      { error: 'Failed to load API keys' },
      { status: 500 }
    );
  }
}