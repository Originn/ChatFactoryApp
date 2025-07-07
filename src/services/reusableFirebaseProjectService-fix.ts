// Fix for lines 850-900 of reusableFirebaseProjectService.ts
// Replace the cleanupStorageData function with correct bucket references

private static async cleanupStorageData(chatbotId: string, userId: string, aggressiveCleanup: boolean = false): Promise<void> {
  console.log(`🧹 Starting comprehensive storage cleanup for chatbot: ${chatbotId}, user: ${userId}`);
  console.log(`🔥 Aggressive cleanup mode: ${aggressiveCleanup ? 'ENABLED' : 'DISABLED'}`);
  
  // Get the reusable Firebase project ID
  const reusableProjectId = process.env.REUSABLE_FIREBASE_PROJECT_ID;
  
  if (!reusableProjectId) {
    console.error('❌ REUSABLE_FIREBASE_PROJECT_ID not set - cannot perform storage cleanup');
    return;
  }
  
  console.log(`🎯 Target Firebase project: ${reusableProjectId}`);
  
  // Initialize project-specific storage client
  const { Storage } = require('@google-cloud/storage');
  const credentials = {
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    project_id: process.env.FIREBASE_PROJECT_ID,
  };
  
  const projectSpecificStorage = new Storage({
    projectId: reusableProjectId,
    credentials: credentials
  });
  
  // Try different bucket names that might be used
  const possibleBuckets = [
    `${reusableProjectId}-chatbot-documents`,
    `${reusableProjectId}.appspot.com`,
    `${reusableProjectId}`,
    `${reusableProjectId}-default-rtdb`,
    `${reusableProjectId}-storage`,
  ];
  
  let workingBucket = null;
  
  // Find the correct bucket
  for (const bucketName of possibleBuckets) {
    try {
      const bucket = projectSpecificStorage.bucket(bucketName);
      await bucket.getMetadata();
      workingBucket = bucket;
      console.log(`✅ Found working bucket: ${bucketName}`);
      break;
    } catch (error) {
      console.log(`⚠️ Bucket ${bucketName} not found or inaccessible`);
    }
  }
  
  if (!workingBucket) {
    console.error('❌ No accessible storage bucket found for project:', reusableProjectId);
    return;
  }
  
  // Step 1: Clean specific known paths
  const pathsToClean = [
    `user-${userId}/chatbot-logos/chatbot-${chatbotId}/`,
    `user-${userId}/chatbot-documents/chatbot-${chatbotId}/`,
    `chatbots/${chatbotId}/`,
    `uploads/${chatbotId}/`,
    `pdfs/${chatbotId}/`,
    `documents/${chatbotId}/`,
    `chm/${chatbotId}/`,
    `${chatbotId}/`, // Root chatbot folder
  ];
  
  let totalFilesDeleted = 0;
  
  for (const path of pathsToClean) {
    try {
      console.log(`🗂️ Checking storage path: ${path}`);
      
      const [files] = await workingBucket.getFiles({
        prefix: path,
        maxResults: 5000 // Increased limit for thorough cleanup
      });
      
      if (files.length > 0) {
        console.log(`📁 Found ${files.length} files in ${path}`);
        
        // Delete files in batches
        const deletePromises = files.map(file => 
          file.delete().catch(error => {
            console.warn(`⚠️ Could not delete file ${file.name}:`, error);
          })
        );
        
        await Promise.all(deletePromises);
        totalFilesDeleted += files.length;
        
        console.log(`✅ Deleted ${files.length} files from ${path}`);
      } else {
        console.log(`ℹ️ No files found in ${path}`);
      }
      
    } catch (error) {
      console.warn(`⚠️ Could not clean up storage path ${path}:`, error);
    }
  }
  
  // Step 2: Comprehensive scan for any remaining files containing chatbot ID or user ID
  console.log(`🔍 Performing comprehensive scan for remaining files...`);
  
  try {
    const [allFiles] = await workingBucket.getFiles({
      maxResults: 10000 // Scan up to 10k files
    });
    
    console.log(`🔍 Scanning ${allFiles.length} total files for chatbot/user references...`);
    
    const filesToDelete = allFiles.filter(file => {
      const fileName = file.name;
      return (
        fileName.includes(chatbotId) || 
        fileName.includes(`user-${userId}`) ||
        fileName.includes(`chatbot-${chatbotId}`) ||
        fileName.includes(`/${chatbotId}/`) ||
        fileName.includes(`${chatbotId}.`) ||
        fileName.includes(`-${chatbotId}-`) ||
        fileName.includes(`_${chatbotId}_`)
      );
    });
    
    if (filesToDelete.length > 0) {
      console.log(`🎯 Found ${filesToDelete.length} additional files to delete:`);
      filesToDelete.forEach(file => console.log(`  - ${file.name}`));
      
      const deletePromises = filesToDelete.map(file => 
        file.delete().catch(error => {
          console.warn(`⚠️ Could not delete file ${file.name}:`, error);
        })
      );
      
      await Promise.all(deletePromises);
      totalFilesDeleted += filesToDelete.length;
      
      console.log(`✅ Deleted ${filesToDelete.length} additional files`);
    } else {
      console.log(`✅ No additional files found containing chatbot/user references`);
    }
  } catch (error) {
    console.warn(`⚠️ Could not perform comprehensive file scan:`, error);
  }
  
  // Step 3: Check for empty directories/buckets and clean them up
  console.log(`🧹 Checking for empty directories...`);
  
  try {
    // Check if any of the user's directories are now empty
    const userPaths = [
      `user-${userId}/chatbot-logos/`,
      `user-${userId}/chatbot-documents/`,
      `user-${userId}/`,
    ];
    
    for (const userPath of userPaths) {
      const [remainingFiles] = await workingBucket.getFiles({
        prefix: userPath,
        maxResults: 1
      });
      
      if (remainingFiles.length === 0) {
        console.log(`📁 Directory ${userPath} is now empty`);
        // Note: Firebase Storage doesn't have actual directories, so no need to delete
      }
    }
  } catch (error) {
    console.warn(`⚠️ Could not check for empty directories:`, error);
  }
  
  console.log(`✅ Comprehensive storage cleanup completed!`);
  console.log(`📊 Total files deleted: ${totalFilesDeleted}`);
  
  // Step 4: Log remaining files for verification (optional)
  if (totalFilesDeleted > 0) {
    console.log(`🔍 Verification: Checking for any remaining files...`);
    
    try {
      const [remainingFiles] = await workingBucket.getFiles({
        maxResults: 1000
      });
      
      const stillContainsChatbot = remainingFiles.filter(file => 
        file.name.includes(chatbotId) || file.name.includes(`user-${userId}`)
      );
      
      if (stillContainsChatbot.length > 0) {
        console.warn(`⚠️ Warning: ${stillContainsChatbot.length} files still contain chatbot/user references:`);
        stillContainsChatbot.forEach(file => console.warn(`  - ${file.name}`));
      } else {
        console.log(`✅ Verification passed: No remaining files found`);
      }
    } catch (error) {
      console.warn(`⚠️ Could not perform verification scan:`, error);
    }
  }
  
  // Step 5: Aggressive cleanup - attempt bucket cleanup if enabled
  if (aggressiveCleanup && totalFilesDeleted > 0) {
    console.log(`🔥 AGGRESSIVE CLEANUP: Checking if buckets can be deleted...`);
    
    try {
      const [allRemainingFiles] = await workingBucket.getFiles({
        maxResults: 100 // Just check if bucket is empty
      });
      
      if (allRemainingFiles.length === 0) {
        console.log(`🗑️ AGGRESSIVE CLEANUP: Storage bucket is now empty!`);
        console.log(`⚠️ Note: Bucket deletion requires manual intervention for safety`);
        console.log(`💡 You can manually delete the bucket from Firebase Console if no longer needed`);
      } else {
        console.log(`📁 AGGRESSIVE CLEANUP: Storage bucket still contains ${allRemainingFiles.length} files from other chatbots`);
      }
    } catch (error) {
      console.warn(`⚠️ Could not check bucket status for aggressive cleanup:`, error);
    }
  }
}
