export interface ChatbotDeletionRequest {
  chatbotId: string;
  userId: string;
  deleteVectorstore?: boolean;
  deleteAuraDB?: boolean;
}

export interface ChatbotDeletionResponse {
  success: boolean;
  message?: string;
  errors?: string[];
  details: {
    chatbot_id: string;
    vectorstore_deleted?: boolean;
    auradb_deleted?: boolean;
    documents_deleted?: number;
    total_items_deleted?: number;
    services_cleaned?: string[];
    chatbot_deleted?: boolean;
  };
}

export interface ChatbotDeletionPreviewRequest {
  action: 'preview-deletion';
  chatbotId: string;
  userId: string;
}

export interface ChatbotDeletionPreviewResponse {
  success: boolean;
  preview?: {
    chatbot_id: string;
    documents_count: number;
    document_ids: string[];
    pinecone_index?: string;
    firebase_bucket?: string;
    estimated_cleanup_time: number; // seconds
  };
  error?: string;
}

export interface ChatbotDeletionHealthCheckRequest {
  action: 'health-check';
}

export interface ChatbotDeletionHealthCheckResponse {
  success: boolean;
  deletion_service_available: boolean;
  services_available?: string[];
  error?: string;
}