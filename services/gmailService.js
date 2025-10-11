const GmailOAuth2 = require('../config/gmail-oauth');

class GmailService {
  constructor() {
    this.gmail = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return this.gmail;
    }

    try {
      this.gmail = new GmailOAuth2();
      const success = await this.gmail.initialize();
      
      if (success && this.gmail.isReady()) {
        this.initialized = true;
        console.log('✅ Gmail service initialized successfully');
        return this.gmail;
      } else {
        throw new Error('Failed to initialize Gmail service');
      }
    } catch (error) {
      console.error('❌ Gmail service initialization failed:', error);
      throw error;
    }
  }

  async sendPasswordResetEmail(to, resetCode, user) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const subject = "🔐 Password Reset Code - GaleraGo GPS";
      const text = this.createTextEmail(resetCode, user);
      const html = this.createHtmlEmail(resetCode, user);

      const result = await this.gmail.sendEmail(to, subject, text, html);
      
      if (result.success) {
        console.log('✅ Password reset email sent successfully via Gmail API');
        console.log(`  - Message ID: ${result.messageId}`);
        return { success: true, messageId: result.messageId };
      } else {
        console.error('❌ Failed to send password reset email via Gmail API:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('❌ Error in sendPasswordResetEmail:', error);
      return { success: false, error: error.message };
    }
  }

  createTextEmail(resetCode, user) {
    return `
GaleraGo GPS - Password Reset Code

Hello ${user.first_name || 'User'},

You have requested to reset your password for your GaleraGo GPS account.

Your Reset Code: ${resetCode}

This code will expire in 15 minutes.

Important:
- Enter this code in the password reset form
- Do not share this code with anyone
- If you didn't request this reset, please ignore this email

If you have any questions, please contact our support team.

This is an automated message from GaleraGo GPS.
© ${new Date().getFullYear()} GaleraGo GPS. All rights reserved.
    `.trim();
  }

  createHtmlEmail(resetCode, user) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">GaleraGo GPS</h1>
      <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">Password Reset Request</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 40px 30px;">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Hello <strong>${user.first_name || 'User'}</strong>,</p>
      
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">You have requested to reset your password for your GaleraGo GPS account. Use the code below to complete the reset process:</p>
      
      <!-- Reset Code Box -->
      <div style="background-color: #f1f5f9; border: 2px dashed #3b82f6; padding: 30px; border-radius: 12px; text-align: center; margin: 30px 0;">
        <p style="color: #64748b; font-size: 14px; margin: 0 0 10px 0; font-weight: 600;">YOUR RESET CODE</p>
        <div style="font-size: 36px; font-weight: bold; color: #1e3a8a; letter-spacing: 8px; margin: 10px 0; font-family: 'Courier New', monospace;">${resetCode}</div>
        <p style="color: #64748b; font-size: 12px; margin: 10px 0 0 0;">Valid for 15 minutes</p>
      </div>
      
      <!-- Instructions -->
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0;">
        <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 16px;">⚠️ Important Instructions:</h3>
        <ul style="color: #92400e; margin: 0; padding-left: 20px; line-height: 1.6;">
          <li>Enter this code in the password reset form</li>
          <li>This code will expire in 15 minutes</li>
          <li>Do not share this code with anyone</li>
          <li>If you didn't request this reset, please ignore this email</li>
        </ul>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">If you have any questions or need assistance, please contact our support team.</p>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 20px 30px; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">This is an automated message from GaleraGo GPS. Please do not reply to this email.</p>
      <p style="color: #9ca3af; font-size: 12px; margin: 5px 0 0 0; text-align: center;">© ${new Date().getFullYear()} GaleraGo GPS. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  isReady() {
    return this.initialized && this.gmail && this.gmail.isReady();
  }
}

module.exports = new GmailService();
