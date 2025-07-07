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
    } else {
      console.log(`✅ No zero-byte placeholder files found`);
    }
    
    // Final verification
    const [finalFiles] = await bucket.getFiles({
      maxResults: 10
    });
    
    console.log(`🔍 Final check: ${finalFiles.length} files remaining`);
    if (finalFiles.length > 0) {
      console.log(`📋 Remaining files:`);
      finalFiles.forEach(file => console.log(`  - ${file.name} (size: ${file.metadata?.size || 'unknown'})`));
    }
    
    return NextResponse.json({
      success: true,
      message: `Nuclear cleanup completed. Deleted zero-byte placeholder objects. ${finalFiles.length} files remaining.`,
      remainingFiles: finalFiles.map(f => ({ name: f.name, size: f.metadata?.size || 'unknown' }))
    });
    
  } catch (error: any) {
    console.error('❌ Nuclear cleanup failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
