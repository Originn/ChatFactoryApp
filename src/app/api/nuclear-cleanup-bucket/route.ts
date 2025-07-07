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
    
    // Method 1: Delete all files using bulk operation
    console.log(`🔥 Method 1: Bulk deleting all files...`);
    try {
      await bucket.deleteFiles({
        force: true,
        maxResults: 10000
      });
      console.log(`✅ Bulk deletion completed`);
    } catch (error: any) {
      console.warn(`⚠️ Bulk deletion failed:`, error.message);
    }
    
    // Method 2: List and delete everything individually
    console.log(`🔥 Method 2: Individual file deletion...`);
    const [files] = await bucket.getFiles({
      maxResults: 10000,
      includeTrailingDelimiter: true,
      delimiter: ''
    });
    
    console.log(`📋 Found ${files.length} files/folders to delete`);
    
    if (files.length > 0) {
      // Delete in batches of 100
      const batchSize = 100;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const deletePromises = batch.map(file => 
          file.delete().catch(error => {
            console.warn(`⚠️ Could not delete ${file.name}:`, error.message);
          })
        );
        
        await Promise.all(deletePromises);
        console.log(`✅ Deleted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(files.length/batchSize)}`);
      }
    }
    
    // Method 3: Try to delete any remaining folder markers
    console.log(`🔥 Method 3: Cleaning folder markers...`);
    try {
      const folderMarkers = [
        'private_pdfs/',
        'public_pdfs/',
        'user-',
        'chatbots/',
        'uploads/',
        'pdfs/',
        'documents/',
        'chm/'
      ];
      
      for (const marker of folderMarkers) {
        try {
          await bucket.deleteFiles({
            prefix: marker,
            force: true
          });
          console.log(`✅ Cleaned folder marker: ${marker}`);
        } catch (error: any) {
          console.warn(`⚠️ Could not clean ${marker}:`, error.message);
        }
      }
    } catch (error: any) {
      console.warn(`⚠️ Could not clean folder markers:`, error.message);
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
