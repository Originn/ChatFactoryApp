import { storage } from '@/lib/firebase/config';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';

/**
 * Upload a logo file to Firebase Storage
 * @param file - The image file to upload
 * @param userId - The user ID (for organizing files)
 * @param chatbotId - The chatbot ID (for unique naming)
 * @returns Promise<string> - The download URL of the uploaded image
 */
export async function uploadLogo(file: File, userId: string, chatbotId: string): Promise<string> {
  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    throw new Error('Invalid file type. Please upload a JPEG, PNG, GIF, SVG, or WebP image.');
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB in bytes
  if (file.size > maxSize) {
    throw new Error('File size too large. Please upload an image smaller than 5MB.');
  }

  try {
    // Create a reference to the storage location with descriptive prefixes
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `logo_${timestamp}.${fileExtension}`;
    const storageRef = ref(storage, `user-${userId}/chatbot-logos/chatbot-${chatbotId}/${fileName}`);

    console.log('Uploading logo to Firebase Storage...');
    console.log('Storage path:', `user-${userId}/chatbot-logos/chatbot-${chatbotId}/${fileName}`);
    console.log('File size:', file.size, 'bytes');
    console.log('File type:', file.type);

    // Upload the file with metadata
    const metadata = {
      contentType: file.type,
      customMetadata: {
        uploadedBy: userId,
        chatbotId: chatbotId,
        originalName: file.name
      }
    };

    const snapshot = await uploadBytes(storageRef, file, metadata);
    console.log('Upload successful, getting download URL...');

    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('Logo uploaded successfully:', downloadURL);

    return downloadURL;
  } catch (error: any) {
    console.error('Error uploading logo:', error);
    
    // Provide more specific error messages
    if (error.code === 'storage/unauthorized') {
      throw new Error('Permission denied. Please make sure you are logged in and try again.');
    } else if (error.code === 'storage/canceled') {
      throw new Error('Upload was canceled. Please try again.');
    } else if (error.code === 'storage/unknown') {
      throw new Error('An unknown error occurred. Please check your internet connection and try again.');
    } else if (error.message?.includes('CORS')) {
      throw new Error('Upload failed due to CORS policy. Please contact support or try again later.');
    }
    
    throw new Error(`Failed to upload logo: ${error.message}`);
  }
}

/**
 * Delete a logo from Firebase Storage
 * @param logoUrl - The full URL of the logo to delete
 * @returns Promise<void>
 */
export async function deleteLogo(logoUrl: string): Promise<void> {
  try {
    // Extract the path from the URL
    const url = new URL(logoUrl);
    const pathMatch = url.pathname.match(/\/o\/(.*?)\?/);
    
    if (!pathMatch) {
      throw new Error('Invalid Firebase Storage URL');
    }

    const decodedPath = decodeURIComponent(pathMatch[1]);
    const storageRef = ref(storage, decodedPath);

    await deleteObject(storageRef);
    console.log('Logo deleted successfully from Firebase Storage');
  } catch (error: any) {
    console.error('Error deleting logo:', error);
    // Don't throw error here as logo deletion is not critical
    console.warn('Logo deletion failed, but continuing...');
  }
}

/**
 * Delete entire chatbot folder from Firebase Storage
 * This removes all files associated with a chatbot (logos, documents, etc.)
 * @param userId - The user ID who owns the chatbot
 * @param chatbotId - The chatbot ID to delete
 * @returns Promise<void>
 */
export async function deleteChatbotFolder(userId: string, chatbotId: string): Promise<void> {
  try {
    // Reference to the chatbot folder: user-{userId}/chatbot-logos/chatbot-{chatbotId}/
    const chatbotFolderRef = ref(storage, `user-${userId}/chatbot-logos/chatbot-${chatbotId}`);
    
    console.log(`Deleting chatbot folder: user-${userId}/chatbot-logos/chatbot-${chatbotId}`);
    
    // List all files in the chatbot folder
    const listResult = await listAll(chatbotFolderRef);
    
    if (listResult.items.length === 0) {
      console.log('No files found in chatbot folder, nothing to delete');
      return;
    }
    
    console.log(`Found ${listResult.items.length} files to delete in chatbot folder`);
    
    // Delete all files in the folder
    const deletePromises = listResult.items.map(async (item) => {
      try {
        await deleteObject(item);
        console.log(`✅ Deleted file: ${item.fullPath}`);
      } catch (error) {
        console.error(`❌ Failed to delete file: ${item.fullPath}`, error);
        // Continue deleting other files even if one fails
      }
    });
    
    // Wait for all deletions to complete
    await Promise.allSettled(deletePromises);
    
    console.log(`✅ Successfully processed deletion of chatbot folder: chatbot-${chatbotId}`);
    
  } catch (error: any) {
    console.error('Error deleting chatbot folder:', error);
    
    // Provide more specific error messages
    if (error.code === 'storage/object-not-found') {
      console.log('Chatbot folder not found, may have been already deleted');
    } else if (error.code === 'storage/unauthorized') {
      console.error('Permission denied when trying to delete chatbot folder');
    } else {
      console.error('Unknown error occurred while deleting chatbot folder:', error.message);
    }
    
    // Don't throw error here as folder deletion shouldn't stop the chatbot deletion process
    console.warn('Chatbot folder deletion failed, but continuing with chatbot deletion...');
  }
}

/**
 * Validate image file before upload
 * @param file - The file to validate
 * @returns object with validation result and error message if any
 */
export function validateLogoFile(file: File): { isValid: boolean; error?: string } {
  // Check file type
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Invalid file type. Please upload a JPEG, PNG, GIF, SVG, or WebP image.'
    };
  }

  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB in bytes
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'File size too large. Please upload an image smaller than 5MB.'
    };
  }

  return { isValid: true };
}
