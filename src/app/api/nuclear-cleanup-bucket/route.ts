import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

export async function POST(request: NextRequest) {
  try {
    const { bucketName, projectId } = await request.json();
    
    if (!bucketName || !projectId) {
      return NextResponse.json({ 
        success: false, 
        error: 'bucketName and projectId are required' 
      }, { status: 400 });
    }
    
    console.log(`💥 NUCLEAR CLEANUP: Completely wiping bucket ${bucketName}...`);
    
    // Initialize storage client
    const credentials = {
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      project_id: process.env.FIREBASE_PROJECT_ID,
    };
    
    const storage = new Storage({
      projectId: projectId,
      credentials: credentials
    });
    
    const bucket = storage.bucket(bucketName);
    
    // Method 1: CORRECT WAY - Use bucket.deleteFiles() to delete everything
    console.log(`🔥 Method 1: Using bucket.deleteFiles() to delete everything...`);
    try {
      await bucket.deleteFiles({
        force: true
      });
      console.log(`✅ Bulk deletion completed using deleteFiles()`);
    } catch (error: any) {
      console.warn(`⚠️ Bulk deletion failed:`, error.message);
    }
    
    // Method 2: Fallback - List and delete everything individually (if Method 1 fails)
    console.log(`🔥 Method 2: Fallback individual file deletion...`);
    const [files] = await bucket.getFiles();
    
    console.log(`📋 Found ${files.length} files to delete`);
    
    if (files.length > 0) {
      // Delete files individually as fallback
      const deletePromises = files.map(file => 
        file.delete().catch(error => {
          console.warn(`⚠️ Could not delete ${file.name}:`, error.message);
        })
      );
      
      await Promise.all(deletePromises);
      console.log(`✅ Deleted ${files.length} files individually`);
    }
    
    // Method 3: CORRECT WAY - Use deleteFiles() for specific folder patterns
    console.log(`🔥 Method 3: Using deleteFiles() for folder patterns...`);
    try {
      const folderPatterns = [
        'private_pdfs/',
        'public_pdfs/',
        'user-',
        'chatbots/',
        'uploads/',
        'pdfs/',
        'documents/',
        'chm/'
      ];
      
      for (const pattern of folderPatterns) {
        try {
          await bucket.deleteFiles({
            prefix: pattern,
            force: true
          });
          console.log(`✅ Deleted folder pattern: ${pattern}`);
        } catch (error: any) {
          console.warn(`⚠️ Could not delete pattern ${pattern}:`, error.message);
        }
      }
    } catch (error: any) {
      console.warn(`⚠️ Could not clean folder patterns:`, error.message);
    }
    
    // Final verification
    const [remainingFiles] = await bucket.getFiles({
      maxResults: 10
    });
    
    console.log(`🔍 Final check: ${remainingFiles.length} files remaining`);
    
    return NextResponse.json({
      success: true,
      message: `Nuclear cleanup completed. Deleted ${files.length} files. ${remainingFiles.length} files remaining.`,
      remainingFiles: remainingFiles.map(f => f.name)
    });
    
  } catch (error: any) {
    console.error('❌ Nuclear cleanup failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
