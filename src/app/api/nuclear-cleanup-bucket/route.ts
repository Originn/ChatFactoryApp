import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();
    
    if (!projectId) {
      return NextResponse.json({ 
        success: false, 
        error: 'projectId is required' 
      }, { status: 400 });
    }
    
    console.log(`💥 NUCLEAR CLEANUP: Completely wiping ALL buckets in project ${projectId}...`);
    
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
    
    // Get ALL buckets in the project
    let allBuckets;
    try {
      [allBuckets] = await storage.getBuckets();
      console.log(`📦 Found ${allBuckets.length} buckets in project ${projectId}`);
    } catch (error: any) {
      console.error(`❌ Could not list buckets in project ${projectId}:`, error.message);
      return NextResponse.json({ 
        success: false, 
        error: `Could not list buckets: ${error.message}` 
      }, { status: 500 });
    }
    
    let totalFilesDeleted = 0;
    const bucketResults = [];
    
    // Process each bucket
    for (const bucket of allBuckets) {
      try {
        console.log(`\n🧹 Processing bucket: ${bucket.name}`);
        const bucketResult = await cleanupBucket(bucket);
        bucketResults.push(bucketResult);
        totalFilesDeleted += bucketResult.filesDeleted;
      } catch (error: any) {
        console.error(`❌ Error processing bucket ${bucket.name}:`, error.message);
        bucketResults.push({
          bucketName: bucket.name,
          success: false,
          error: error.message,
          filesDeleted: 0
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Nuclear cleanup completed across ${allBuckets.length} buckets. Total files deleted: ${totalFilesDeleted}`,
      bucketResults: bucketResults
    });
    
  } catch (error: any) {
    console.error('❌ Nuclear cleanup failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

async function cleanupBucket(bucket: any) {
  console.log(`🧹 Cleaning bucket: ${bucket.name}`);
  
  let filesDeleted = 0;
  
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
    filesDeleted += files.length;
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
  
  // Method 4: CRITICAL - Delete zero-byte placeholder objects (Google's official solution)
  console.log(`🔥 Method 4: Deleting zero-byte placeholder objects...`);
  
  const folderPlaceholders = [
    'private_pdfs/',
    'public_pdfs/',
    'user-',
    'chatbots/',
    'uploads/',
    'pdfs/',
    'documents/',
    'chm/'
  ];
  
  for (const placeholder of folderPlaceholders) {
    try {
      // Delete the zero-byte placeholder object that represents the empty folder
      const placeholderFile = bucket.file(placeholder);
      await placeholderFile.delete({ ignoreNotFound: true });
      
      console.log(`✅ Deleted zero-byte placeholder: ${placeholder}`);
    } catch (error: any) {
      console.warn(`⚠️ Could not delete placeholder ${placeholder}:`, error.message);
    }
  }
  
  // Method 5: Scan for any remaining zero-byte placeholder objects
  console.log(`🔥 Method 5: Scanning for remaining zero-byte placeholder objects...`);
  
  const [remainingFiles] = await bucket.getFiles({
    maxResults: 1000
  });
  
  // Look for zero-byte files that end with '/' (folder placeholders)
  const placeholderFiles = remainingFiles.filter(file => {
    const metadata = file.metadata;
    return (
      file.name.endsWith('/') ||                    // Ends with slash (folder marker)
      (metadata && metadata.size === '0') ||        // Zero-byte file
      file.name.includes('_$folder$') ||            // Common folder marker pattern
      file.name.includes('.folder')                 // Another folder marker pattern
    );
  });
  
  if (placeholderFiles.length > 0) {
    console.log(`📁 Found ${placeholderFiles.length} zero-byte placeholder files to delete:`);
    placeholderFiles.forEach(file => console.log(`  - ${file.name} (size: ${file.metadata?.size || 'unknown'})`));
    
    const deletePromises = placeholderFiles.map(file => 
      file.delete({ ignoreNotFound: true }).catch(error => {
        console.warn(`⚠️ Could not delete placeholder file ${file.name}:`, error.message);
      })
    );
    
    await Promise.all(deletePromises);
    console.log(`✅ Deleted ${placeholderFiles.length} zero-byte placeholder files`);
    filesDeleted += placeholderFiles.length;
  } else {
    console.log(`✅ No zero-byte placeholder files found`);
  }
  
  // Final verification
  const [finalFiles] = await bucket.getFiles({
    maxResults: 10
  });
  
  console.log(`🔍 Final check: ${finalFiles.length} files remaining in bucket ${bucket.name}`);
  if (finalFiles.length > 0) {
    console.log(`📋 Remaining files:`);
    finalFiles.forEach(file => console.log(`  - ${file.name} (size: ${file.metadata?.size || 'unknown'})`));
  }
  
  return {
    bucketName: bucket.name,
    success: true,
    filesDeleted: filesDeleted,
    remainingFiles: finalFiles.length,
    remainingFilesList: finalFiles.map(f => ({ name: f.name, size: f.metadata?.size || 'unknown' }))
  };
}
