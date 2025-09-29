export interface ProjectMapping {
  projectId: string;
  chatbotId: string | null;
  userId: string | null;
  status: ProjectStatus;
  projectInUse?: boolean;
  createdAt: Date;
  lastUsedAt: Date;
  deployedAt: Date | null;
  recycledAt: Date | null;
  vercelUrl: string | null;
  projectType: ProjectType;
  metadata: ProjectMetadata;
}

export type ProjectStatus = 'available' | 'in-use' | 'recycling' | 'maintenance';

export type ProjectType = 'pool' | 'dedicated';

export interface ProjectMetadata {
  projectName: string;
  region: string;
  billingAccountId: string;
}

export interface ProjectReservationRequest {
  chatbotId: string;
  userId: string;
  vercelUrl?: string;
}

export interface ProjectReservationResult {
  success: boolean;
  project?: ProjectMapping;
  error?: string;
}

export interface ProjectReleaseResult {
  success: boolean;
  message: string;
  details?: any;
}

// For Firestore document format
export interface ProjectMappingDocument {
  projectId: string;
  chatbotId: string | null;
  userId: string | null;
  status: ProjectStatus;
  projectInUse?: boolean;
  createdAt: FirebaseFirestore.Timestamp;
  lastUsedAt: FirebaseFirestore.Timestamp;
  deployedAt: FirebaseFirestore.Timestamp | null;
  recycledAt: FirebaseFirestore.Timestamp | null;
  vercelUrl: string | null;
  projectType: ProjectType;
  metadata: ProjectMetadata;
}