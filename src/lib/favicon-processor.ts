import sharp from 'sharp';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export interface FaviconUrls {
  icon16: string;
  icon32: string;
  appleTouchIcon: string;
  icon192: string;
  icon512: string;
}

export async function processFaviconUpload(
  file: Buffer,
  chatbotId: string,
  originalExtension: string
): Promise<FaviconUrls> {
  const storage = getStorage();
  const basePath = `chatbots/${chatbotId}/favicons`;

  const sizes = [
    { name: 'icon16', size: 16 },
    { name: 'icon32', size: 32 },
    { name: 'appleTouchIcon', size: 180 },
    { name: 'icon192', size: 192 },
    { name: 'icon512', size: 512 },
  ];

  const urls: Partial<FaviconUrls> = {};

  // Process each size
  for (const { name, size } of sizes) {
    let processedBuffer: Buffer;

    if (originalExtension === '.svg') {
      // For SVG, we need to convert to PNG for specific sizes
      processedBuffer = await sharp(file)
        .resize(size, size)
        .png()
        .toBuffer();
    } else {
      // For PNG/ICO, resize to specific dimensions
      processedBuffer = await sharp(file)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toBuffer();
    }

    // Upload to Firebase Storage
    const fileName = `${name}.png`;
    const storageRef = ref(storage, `${basePath}/${fileName}`);
    
    await uploadBytes(storageRef, processedBuffer, {
      contentType: 'image/png',
      cacheControl: 'public, max-age=31536000', // 1 year cache
    });

    // Get download URL
    const downloadUrl = await getDownloadURL(storageRef);
    urls[name as keyof FaviconUrls] = downloadUrl;
  }

  return urls as FaviconUrls;
}

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