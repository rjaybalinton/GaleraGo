const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class GmailOAuth2 {
  constructor() {
    this.oauth2Client = null;
    this.gmail = null;
    this.credentials = null;
    this.tokenPath = path.join(__dirname, '..', 'gmail-token.json');
    this.credentialsPath = path.join(__dirname, '..', 'gmail-credentials.json');
  }

  // Initialize OAuth2 client with credentials
  async initialize() {
    try {
      // Load credentials from file or environment variables
      if (fs.existsSync(this.credentialsPath)) {
        this.credentials = JSON.parse(fs.readFileSync(this.credentialsPath));
      } else {
        // Use environment variables for credentials
        this.credentials = {
          web: {
            client_id: process.env.GMAIL_CLIENT_ID,
            project_id: process.env.GMAIL_PROJECT_ID,
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
            client_secret: process.env.GMAIL_CLIENT_SECRET,
            redirect_uris: [process.env.GMAIL_REDIRECT_URI || "http://localhost:3233/auth/gmail/callback"]
          }
        };
      }

      if (!this.credentials.web) {
        throw new Error('Gmail credentials not found. Please set up Gmail OAuth2 credentials.');
      }

      this.oauth2Client = new google.auth.OAuth2(
        this.credentials.web.client_id,
        this.credentials.web.client_secret,
        this.credentials.web.redirect_uris[0]
      );

      // Load existing token or get new one
      await this.loadOrRefreshToken();
      
      // Initialize Gmail API
      this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      
      return true;
    } catch (error) {
      console.error('Error initializing Gmail OAuth2:', error);
      return false;
    }
  }

  // Load existing token or refresh if needed
  async loadOrRefreshToken() {
    try {
      if (fs.existsSync(this.tokenPath)) {
        const token = JSON.parse(fs.readFileSync(this.tokenPath));
        this.oauth2Client.setCredentials(token);
        
        // Check if token is expired and refresh if needed
        if (token.expiry_date && Date.now() >= token.expiry_date) {
          console.log('Token expired, refreshing...');
          const { credentials } = await this.oauth2Client.refreshAccessToken();
          this.oauth2Client.setCredentials(credentials);
          await this.saveToken(credentials);
        }
      } else {
        // No token found, need to get authorization
        throw new Error('No Gmail token found. Please run the authorization flow first.');
      }
    } catch (error) {
      console.error('Error loading/refreshing token:', error);
      throw error;
    }
  }

  // Save token to file
  async saveToken(token) {
    try {
      fs.writeFileSync(this.tokenPath, JSON.stringify(token, null, 2));
      console.log('Token saved successfully');
    } catch (error) {
      console.error('Error saving token:', error);
    }
  }

  // Get authorization URL for initial setup
  getAuthUrl() {
    const scopes = ['https://www.googleapis.com/auth/gmail.send'];
    
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  // Exchange authorization code for tokens
  async getTokenFromCode(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      await this.saveToken(tokens);
      return tokens;
    } catch (error) {
      console.error('Error getting token from code:', error);
      throw error;
    }
  }

  // Send email using Gmail API
  async sendEmail(to, subject, text, html = null) {
    try {
      if (!this.gmail) {
        throw new Error('Gmail API not initialized. Call initialize() first.');
      }

      // Create email message
      const message = this.createEmailMessage(to, subject, text, html);
      
      // Send email
      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: message
        }
      });

      console.log('Email sent successfully:', response.data.id);
      return { success: true, messageId: response.data.id };
    } catch (error) {
      console.error('Error sending email:', error);
      return { success: false, error: error.message };
    }
  }

  // Create email message in RFC 2822 format
  createEmailMessage(to, subject, text, html = null) {
    const boundary = '----=_Part_' + Math.random().toString(36).substr(2, 9);
    const messageId = '<' + Math.random().toString(36).substr(2, 9) + '@gmail.com>';
    
    let message = [
      'From: ' + process.env.GMAIL_FROM_EMAIL || process.env.EMAIL_USER,
      'To: ' + to,
      'Subject: ' + subject,
      'MIME-Version: 1.0',
      'Message-ID: ' + messageId,
      'Date: ' + new Date().toUTCString()
    ];

    if (html) {
      message.push('Content-Type: multipart/alternative; boundary="' + boundary + '"');
      message.push('');
      message.push('--' + boundary);
      message.push('Content-Type: text/plain; charset=UTF-8');
      message.push('');
      message.push(text);
      message.push('');
      message.push('--' + boundary);
      message.push('Content-Type: text/html; charset=UTF-8');
      message.push('');
      message.push(html);
      message.push('');
      message.push('--' + boundary + '--');
    } else {
      message.push('Content-Type: text/plain; charset=UTF-8');
      message.push('');
      message.push(text);
    }

    // Encode message in base64url format
    const encodedMessage = Buffer.from(message.join('\r\n')).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return encodedMessage;
  }

  // Check if Gmail API is ready to use
  isReady() {
    return this.gmail !== null && this.oauth2Client !== null;
  }
}

module.exports = GmailOAuth2;
