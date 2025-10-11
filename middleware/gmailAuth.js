const GmailOAuth2 = require('../config/gmail-oauth');
const express = require('express');
const router = express.Router();

// Global Gmail instance
let gmailInstance = null;

// Initialize Gmail OAuth2
const initializeGmail = async () => {
  if (!gmailInstance) {
    gmailInstance = new GmailOAuth2();
    const initialized = await gmailInstance.initialize();
    if (!initialized) {
      console.error('Failed to initialize Gmail OAuth2');
      return null;
    }
  }
  return gmailInstance;
};

// Middleware to ensure Gmail is ready
const ensureGmailReady = async (req, res, next) => {
  try {
    const gmail = await initializeGmail();
    if (!gmail || !gmail.isReady()) {
      return res.status(500).json({
        success: false,
        message: 'Gmail service not available. Please check OAuth2 configuration.'
      });
    }
    req.gmail = gmail;
    next();
  } catch (error) {
    console.error('Gmail middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Gmail service initialization failed.'
    });
  }
};

// Route to get authorization URL (for initial setup)
router.get('/auth/gmail', async (req, res) => {
  try {
    const gmail = new GmailOAuth2();
    const authUrl = gmail.getAuthUrl();
    res.json({
      success: true,
      authUrl: authUrl,
      message: 'Visit this URL to authorize Gmail access'
    });
  } catch (error) {
    console.error('Error getting auth URL:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate authorization URL'
    });
  }
});

// Route to handle OAuth2 callback
router.get('/auth/gmail/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Authorization code not provided'
      });
    }

    const gmail = new GmailOAuth2();
    await gmail.initialize();
    const tokens = await gmail.getTokenFromCode(code);
    
    res.json({
      success: true,
      message: 'Gmail authorization successful! You can now send emails.',
      tokens: tokens
    });
  } catch (error) {
    console.error('Error handling OAuth2 callback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete Gmail authorization'
    });
  }
});

// Route to test Gmail functionality
router.post('/test-gmail', ensureGmailReady, async (req, res) => {
  try {
    const { to, subject, text } = req.body;
    
    if (!to || !subject || !text) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: to, subject, text'
      });
    }

    const result = await req.gmail.sendEmail(to, subject, text);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Test email sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email'
    });
  }
});

module.exports = {
  router,
  ensureGmailReady,
  initializeGmail
};
