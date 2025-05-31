import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { v4 as uuidv4 } from 'uuid';
import { Timestamp } from 'firebase-admin/firestore';

export interface CreateTenantRequest {
  chatbotId: string;
  chatbotName: string;
  creatorUserId: string;
}

export interface InviteUserRequest {
  chatbotId: string;
  tenantId: string;
  email: string;
  displayName?: string;
  creatorUserId: string;
}

export class FirebaseTenantService {
  
  /**
   * Create a Firebase tenant for a chatbot
   */
  static async createTenant(request: CreateTenantRequest): Promise<{ success: boolean; tenantId?: string; error?: string }> {
    try {
      const { chatbotId, chatbotName } = request;
      
      console.log('🏗️ Creating Firebase tenant for chatbot:', chatbotId);
      
      // Create tenant with Firebase Admin SDK
      const tenantManager = adminAuth.tenantManager();
      
      // Sanitize display name to meet Firebase requirements:
      // - Start with letter, only letters/digits/hyphens, 4-20 chars
      const sanitizedName = chatbotName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-') // Replace non-alphanumeric chars with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
        .substring(0, 15); // Limit to 15 chars to allow for suffix
      
      // Ensure it starts with a letter and has minimum length
      const displayName = sanitizedName.match(/^[a-z]/) && sanitizedName.length >= 4 
        ? `${sanitizedName}-bot`
        : `bot-${sanitizedName}`.substring(0, 20);
      
      console.log(`📝 Sanitized display name: "${chatbotName}" → "${displayName}"`);
      
      const tenant = await tenantManager.createTenant({
        displayName: displayName,
        anonymousSignInEnabled: false,
        emailSignInConfig: {
          enabled: true,
          passwordRequired: true
        },
        multiFactorConfig: { 
          state: 'DISABLED',
          factorIds: []
        }
      });
      
      console.log('✅ Firebase tenant created:', tenant.tenantId);
      
      // Store tenant info in Firestore
      await adminDb.collection('chatbots').doc(chatbotId).update({
        'authConfig.firebaseTenantId': tenant.tenantId,
        'authConfig.invitedUsers': [],
        updatedAt: Timestamp.now()
      });
      
      return { success: true, tenantId: tenant.tenantId };
      
    } catch (error: any) {
      console.error('❌ Error creating Firebase tenant:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Invite a user to the chatbot by creating a Firebase user account
   */
  static async inviteUser(request: InviteUserRequest): Promise<{ success: boolean; userId?: string; error?: string }> {
    try {
      const { chatbotId, tenantId, email, displayName, creatorUserId } = request;
      
      console.log('📧 Inviting user to chatbot:', { email, chatbotId, tenantId });
      
      // Get tenant-specific auth instance
      const tenantManager = adminAuth.tenantManager();
      const tenantAuth = tenantManager.authForTenant(tenantId);
      
      // Generate a temporary password
      const tempPassword = this.generateTemporaryPassword();
      
      // Create user in the tenant
      const userRecord = await tenantAuth.createUser({
        email: email,
        password: tempPassword,
        displayName: displayName,
        emailVerified: false,
        disabled: false
      });
      
      console.log('👤 Created Firebase user:', userRecord.uid);
      
      // Create invitation record
      const invitedUser = {
        id: uuidv4(),
        email: email,
        displayName: displayName || '',
        invitedAt: Timestamp.now(),
        invitedBy: creatorUserId,
        status: 'pending' as const,
        firebaseUid: userRecord.uid
      };
      
      // Add to chatbot's invited users list
      const chatbotRef = adminDb.collection('chatbots').doc(chatbotId);
      const chatbotDoc = await chatbotRef.get();
      
      if (!chatbotDoc.exists) {
        throw new Error('Chatbot not found');
      }
      
      const chatbotData = chatbotDoc.data();
      const invitedUsers = chatbotData?.authConfig?.invitedUsers || [];
      
      // Check if user is already invited
      const existingUser = invitedUsers.find((user: any) => user.email === email);
      if (existingUser) {
        return { success: false, error: 'User is already invited to this chatbot' };
      }
      
      // Add the new user
      invitedUsers.push(invitedUser);
      
      await chatbotRef.update({
        'authConfig.invitedUsers': invitedUsers,
        updatedAt: Timestamp.now()
      });
      
      console.log('✅ User added to invitation list');
      
      // TODO: Send invitation email
      await this.sendInvitationEmail({
        email,
        displayName,
        chatbotName: chatbotData.name,
        tempPassword,
        chatbotUrl: chatbotData.deployedUrl || `https://${chatbotData.vercelProjectId}.vercel.app`
      });
      
      return { success: true, userId: userRecord.uid };
      
    } catch (error: any) {
      console.error('❌ Error inviting user:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Remove a user from the chatbot
   */
  static async removeUser(chatbotId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🗑️ Removing user from chatbot:', { userId, chatbotId });
      
      const chatbotRef = adminDb.collection('chatbots').doc(chatbotId);
      const chatbotDoc = await chatbotRef.get();
      
      if (!chatbotDoc.exists) {
        throw new Error('Chatbot not found');
      }
      
      const chatbotData = chatbotDoc.data();
      const invitedUsers = chatbotData?.authConfig?.invitedUsers || [];
      
      // Find and remove the user
      const updatedUsers = invitedUsers.filter((user: any) => user.id !== userId);
      
      await chatbotRef.update({
        'authConfig.invitedUsers': updatedUsers,
        updatedAt: Timestamp.now()
      });
      
      console.log('✅ User removed from chatbot');
      return { success: true };
      
    } catch (error: any) {
      console.error('❌ Error removing user:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Generate a secure temporary password
   */
  private static generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
  
  /**
   * Send invitation email to user
   */
  private static async sendInvitationEmail(params: {
    email: string;
    displayName?: string;
    chatbotName: string;
    tempPassword: string;
    chatbotUrl: string;
  }): Promise<void> {
    // TODO: Implement proper email sending (SendGrid, etc.)
    console.log('📧 Invitation email details:', {
      to: params.email,
      subject: `Invitation to ${params.chatbotName}`,
      message: `You've been invited to access ${params.chatbotName}. Visit ${params.chatbotUrl} and sign in with your email and temporary password: ${params.tempPassword}`
    });
  }
}
