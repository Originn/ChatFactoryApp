// src/services/emailService.ts
import { Resend } from 'resend';

export interface EmailContent {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Email service for sending various types of emails
 * TODO: Implement with your preferred email provider (SendGrid, AWS SES, etc.)
 */
export class EmailService {
  /**
   * Send an email
   */
  static async sendEmail(content: EmailContent): Promise<EmailResult> {
    try {
      // Check if we have email service configured
      const emailProvider = process.env.EMAIL_PROVIDER || 'console';
      
      if (emailProvider === 'sendgrid' && process.env.SENDGRID_API_KEY) {
        return await this.sendWithSendGrid(content);
      } else if (emailProvider === 'resend' && process.env.RESEND_API_KEY) {
        return await this.sendWithResend(content);
      } else {
        // FALLBACK: Console logging for development
        console.log('📧 Email to be sent:', {
          to: content.to,
          subject: content.subject,
          preview: content.html.substring(0, 100) + '...'
        });
        console.log('💡 To actually send emails, configure EMAIL_PROVIDER and API key in .env');

        // Simulate email sending for development
        await new Promise(resolve => setTimeout(resolve, 1000));

        return {
          success: true,
          messageId: `dev-mock-${Date.now()}`
        };
      }

    } catch (error) {
      console.error('❌ Email sending failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email'
      };
    }
  }

  /**
   * Send email using SendGrid
   */
  private static async sendWithSendGrid(content: EmailContent): Promise<EmailResult> {
    // TODO: Implement SendGrid integration
    console.log('📧 Sending email via SendGrid to:', content.to);
    return { success: true, messageId: `sendgrid-${Date.now()}` };
  }

  /**
   * Send email using Resend
   */
  private static async sendWithResend(content: EmailContent): Promise<EmailResult> {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      const { data, error } = await resend.emails.send({
        from: 'ChatFactory <onboarding@resend.dev>', // Use resend.dev for testing
        to: [content.to],
        subject: content.subject,
        html: content.html,
        text: content.text,
      });

      if (error) {
        console.error('❌ Resend API error:', error);
        throw new Error(`Resend API error: ${(error as any).statusCode || 'Unknown'} ${JSON.stringify(error)}`);
      }

      console.log('✅ Email sent successfully via Resend:', data?.id);
      return {
        success: true,
        messageId: data?.id || `resend-${Date.now()}`
      };
    } catch (error) {
      console.error('❌ Resend email sending failed:', error);
      throw error; // Re-throw to be handled by the main sendEmail method
    }
  }

  /**
   * Send invitation email for chatbot access
   */
  static async sendChatbotInvitation(
    email: string,
    chatbotName: string,
    passwordSetupUrl: string,
    inviterName?: string
  ): Promise<EmailResult> {
    const emailContent: EmailContent = {
      to: email,
      subject: `You've been invited to ${chatbotName}`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <h2 style="color: #333;">You've been invited!</h2>
          <p>Hello,</p>
          <p>You've been invited to access <strong>${chatbotName}</strong>${inviterName ? ` by ${inviterName}` : ''}.</p>
          <p><strong>Getting started is easy - just one step:</strong></p>
          <p>Click the button below to set your password and get immediate access:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${passwordSetupUrl}" 
               style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Set Password & Access Now
            </a>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #495057; font-size: 14px;">
              <strong>What happens next:</strong><br>
              1. Click the button above<br>
              2. Create your password<br>
              3. Start chatting immediately!
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            This setup link will expire in 24 hours. No complicated verification steps - just set your password and you're ready to go!
          </p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">
            This email was sent by ChatFactory. If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `,
      text: `
        You've been invited to ${chatbotName}!
        
        Getting started is easy - just one step:
        Set your password and get immediate access: ${passwordSetupUrl}
        
        What happens next:
        1. Click the link above
        2. Create your password
        3. Start chatting immediately!
        
        This setup link will expire in 24 hours.
      `
    };

    return this.sendEmail(emailContent);
  }
}

// Export the function for backward compatibility
export const sendEmail = EmailService.sendEmail;
