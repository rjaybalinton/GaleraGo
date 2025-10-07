// UPDATED: controller/TouristController.js
const TouristModel = require('../model/TouristModel');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
require('dotenv').config();

// Multer setup (keep your existing configuration)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'tourist-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter
});

// Authentication middleware
const authenticateUser = (req, res, next) => {
  if (req.session && req.session.user) {
    req.user = {
      user_id: req.session.user.user_id || req.session.user.id,
      email: req.session.user.email
    };
    return next();
  }

  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const TouristController = {
  upload,

  registerTourist: async (req, res) => {
    try {
      console.log("🔹 Tourist registration started");
      console.log("🔹 Session user:", req.session?.user);
      console.log("🔹 Request body:", req.body);
      console.log("🔹 Uploaded file:", req.file);

      const userId = req.session?.user?.user_id || req.user?.user_id;

      if (!userId) {
        console.log("❌ No user ID found");
        return res.status(401).json({ 
          success: false, 
          error: 'Unauthorized: Please log in first.' 
        });
      }

      if (!req.file) {
        console.log("❌ No file uploaded");
        return res.status(400).json({ 
          success: false, 
          error: 'Picture is required' 
        });
      }

      // Validate registration type
      const validTypes = ['Regular Tourist', 'Day Tourist', 'Resident'];
      if (!validTypes.includes(req.body.registration_type)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid registration type' 
        });
      }

      // Common data for all registration types
      const commonData = {
        registration_type: req.body.registration_type,
        user_id: userId,
        email: req.body.email,
        phone: req.body.phone,
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        age: req.body.age,
        gender: req.body.gender,
        nationality: req.body.nationality,
        residence: req.body.residence,
        picture: `/uploads/${req.file.filename}`,
        created_at: new Date()
      };

      // Add type-specific data
      let specificData = {};
      const registrationType = req.body.registration_type;

      if (registrationType === 'Regular Tourist') {
        specificData = {
          companions_12: req.body.companions_12 || 0,
          companions_below_12: req.body.companions_below_12 || 0,
          arrival_date: req.body.arrival_date,
          departure_date: req.body.departure_date,
          accommodation: req.body.accommodation
        };
      } else if (registrationType === 'Day Tourist') {
        specificData = {
          is_resident: req.body.is_resident,
          companions_12: req.body.companions_12 || 0,
          companions_below_12: req.body.companions_below_12 || 0,
          arrival_date: req.body.arrival_date,
          purpose: req.body.purpose,
          special_requests: req.body.special_requests
        };
      } else if (registrationType === 'Resident') {
        specificData = {
          host_first_name: req.body.host_first_name,
          host_last_name: req.body.host_last_name,
          host_email: req.body.host_email,
          host_phone: req.body.host_phone,
          host_address: req.body.host_address,
          arrival_date: req.body.arrival_date,
          departure_date: req.body.departure_date,
          purpose: req.body.purpose,
          companions_12: req.body.companions_12 || 0,
          companions_below_12: req.body.companions_below_12 || 0,
          special_requests: req.body.special_requests
        };
      }

      const touristData = { ...commonData, ...specificData };

      // Generate QR code
      console.log("🔹 Generating QR code");
      const qrData = `Name: ${touristData.first_name} ${touristData.last_name}, Email: ${touristData.email}, Phone: ${touristData.phone}, Type: ${touristData.registration_type}`;
      
      try {
        const qrImage = await QRCode.toDataURL(qrData);
        touristData.qrcode = qrImage;
        console.log("✅ QR code generated successfully");
      } catch (qrError) {
        console.error("❌ QR code generation failed:", qrError);
        // Continue without QR code
        touristData.qrcode = null;
      }

      // Save to database using the model
      console.log("🔹 Saving to database");
      const result = await TouristModel.registerTourist(touristData);
      
      console.log("✅ Tourist registered successfully with ID:", result.insertId);

      // Send success response
      res.status(201).json({
        success: true,
        message: `${registrationType} registered successfully!`,
        touristId: result.insertId,
        qrImage: touristData.qrcode
      });

    } catch (error) {
      console.error('❌ Registration error:', error);
      
      // Clean up uploaded file if registration fails
      if (req.file) {
        const filePath = path.join(__dirname, '../uploads', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      res.status(500).json({ 
        success: false,
        error: 'Registration failed', 
        details: error.message 
      });
    }
  },

  getHistory: async (req, res) => {
    try {
      console.log("🔹 Fetching tourist history");
      console.log("🔹 Session user:", req.session?.user);

      const userId = req.session?.user?.user_id || req.user?.user_id;
      
      if (!userId) {
        console.log("❌ No user ID for history");
        return res.status(401).json({ error: 'Not authorized' });
      }

      console.log("🔹 Getting history for user ID:", userId);
      const history = await TouristModel.getTouristHistory(userId);
      
      console.log("✅ History fetched:", history.length, "records");
      res.json(history);

    } catch (error) {
      console.error('❌ Get history error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch history', 
        details: error.message 
      });
    }
  }
};

module.exports = TouristController;