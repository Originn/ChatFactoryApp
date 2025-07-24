import { storage } from '@/lib/firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export interface FaviconUrls {
  icon16: string;
  icon32: string;
  appleTouchIcon: string;
  icon192: string;
  icon512: string;
}

/**
 * Upload and process favicon files to Firebase Storage (client-side)
 * @param file - The favicon image file to upload
 * @param userId - The user ID (for organizing files)
 * @param chatbotId - The chatbot ID (for unique naming)
 * @returns Promise<FaviconUrls> - Object containing URLs for all favicon sizes
 */
export async function uploadFavicon(file: File, userId: string, chatbotId: string): Promise<FaviconUrls> {
  // Validate file type
  const validTypes = ['image/png', 'image/x-icon', 'image/svg+xml'];
  if (!validTypes.includes(file.type)) {
    throw new Error('Invalid file type. Please upload PNG, ICO, or SVG file.');
  }

  // Validate file size (max 1MB)
  const maxSize = 1024 * 1024; // 1MB in bytes
  if (file.size > maxSize) {
    throw new Error('File size too large. Please upload an image smaller than 1MB.');
  }

  try {
    // For client-side, we'll upload the original file and let the client generate different sizes if needed
    // This is simpler than server-side processing with Sharp
    const basePath = `user-${userId}/chatbot-logos/chatbot-${chatbotId}`;
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'png';
    
    console.log('Uploading favicon to Firebase Storage...');
    console.log('Storage path:', basePath);
    console.log('File size:', file.size, 'bytes');
    console.log('File type:', file.type);

    // For simplicity, we'll upload the original file and use it for all sizes
    // In a production app, you might want to use a canvas to resize images client-side
    const fileName = `favicon_${timestamp}.${fileExtension}`;
    const storageRef = ref(storage, `${basePath}/${fileName}`);

    // Upload the file with metadata
    const metadata = {
      contentType: file.type,
      customMetadata: {
        uploadedBy: userId,
        chatbotId: chatbotId,
        originalName: file.name,
        publicAccess: 'true'
      }
    };

    const snapshot = await uploadBytes(storageRef, file, metadata);
    console.log('Favicon upload successful, getting download URL...');

    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('Favicon uploaded successfully:', downloadURL);

    // For client-side simplicity, use the same URL for all sizes
    // In a more sophisticated implementation, you could resize images client-side using canvas
    const faviconUrls: FaviconUrls = {
      icon16: downloadURL,
      icon32: downloadURL,
      appleTouchIcon: downloadURL,
      icon192: downloadURL,
      icon512: downloadURL,
    };

    // Verify the URL is accessible
    try {
      const testResponse = await fetch(downloadURL, { method: 'HEAD' });
      if (!testResponse.ok) {
        console.warn('⚠️ Favicon URL may not be publicly accessible:', testResponse.status);
      } else {
        console.log('✅ Favicon URL verified as accessible');
      }
    } catch (testError) {
      console.warn('⚠️ Could not verify favicon URL accessibility:', testError);
    }

    return faviconUrls;

  } catch (error: any) {
    console.error('Error uploading favicon:', error);
    
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
    
    throw new Error(`Failed to upload favicon: ${error.message}`);
  }
}

/**
 * Generate favicon environment variables for deployment
 * @param faviconConfig - Favicon configuration object
 * @param chatbotName - Name of the chatbot
 * @returns Record<string, string> - Environment variables for favicon
 */
export function generateFaviconEnvVars(faviconConfig: {
  enabled: boolean;
  iconUrl?: string;
  appleTouchIcon?: string;
  manifestIcon192?: string;
  manifestIcon512?: string;
  themeColor?: string;
  backgroundColor?: string;
}, chatbotName: string): Record<string, string> {
  const envVars: Record<string, string> = {};

  if (faviconConfig.enabled && faviconConfig.iconUrl) {
    envVars.NEXT_PUBLIC_FAVICON_URL = faviconConfig.iconUrl;
    envVars.NEXT_PUBLIC_APPLE_TOUCH_ICON_URL = faviconConfig.appleTouchIcon || faviconConfig.iconUrl;
    envVars.NEXT_PUBLIC_ICON_192_URL = faviconConfig.manifestIcon192 || faviconConfig.iconUrl;
    envVars.NEXT_PUBLIC_ICON_512_URL = faviconConfig.manifestIcon512 || faviconConfig.iconUrl;
    envVars.NEXT_PUBLIC_THEME_COLOR = faviconConfig.themeColor || '#000000';
    envVars.NEXT_PUBLIC_BACKGROUND_COLOR = faviconConfig.backgroundColor || '#ffffff';
    envVars.NEXT_PUBLIC_MANIFEST_NAME = `${chatbotName} ChatBot`;
    envVars.NEXT_PUBLIC_MANIFEST_SHORT_NAME = chatbotName;
  }

  return envVars;
}

/**
 * Validate favicon file before upload
 * @param file - The file to validate
 * @returns object with validation result and error message if any
 */
export function validateFaviconFile(file: File): { isValid: boolean; error?: string } {
  // Check file type
  const validTypes = ['image/png', 'image/x-icon', 'image/svg+xml'];
  if (!validTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Invalid file type. Please upload a PNG, ICO, or SVG file.'
    };
  }

  // Check file size (max 1MB)
  const maxSize = 1024 * 1024; // 1MB in bytes
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'File size must be less than 1MB.'
    };
  }

  return { isValid: true };
}