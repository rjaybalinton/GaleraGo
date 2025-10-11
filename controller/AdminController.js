// controller/AdminController.js
const db = require("../config/db")
const bcrypt = require("bcrypt")
const fs = require("fs")
const path = require("path")
const AdminModel = require('../model/AdminModel');
const ReportModel = require('../model/ReportModel');
const AdminController = {
  renderDashboard: async (req, res) => {
    try {
      // Check if user is admin
      if (!req.session.user || req.session.user.user_type !== "admin") {
        req.session.error = "You do not have permission to access the admin dashboard."
        return res.redirect("/userlogin")
      }

      // Render the correct template
      res.render("admin/AdminDashboard", {
        title: "Admin Dashboard",
        user: req.session.user,
      })
    } catch (error) {
      console.error("Error rendering dashboard:", error)
      req.session.error = "Error loading dashboard"
      res.redirect("/")
    }
  },

  // Dashboard data - Using direct database queries
  getDashboardData: async (req, res) => {
    try {
      console.log("Dashboard data requested by:", req.session.user.username)

      // Check if user is admin
      if (!req.session.user || req.session.user.user_type !== "admin") {
        console.log("Unauthorized access attempt")
        return res.status(403).json({ error: "Unauthorized" })
      }

      // Initialize counts object
      const counts = { tourists: 0, users: 0, providers: 0 }

      // Get user count
      const [userResults] = await db.query(`SELECT COUNT(*) as count FROM users`)
      counts.users = userResults[0].count

      // Get provider count
      const [providerResults] = await db.query(`
        SELECT COUNT(*) as count FROM users
        WHERE user_type IN ('entry_provider', 'activity_provider')
      `)
      counts.providers = providerResults[0].count

      // Check if tourists table exists
      try {
        const [tables] = await db.query(`SHOW TABLES LIKE 'tourists'`)

        if (tables.length > 0) {
          // Get tourist count
          const [touristResults] = await db.query(`SELECT COUNT(*) as count FROM tourists`)
          counts.tourists = touristResults[0].count
        } else {
          console.log("Tourists table doesn't exist")
          counts.tourists = 0
        }
      } catch (error) {
        console.error("Error checking tourists table:", error)
        counts.tourists = 0
      }

      console.log("Counts result:", counts)

      // Get recent tourists
      let recentTourists = []
      try {
        const [tables] = await db.query(`SHOW TABLES LIKE 'tourists'`)

        if (tables.length > 0) {
          const [rows] = await db.query(`
            SELECT 
              tourist_id, 
              first_name, 
              last_name, 
              email, 
              phone, 
              nationality,
              gender,
              registration_type,
              created_at
            FROM tourists
            ORDER BY created_at DESC
            LIMIT 5
          `)
          recentTourists = rows
        }
      } catch (error) {
        console.error("Error fetching recent tourists:", error)
      }

      console.log("Recent tourists count:", recentTourists.length)

      // Return dashboard data
      const responseData = {
        counts,
        recentTourists,
      }

      console.log("Sending response with data")
      return res.json(responseData)
    } catch (error) {
      console.error("Dashboard data error:", error)
      return res.status(500).json({ error: "Server error", details: error.message })
    }
  },

  // Get tourist statistics
  getTouristStats: async (req, res) => {
    try {
      // Check if user is admin
      if (!req.session.user || req.session.user.user_type !== "admin") {
        return res.status(403).json({ error: "Unauthorized" })
      }

      // Check if tourists table exists
      const [tables] = await db.query(`SHOW TABLES LIKE 'tourists'`)

      if (tables.length === 0) {
        return res.json({
          byType: [],
          byNationality: [],
          byMonth: [],
        })
      }

      // Initialize stats object
      const stats = {
        byType: [],
        byNationality: [],
        byMonth: [],
        byGender: [],
        byAge: [],
      }

      // Get stats by type
      try {
        const [rows] = await db.query(`
          SELECT 
            COALESCE(registration_type, 'Regular Tourist') as type,
            COUNT(*) as count,
            ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM tourists), 1) as percentage
          FROM tourists
          GROUP BY registration_type
          ORDER BY count DESC
        `)
        stats.byType = rows
      } catch (error) {
        console.error("Error getting tourist stats by type:", error)
      }

      // Get stats by nationality
      try {
        const [rows] = await db.query(`
          SELECT 
            COALESCE(nationality, 'Not Specified') as nationality,
            COUNT(*) as count,
            ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM tourists), 1) as percentage
          FROM tourists
          GROUP BY nationality
          ORDER BY count DESC
          LIMIT 10
        `)
        stats.byNationality = rows
      } catch (error) {
        console.error("Error getting tourist stats by nationality:", error)
      }

      // Get stats by month
      try {
        const [rows] = await db.query(`
          SELECT 
            DATE_FORMAT(created_at, '%Y-%m') as month_year,
            DATE_FORMAT(created_at, '%b %Y') as month,
            COUNT(*) as count
          FROM tourists
          GROUP BY month_year
          ORDER BY month_year ASC
          LIMIT 12
        `)
        stats.byMonth = rows
      } catch (error) {
        console.error("Error getting tourist stats by month:", error)
      }

      // Get stats by gender
      try {
        const [rows] = await db.query(`
          SELECT 
            COALESCE(gender, 'Not Specified') as gender,
            COUNT(*) as count,
            ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM tourists), 1) as percentage
          FROM tourists
          GROUP BY gender
          ORDER BY count DESC
        `)
        stats.byGender = rows
      } catch (error) {
        console.error("Error getting tourist stats by gender:", error)
      }

      // Get stats by age bucket
      try {
        const [rows] = await db.query(`
          SELECT 
            CASE 
              WHEN age IS NULL THEN 'Unknown'
              WHEN age < 13 THEN '0-12'
              WHEN age BETWEEN 13 AND 17 THEN '13-17'
              WHEN age BETWEEN 18 AND 24 THEN '18-24'
              WHEN age BETWEEN 25 AND 34 THEN '25-34'
              WHEN age BETWEEN 35 AND 44 THEN '35-44'
              WHEN age BETWEEN 45 AND 54 THEN '45-54'
              WHEN age >= 55 THEN '55+'
              ELSE 'Unknown'
            END AS age_bucket,
            COUNT(*) as count,
            ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM tourists), 1) as percentage
          FROM tourists
          GROUP BY age_bucket
          ORDER BY 
            CASE age_bucket
              WHEN '0-12' THEN 1
              WHEN '13-17' THEN 2
              WHEN '18-24' THEN 3
              WHEN '25-34' THEN 4
              WHEN '35-44' THEN 5
              WHEN '45-54' THEN 6
              WHEN '55+' THEN 7
              ELSE 8
            END
        `)
        stats.byAge = rows
      } catch (error) {
        console.error("Error getting tourist stats by age:", error)
      }

      res.json(stats)
    } catch (error) {
      console.error("Get tourist stats error:", error)
      res.status(500).json({ error: "Server error", details: error.message })
    }
  },

  // Create service provider
  createServiceProvider: async (req, res) => {
    try {
      // Check if current user is admin
      if (!req.session.user || req.session.user.user_type !== "admin") {
        return res.status(403).json({ error: "Unauthorized" })
      }

      // Validate required fields
      const requiredFields = [
        "username",
        "email",
        "first_name",
        "last_name",
        "contact_number",
        "password",
        "provider_type",
      ]
      const missingFields = requiredFields.filter((field) => !req.body[field])

      if (missingFields.length > 0) {
        return res.status(400).json({
          error: `Missing required fields: ${missingFields.join(", ")}`,
        })
      }

      const providerData = {
        username: req.body.username,
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        contact_number: req.body.contact_number,
        email: req.body.email,
        password: req.body.password,
        date_of_birth: req.body.date_of_birth || "2000-01-01",
        gender: req.body.gender || "Other",
        nationality: req.body.nationality || "N/A",
        address: req.body.address || "N/A",
        profile_picture: "default.jpg",
        user_type: req.body.provider_type, // 'entry_provider' or 'activity_provider'
      }

      // Check if email already exists
      const [existingUser] = await db.query("SELECT * FROM users WHERE email = ?", [providerData.email])
      if (existingUser.length > 0) {
        return res.status(400).json({ error: "Email already registered" })
      }

      // Check if username already exists
      const [existingUsername] = await db.query("SELECT * FROM users WHERE username = ?", [providerData.username])
      if (existingUsername.length > 0) {
        return res.status(400).json({ error: "Username already taken" })
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(providerData.password, 10)
      providerData.password = hashedPassword

      // Create provider
      const [result] = await db.query(
        `INSERT INTO users (
          username, first_name, last_name, contact_number, email, password, 
          date_of_birth, gender, nationality, address, profile_picture, user_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          providerData.username,
          providerData.first_name,
          providerData.last_name,
          providerData.contact_number,
          providerData.email,
          providerData.password,
          providerData.date_of_birth,
          providerData.gender,
          providerData.nationality,
          providerData.address,
          providerData.profile_picture,
          providerData.user_type,
        ],
      )

      res.status(201).json({
        message: "Service provider created successfully",
        providerId: result.insertId,
      })
    } catch (error) {
      console.error("Create provider error:", error)
      res.status(500).json({ error: "Server error", details: error.message })
    }
  },

  // Get all providers
  getAllProviders: async (req, res) => {
    try {
      // Check if current user is admin
      if (!req.session.user || req.session.user.user_type !== "admin") {
        return res.status(403).json({ error: "Unauthorized" })
      }

      // Get providers
      const [providers] = await db.query(`
        SELECT 
          user_id as id, 
          username, 
          email, 
          first_name, 
          last_name, 
          contact_number,
          user_type as provider_type, 
          gender,
          is_suspended,
          suspension_reason,
          suspended_at, 
          created_at
        FROM users
        WHERE user_type IN ('entry_provider', 'activity_provider')
        ORDER BY created_at DESC
      `)

      res.json(providers)
    } catch (error) {
      console.error("Get providers error:", error)
      res.status(500).json({ error: "Server error", details: error.message })
    }
  },

  // Get all tourists
  getAllTourists: async (req, res) => {
    try {
      // Check if current user is admin
      if (!req.session.user || req.session.user.user_type !== "admin") {
        return res.status(403).json({ error: "Unauthorized" })
      }

      // Check if tourists table exists
      const [tables] = await db.query(`SHOW TABLES LIKE 'tourists'`)

      if (tables.length === 0) {
        return res.json([])
      }

      // Get tourists
      const [tourists] = await db.query(`
        SELECT 
          tourist_id as id, 
          first_name, 
          last_name, 
          email, 
          phone as contact_number,
          nationality, 
          gender, 
          registration_type,
          created_at
        FROM tourists
        ORDER BY created_at DESC
      `)

      res.json(tourists)
    } catch (error) {
      console.error("Get tourists error:", error)
      res.status(500).json({ error: "Server error", details: error.message })
    }
  },

 // Update getAllPackages for only 2 activity types
// Update getAllPackages method
getAllPackages: async (req, res) => {
  try {
    // Check if the user is an admin
    if (!req.session.user || req.session.user.user_type !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });  // JSON error for unauthorized access
    }

    const [packages] = await db.query(`
      SELECT p.*, u.username as created_by_name
      FROM packages p
      LEFT JOIN users u ON p.created_by = u.user_id
      ORDER BY p.created_at DESC
    `);

    res.json(packages);  // Return JSON response with the packages
  } catch (error) {
    console.error("Get packages error:", error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
},

 // Update createPackage for only 2 activity types
// Update createPackage method
createPackage: async (req, res) => {
  try {
    if (!req.session.user || req.session.user.user_type !== "admin") {
      return res.status(403).json({ error: "Unauthorized" })
    }

    if (!req.file) {
      return res.status(400).json({ error: "Package image is required" })
    }

    const packageData = {
      name: req.body.name,
      activity_type: req.body.activity_type || 'Island Hopping',
      description: req.body.description,
      price: Number.parseFloat(req.body.price),
      duration: Number.parseInt(req.body.duration),
      max_participants: Number.parseInt(req.body.max_participants),
      includes: req.body.includes,
      image: req.file.filename,
      created_by: req.session.user.user_id,
      gcash_number: req.body.gcash_number,
      gcash_name: req.body.gcash_name,
    }

    // Validate activity_type (only allow 2 options)
    if (!['Island Hopping', 'Snorkeling'].includes(packageData.activity_type)) {
      return res.status(400).json({ error: "Invalid activity type. Only 'Island Hopping' and 'Snorkeling' are allowed." })
    }

    // Create package
    const [result] = await db.query(
      `INSERT INTO packages (
        name, activity_type, description, price, duration, max_participants,
        includes, image, created_by, gcash_number, gcash_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        packageData.name,
        packageData.activity_type,
        packageData.description || "",
        packageData.price,
        packageData.duration || 1,
        packageData.max_participants || 10,
        packageData.includes || "",
        packageData.image,
        packageData.created_by,
        packageData.gcash_number || "",
        packageData.gcash_name || "",
      ],
    )

    res.status(201).json({
      success: true,
      message: "Package created successfully",
      packageId: result.insertId,
    })
  } catch (error) {
    console.error("Create package error:", error)
    res.status(500).json({ success: false, error: "Server error", details: error.message })
  }
},

  // Update provider
  updateProvider: async (req, res) => {
    try {
      // Check if current user is admin
      if (!req.session.user || req.session.user.user_type !== "admin") {
        return res.status(403).json({ error: "Unauthorized" })
      }

      const { providerId } = req.params

      // Check if provider exists
      const [providerCheck] = await db.query(
        `SELECT user_id FROM users WHERE user_id = ? AND user_type IN ('entry_provider', 'activity_provider')`,
        [providerId],
      )

      if (providerCheck.length === 0) {
        return res.status(404).json({ error: "Provider not found" })
      }

      const updateData = {
        username: req.body.username,
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        contact_number: req.body.contact_number,
        email: req.body.email,
        user_type: req.body.provider_type, // Map provider_type to user_type
      }

      // If username is being changed, check if it's already taken
      if (updateData.username) {
        const [existingUsername] = await db.query("SELECT user_id FROM users WHERE username = ? AND user_id != ?", [
          updateData.username,
          providerId,
        ])
        if (existingUsername.length > 0) {
          return res.status(400).json({ error: "Username already taken" })
        }
      }

      // If email is being changed, check if it's already taken
      if (updateData.email) {
        const [existingEmail] = await db.query("SELECT user_id FROM users WHERE email = ? AND user_id != ?", [
          updateData.email,
          providerId,
        ])
        if (existingEmail.length > 0) {
          return res.status(400).json({ error: "Email already registered" })
        }
      }

      // If password is provided, hash it
      if (req.body.password) {
        updateData.password = await bcrypt.hash(req.body.password, 10)
      }

      // Build dynamic query
      let query = "UPDATE users SET "
      const queryParams = []
      const queryParts = []

      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          queryParts.push(`${key} = ?`)
          queryParams.push(value)
        }
      }

      if (queryParts.length === 0) {
        return res.status(400).json({ error: "No fields to update" })
      }

      query += queryParts.join(", ")
      query += " WHERE user_id = ? AND user_type IN ('entry_provider', 'activity_provider')"
      queryParams.push(providerId)

      const [result] = await db.query(query, queryParams)

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Provider not found or no changes made" })
      }

      res.json({ message: "Provider updated successfully" })
    } catch (error) {
      console.error("Update provider error:", error)
      res.status(500).json({ error: "Server error", details: error.message })
    }
  },

  // Delete provider
  deleteProvider: async (req, res) => {
    try {
      // Check if current user is admin
      if (!req.session.user || req.session.user.user_type !== "admin") {
        return res.status(403).json({ error: "Unauthorized" })
      }

      const { providerId } = req.params

      // Delete provider
      const [result] = await db.query(
        `DELETE FROM users WHERE user_id = ? AND user_type IN ('entry_provider', 'activity_provider')`,
        [providerId],
      )

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Provider not found" })
      }

      res.json({ message: "Provider deleted successfully" })
    } catch (error) {
      console.error("Delete provider error:", error)
      res.status(500).json({ error: "Server error", details: error.message })
    }
  },

  // Update the existing updatePackage method to include activity_type
updatePackage: async (req, res) => {
  try {
    if (!req.session.user || req.session.user.user_type !== "admin") {
      return res.status(403).json({ error: "Unauthorized" })
    }

    const { packageId } = req.params

    // Check if package exists
    const [packageCheck] = await db.query("SELECT * FROM packages WHERE id = ?", [packageId])

    if (packageCheck.length === 0) {
      return res.status(404).json({ error: "Package not found" })
    }

    const packageData = packageCheck[0]

    const updateData = {
      name: req.body.name,
      activity_type: req.body.activity_type,
      description: req.body.description,
      price: req.body.price ? Number.parseFloat(req.body.price) : undefined,
      duration: req.body.duration ? Number.parseInt(req.body.duration) : undefined,
      max_participants: req.body.max_participants ? Number.parseInt(req.body.max_participants) : undefined,
      includes: req.body.includes,
      gcash_number: req.body.gcash_number,
      gcash_name: req.body.gcash_name,
    }

    // Validate activity_type
    if (updateData.activity_type && !['Island Hopping', 'Snorkeling'].includes(updateData.activity_type)) {
      return res.status(400).json({ error: "Invalid activity type. Only 'Island Hopping' and 'Snorkeling' are allowed." })
    }

    // If a new image is uploaded
    if (req.file) {
      updateData.image = req.file.filename

      // Delete old image if it exists and is not the default
      if (packageData.image && packageData.image !== "placeholder.svg") {
        const imagePath = path.join(__dirname, "../uploads/packages", packageData.image)
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath)
        }
      }
    }

    // Build dynamic query
    let query = "UPDATE packages SET "
    const queryParams = []
    const queryParts = []

    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined) {
        queryParts.push(`${key} = ?`)
        queryParams.push(value)
      }
    }

    if (queryParts.length === 0) {
      return res.status(400).json({ error: "No fields to update" })
    }

    query += queryParts.join(", ")
    query += " WHERE id = ?"
    queryParams.push(packageId)

    const [result] = await db.query(query, queryParams)

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Package not found or no changes made" })
    }

    res.json({ success: true, message: "Package updated successfully" })
  } catch (error) {
    console.error("Update package error:", error)
    res.status(500).json({ success: false, error: "Server error", details: error.message })
  }
},

  // Delete package
  deletePackage: async (req, res) => {
    try {
      // Check if current user is admin
      if (!req.session.user || req.session.user.user_type !== "admin") {
        return res.status(403).json({ error: "Unauthorized" })
      }

      // Check if packages table exists
      const [tables] = await db.query(`SHOW TABLES LIKE 'packages'`)

      if (tables.length === 0) {
        return res.status(404).json({ error: "Packages feature is not available" })
      }

      const { packageId } = req.params

      // Get package to get the image filename
      const [packageCheck] = await db.query("SELECT * FROM packages WHERE id = ?", [packageId])

      if (packageCheck.length === 0) {
        return res.status(404).json({ error: "Package not found" })
      }

      const packageData = packageCheck[0]

      // Delete package
      const [result] = await db.query("DELETE FROM packages WHERE id = ?", [packageId])

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Package not found" })
      }

      // Delete image if it exists and is not the default
      if (packageData.image && packageData.image !== "placeholder.svg") {
        const imagePath = path.join(__dirname, "../uploads/packages", packageData.image)
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath)
        }
      }

      res.json({ message: "Package deleted successfully" })
    } catch (error) {
      console.error("Delete package error:", error)
      res.status(500).json({ error: "Server error", details: error.message })
    }
  },// Render manage packages page
renderManagePackages: async (req, res) => {
  try {
    // Check if user is admin
    if (!req.session.user || req.session.user.user_type !== "admin") {
      req.session.error = "You do not have permission to access this page."
      return res.redirect("/userlogin")
    }

    // Fetch the packages from the database
    const [packages] = await db.query('SELECT * FROM packages ORDER BY created_at DESC');

    // Render the manage packages template and pass the fetched packages
    res.render("admin/ManagePackages", {
      title: "Manage Packages",
      user: req.session.user,
      packages: packages,  // Pass packages data to the view
    });
  } catch (error) {
    console.error("Error rendering manage packages page:", error)
    req.session.error = "Error loading packages page"
    res.redirect("/admin/dashboard")
  }
},
// Create Admin Account
createAdminAccount: async (req, res) => {
    try {
      const { 
        username, 
        email, 
        password, 
        first_name, 
        last_name, 
        contact_number, 
        date_of_birth, 
        gender, 
        nationality, 
        address 
      } = req.body;

      // Validate required fields
      if (!username || !email || !password || !first_name || !last_name || 
          !contact_number || !date_of_birth || !gender || !nationality || !address) {
        return res.status(400).json({ message: 'All fields are required' });
      }

      // Hash password before saving it to database
      const hashedPassword = await bcrypt.hash(password, 10);

      const adminData = {
        username,
        email,
        password: hashedPassword,  // Use the hashed password
        first_name,
        last_name,
        contact_number,
        date_of_birth,
        gender,
        nationality,
        address,
      };

      // Call the model to insert admin data into the database
      const result = await AdminModel.createAdminAccount(adminData);

      // Return JSON success response
      return res.json({ 
        success: true, 
        message: 'Admin account created successfully!',
        data: { username, email, first_name, last_name }
      });
    } catch (error) {
      console.error('Error creating admin account:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Error creating admin account. Please try again.' 
      });
    }
  },
  getAgeGenderReport: async (req, res) => {
    try {
      console.log('Age-gender report request received');
      console.log('Session user:', req.session.user);
      console.log('User type:', req.session.user?.user_type);
      console.log('Environment:', process.env.NODE_ENV);
      
      if (!req.session.user || req.session.user.user_type !== "admin") {
        console.log('Unauthorized access attempt to age-gender report');
        return res.status(403).json({ 
          error: "Unauthorized",
          details: "Admin access required",
          sessionExists: !!req.session.user,
          userType: req.session.user?.user_type || 'none'
        })
      }

      // Add database connection check
      const db = require('../config/db');
      if (!db) {
        throw new Error('Database connection not available');
      }

      console.log('Fetching age-gender data...');
      const [byGender, byAge] = await Promise.all([
        ReportModel.getMonthlyGender(),
        ReportModel.getMonthlyAgeBuckets(),
      ])

      console.log('Age-gender data fetched:', { 
        genderCount: byGender?.length || 0, 
        ageCount: byAge?.length || 0,
        sampleGender: byGender?.slice(0, 2),
        sampleAge: byAge?.slice(0, 2)
      });

      res.json({ byGender, byAge })
    } catch (error) {
      console.error('Get age-gender report error:', error)
      res.status(500).json({ 
        error: 'Server error', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    }
  },
};



module.exports = AdminController
