const express = require('express');
const router = express.Router();
const UserController = require('../controller/UserController');
const authenticateToken = require('../controller/authMiddleware');
const multer = require("multer");
const upload = UserController.upload;
const fs = require('fs');
const path = require('path');
const  TouristController  = require('../controller/TouristController');
const ensureLoggedIn = require('../middleware/sessionAuth');
const adminRoutes = require('./adminRoutes');
// Add this middleware to your router.js before protected routes
const preventCaching = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
};

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
router.use('/admin', adminRoutes);
router.post('/register-tourist', authenticateToken, UserController.registerTourist);
// Show Registration Page
router.get('/', (req, res) => {
    res.render('LandingPage');
});
router.get('/register1', (req, res) => {
    res.render('UserRegister', { session: req.session });
});


router.get('/booking', (req, res) => {
    res.render('BookingPage');
});
router.get('/navigation', (req, res) => {
    // Always provide a default user object if not in session
    const user = req.session && req.session.user ? req.session.user : { username: 'Guest' };
    
    res.render('navigation', { 
        user: user
    });
});
router.get('/AboutPage', (req, res) => {
    res.render('AboutPage');
});
router.get('/ContactPage', (req, res) => {
    res.render('ContactPage');
});
router.get('/FeaturesPage', (req, res) => {
    res.render('FeaturesPage');
});
router.get('/island', (req, res) => {
    console.log('🔹 ISLAND ROUTE - /island accessed');
    console.log('🔹 Session user:', req.session.user);
    console.log('🔹 Full session:', req.session);
    
    // Check if user is logged in
    if (!req.session.user) {
        console.log('❌ No user session found, redirecting to login');
        return res.redirect('/userlogin');
    }
    
    console.log('✅ User session found, rendering IslandPage');
    res.render('IslandPage', { 
        user: req.session.user,
        title: 'Island Adventures'
    });
});

// Test route for IslandPage without authentication (for debugging)
router.get('/island-test', (req, res) => {
    console.log('🔹 ISLAND TEST - Rendering IslandPage without authentication');
    res.render('IslandPage', { 
        user: { id: 1, username: 'testuser', email: 'test@example.com' },
        title: 'Island Adventures - Test'
    });
});

// Test route for frontend debugging
router.get('/test-frontend', (req, res) => {
    console.log('🔹 FRONTEND TEST - Serving test page');
    res.sendFile(path.join(__dirname, '../test_frontend.html'));
});

router.get('/UserFAQ', (req, res) => {
    const user = req.session && req.session.user ? req.session.user : { name: 'Guest' };
    res.render('UserFAQ', { user });
});


// Forgot Password Routes
router.post("/forgot-password", UserController.forgotPassword);
router.post("/verify-code", UserController.verifyCode);
router.post("/reset-password", UserController.resetPassword);


// Handle User Registration
router.post('/register', upload.single('profile_picture'), UserController.register);
// Show login form
router.get('/login', (req, res) => {
    res.render('Userlogin', { error: null });
});

// OR just this one instead of both, if you're using session error
// User login route with session clearing after registration or login
router.get("/userlogin", (req, res) => {
  console.log("🔹 ROUTE: /userlogin GET request received")
  console.log("🔹 ROUTE: Session data:", {
    error: req.session.error,
    success: req.session.success,
    suspensionModal: req.session.suspensionModal ? "Present" : "Not present",
    user: req.session.user ? "Logged in" : "Not logged in",
  })

  // Prepare data for the template
  const templateData = {
    error: req.session.error,
    success: req.session.success,
    suspensionModal: req.session.suspensionModal,
  }

  console.log("🔹 ROUTE: Template data prepared:", {
    error: templateData.error || "None",
    success: templateData.success || "None",
    suspensionModal: templateData.suspensionModal ? "Present" : "Not present",
  })

  // Clear the session data after preparing template data
  if (req.session.suspensionModal) {
    console.log("🔹 ROUTE: Clearing suspension modal from session")
    delete req.session.suspensionModal
  }

  // Clear other flash messages
  if (req.session.error) {
    console.log("🔹 ROUTE: Clearing error message from session")
    delete req.session.error
  }

  if (req.session.success) {
    console.log("🔹 ROUTE: Clearing success message from session")
    delete req.session.success
  }

  console.log("🔹 ROUTE: Rendering Userlogin template")

  try {
    // Render the login page with the data
    res.render("Userlogin", templateData)
    console.log("✅ ROUTE: Userlogin template rendered successfully")
  } catch (renderError) {
    console.error("❌ ROUTE: Error rendering Userlogin template:", renderError)
    res.status(500).send("Error rendering login page")
  }
})

// Handle login submission
router.post('/login', UserController.login);

// Protected user homepage (after login)
router.get('/user/home', preventCaching, ensureLoggedIn, (req, res) => {
    res.render('UserHome', { user: req.session.user });
});

// Handle User Logout
router.get('/logout', UserController.logout);

// Get User by ID
router.get('/user/:id', UserController.getUserById);


// Updated route with better error handling
// Tourist registration route with file upload
router.post('/register2', TouristController.upload.single('picture'), TouristController.registerTourist);
router.get('/tourist/history', TouristController.getHistory);

// Test route to verify router is working
router.get('/api/test-main-router', (req, res) => {
  console.log('🔹 MAIN ROUTER - /api/test-main-router called');
  res.json({ message: 'Main router is working!' });
});

// Public packages route (for tourists to view water activities)
router.get('/api/packages/public', async (req, res) => {
  try {
    console.log('🔹 MAIN ROUTER - /api/packages/public called');
    console.log('🔹 Request headers:', req.headers);
    console.log('🔹 Session user:', req.session?.user);
    const db = require('../config/db');
    
    const [packages] = await db.query(`
      SELECT p.*, u.username as created_by_name, u.contact_number as provider_contact,
             u.gcash_number as provider_gcash_number, u.gcash_name as provider_gcash_name,
             COALESCE(AVG(r.rating), 0) as average_rating,
             COUNT(r.id) as review_count
      FROM packages p
      LEFT JOIN users u ON p.created_by = u.user_id
      LEFT JOIN reviews r ON p.id = r.package_id
      WHERE p.activity_type IN ('Island Hopping', 'Snorkeling')
      GROUP BY p.id, p.name, p.description, p.price, p.duration, p.max_participants, 
               p.activity_type, p.image, p.includes, p.created_by, p.created_at, p.updated_at,
               u.username, u.contact_number, u.gcash_number, u.gcash_name
      ORDER BY p.activity_type, p.created_at DESC
    `);
    
    console.log('✅ Packages fetched successfully:', packages.length, 'packages');
    console.log('✅ Sample packages:', packages.map(p => ({ id: p.id, name: p.name, type: p.activity_type })));
    res.json(packages);
  } catch (error) {
    console.error('❌ Error fetching packages:', error);
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});
  
module.exports = router;