// TypeScript interfaces for Video management with transcription and embedding

export interface UserVideoMetadata {
  id: string;
  userId: string;
  chatbotId: string;
  originalFileName: string; // Original video filename
  videoFileName: string; // Video filename in storage
  isPublic: boolean;
  firebaseStoragePath: string; // Internal storage path
  firebaseProjectId: string;
  publicUrl?: string; // Only set for public videos
  uploadedAt: string; // ISO timestamp
  updatedAt?: string; // ISO timestamp for last update
  fileSize: number; // In bytes
  duration?: number; // Video duration in seconds
  language?: string; // Detected language
  transcription?: string; // Video transcription text
  status: 'processing' | 'completed' | 'failed';
  error?: string;
  vectorCount?: number; // Number of vectors created from this video
}

export interface VideoStorageResult {
  success: boolean;
  storagePath: string;
  publicUrl?: string; // Only for public videos
  error?: string;
}

export interface UserVideoListResponse {
  success: boolean;
  videos: UserVideoMetadata[];
  error?: string;
}

export interface VideoAccessResponse {
  success: boolean;
  accessUrl: string;
  expiresAt: string; // ISO timestamp for signed URLs
  error?: string;
}

export interface VideoPrivacyToggleRequest {
  videoId: string;
  isPublic: boolean;
}

export interface VideoPrivacyToggleResponse {
  success: boolean;
  message: string;
  newUrl?: string; // New access URL after privacy change
  error?: string;
}
