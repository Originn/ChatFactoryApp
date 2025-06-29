// TypeScript interfaces for PDF management with public/private access control

export interface UserPDFMetadata {
  id: string;
  userId: string;
  chatbotId: string;
  originalFileName: string; // Original CHM filename
  pdfFileName: string; // Converted PDF filename
  isPublic: boolean;
  firebaseStoragePath: string; // Internal storage path
  firebaseProjectId: string;
  publicUrl?: string; // Only set for public PDFs
  uploadedAt: string; // ISO timestamp
  fileSize: number; // In bytes
  status: 'converting' | 'completed' | 'failed';
  error?: string;
  vectorCount?: number; // Number of vectors created from this PDF
}

export interface PDFStorageResult {
  success: boolean;
  storagePath: string;
  publicUrl?: string; // Only for public PDFs
  error?: string;
}

export interface UserPDFListResponse {
  success: boolean;
  pdfs: UserPDFMetadata[];
  error?: string;
}

export interface PDFAccessResponse {
  success: boolean;
  accessUrl: string;
  expiresAt: string; // ISO timestamp for signed URLs
  error?: string;
}

export interface PDFPrivacyToggleRequest {
  pdfId: string;
  isPublic: boolean;
}

export interface PDFPrivacyToggleResponse {
  success: boolean;
  message: string;
  newUrl?: string; // New access URL after privacy change
  error?: string;
}
