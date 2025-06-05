// Client-side service for Firebase project operations
export interface FirebaseProjectConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface ClientFirebaseProject {
  projectId: string;
  displayName: string;
  chatbotId: string;
  status: 'creating' | 'active' | 'failed' | 'deleted';
  config: FirebaseProjectConfig;
  buckets?: {
    documents: string;
    privateImages: string;
    documentImages: string;
  };
}

export class ClientFirebaseProjectService {
  
  /**
   * Create Firebase project for chatbot (client-side API call)
   */
  static async createProjectForChatbot(
    chatbotId: string,
    chatbotName: string,
    authToken: string
  ): Promise<{ success: boolean; project?: ClientFirebaseProject; error?: string }> {
    try {
      const response = await fetch(`/api/firebase-projects/${chatbotId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          chatbotName,
          action: 'create'
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to create Firebase project' };
      }

      return {
        success: true,
        project: data.project
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Network error'
      };
    }
  }

  /**
   * Get Firebase project for chatbot (client-side API call)
   */
  static async getProjectForChatbot(
    chatbotId: string,
    authToken: string
  ): Promise<{ success: boolean; project?: ClientFirebaseProject; error?: string }> {
    try {
      const response = await fetch(`/api/firebase-projects/${chatbotId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 404) {
          return { success: false, error: 'No Firebase project found' };
        }
        return { success: false, error: data.error || 'Failed to get Firebase project' };
      }

      return {
        success: true,
        project: data.project
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Network error'
      };
    }
  }

  /**
   * Check Firebase CLI status (for admin/debug purposes)
   */
  static async checkFirebaseCLI(authToken: string): Promise<{
    available: boolean;
    authenticated: boolean;
    user?: string;
    error?: string;
  }> {
    try {
      const response = await fetch('/api/firebase-projects/cli-status', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await response.json();
      return data;

    } catch (error: any) {
      return {
        available: false,
        authenticated: false,
        error: error.message || 'Network error'
      };
    }
  }


  /**
   * Delete Firebase project for chatbot (client-side API call)
   */
  static async deleteProjectForChatbot(
    chatbotId: string,
    authToken: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`/api/firebase-projects/${chatbotId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          action: 'delete'
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to delete Firebase project' };
      }

      return {
        success: true
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Network error'
      };
    }
  }
}