const express = require("express")
const router = express.Router()
const AdminController = require("../controller/AdminController")
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const roleAuth = require("../middleware/roleAuth")
const ensureLoggedIn = require("../middleware/sessionAuth")
const db = require("../config/db")
const ProviderModel = require("../model/ProviderModel")
const PackageModel = require("../model/PackageModel")

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadDir

    // Determine the upload directory based on the route
    if (req.originalUrl.includes("tourist-locations")) {
      uploadDir = path.join(__dirname, "../uploads/locations")
    } else {
      uploadDir = path.join(__dirname, "../uploads/packages")
    }

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)

    // Prefix based on the route
    let prefix = "file"
    if (req.originalUrl.includes("tourist-locations")) {
      prefix = "location"
    } else if (req.originalUrl.includes("packages")) {
      prefix = "package"
    }

    cb(null, `${prefix}-${uniqueSuffix}${ext}`)
  },
})

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true)
  } else {
    cb(new Error("Only image files are allowed!"), false)
  }
}

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter,
})

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File is too large. Maximum size is 5MB." })
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` })
  } else if (err) {
    return res.status(400).json({ error: err.message })
  }
  next()
}

// Middleware to prevent caching for all admin routes
router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")
  next()
})

// Apply authentication middleware to all admin routes
router.use(ensureLoggedIn)

// Add a specific middleware to check for admin role
const adminOnly = (req, res, next) => {
  if (req.session.user && req.session.user.user_type === "admin") {
    return next()
  }
  if (req.xhr || req.headers.accept.includes("application/json")) {
    return res.status(403).json({ error: "Unauthorized: Admin access required" })
  }
  req.session.error = "You do not have permission to access the admin area."
  return res.redirect("/userlogin")
}

router.use(adminOnly)

// Dashboard routes
router.get("/dashboard", AdminController.renderDashboard)
router.get("/dashboard-data", AdminController.getDashboardData)

// Provider management routes
router.get("/providers", AdminController.getAllProviders)
router.post("/providers", AdminController.createServiceProvider)
router.get("/providers/:providerId", async (req, res) => {
  try {
    // Check if user is admin
    if (req.session.user.user_type !== "admin") {
      return res.status(403).json({ error: "Unauthorized" })
    }

    // Get provider by ID - Direct database query
    const [rows] = await db.query(
      `
      SELECT 
        user_id as id, 
        username, 
        email, 
        first_name, 
        last_name, 
        contact_number,
        user_type as provider_type, 
        gender,
        date_of_birth,
        nationality,
        address, 
        created_at
      FROM users
      WHERE user_id = ? AND user_type IN ('entry_provider', 'activity_provider')
    `,
      [req.params.providerId],
    )

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Provider not found" })
    }

    res.json(rows[0])
  } catch (error) {
    console.error("Get provider error:", error)
    res.status(500).json({ error: "Server error", details: error.message })
  }
})

router.put("/providers/:providerId", AdminController.updateProvider)
router.delete("/providers/:providerId", AdminController.deleteProvider)

// Tourist management routes
router.get("/tourists", AdminController.getAllTourists)
router.get("/tourist-stats", AdminController.getTouristStats)

// FIXED: Package management API routes (these should come BEFORE the page routes)
router.get("/packages/data", AdminController.getAllPackages) // Changed from /packages to /packages/data
router.post("/packages", upload.single("image"), handleMulterError, AdminController.createPackage)
router.get("/packages/:packageId", async (req, res) => {
  try {
    // Check if user is admin
    if (req.session.user.user_type !== "admin") {
      return res.status(403).json({ error: "Unauthorized" })
    }

    // Get package by ID
    const packageData = await PackageModel.getPackageById(req.params.packageId)
    if (!packageData) {
      return res.status(404).json({ error: "Package not found" })
    }

    res.json(packageData)
  } catch (error) {
    console.error("Get package error:", error)
    res.status(500).json({ error: "Server error", details: error.message })
  }
})

router.put("/packages/:packageId", upload.single("image"), handleMulterError, AdminController.updatePackage)
router.delete("/packages/:packageId", AdminController.deletePackage)

// Admin views/pages routes (these should come AFTER the API routes)
router.get("/manage-providers", (req, res) => {
  res.render("admin/ManageProviders", { user: req.session.user })
})

router.get("/manage-tourists", (req, res) => {
  res.render("admin/ManageTourists", { user: req.session.user })
})

// This is the route that renders the tourist locations management page
router.get("/manage-location", (req, res) => {
  res.render("admin/ManageTouristLocations", { user: req.session.user })
})

router.get("/manage-packages", (req, res) => {
  res.render("admin/ManagePackages", { user: req.session.user })
})

router.get("/reports", (req, res) => {
  res.render("admin/Reports", { user: req.session.user })
})

router.get("/settings", (req, res) => {
  res.render("admin/Settings", { user: req.session.user })
})

// NEW: Admin booking approval routes
router.get("/bookings/pending", async (req, res) => {
  try {
    // Ensure admin access
    if (!req.session.user || req.session.user.user_type !== "admin") {
      return res.status(403).json({ error: "Unauthorized" })
    }

    const { q } = req.query
    const like = q ? `%${q.trim()}%` : null

    const params = []
    let where = "b.status = 'confirmed' AND b.admin_confirmed_at IS NULL"
    if (like) {
      where += ` AND (
        b.booking_reference LIKE ? OR
        t.first_name LIKE ? OR t.last_name LIKE ? OR
        u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.username LIKE ? OR
        pu.first_name LIKE ? OR pu.last_name LIKE ? OR pu.username LIKE ?
      )`
      params.push(like, like, like, like, like, like, like, like, like, like)
    }

    const [rows] = await db.query(
      `
      SELECT 
        b.id,
        b.booking_reference,
        b.booking_date,
        b.number_of_participants,
        b.total_amount,
        b.status,
        b.special_requests,
        b.created_at,
        p.id AS package_id,
        p.name AS package_name,
        p.activity_type,
        p.image AS package_image,
        COALESCE(t.first_name, u.first_name, '') AS first_name,
        COALESCE(t.last_name, u.last_name, '') AS last_name,
        COALESCE(t.email, u.email, '') AS email,
        COALESCE(t.phone, b.contact_number, u.contact_number, '') AS contact_number,
        pu.user_id AS provider_id,
        COALESCE(NULLIF(CONCAT(TRIM(pu.first_name), ' ', TRIM(pu.last_name)), ' '), pu.username, 'Unknown') AS provider_name
      FROM bookings b
      JOIN packages p ON b.package_id = p.id
      LEFT JOIN tourists t ON b.tourist_id = t.tourist_id
      LEFT JOIN users u ON b.user_id = u.user_id
      LEFT JOIN users pu ON p.created_by = pu.user_id
      WHERE ${where}
      ORDER BY b.created_at DESC
      `,
      params,
    )

    res.json(rows)
  } catch (error) {
    console.error("Admin pending bookings error:", error)
    res.status(500).json({ error: "Server error", details: error.message })
  }
})

router.post("/bookings/:bookingId/confirm", async (req, res) => {
  try {
    // Ensure admin access
    if (!req.session.user || req.session.user.user_type !== "admin") {
      return res.status(403).json({ error: "Unauthorized" })
    }

    const { bookingId } = req.params

    const [result] = await db.query(
      `UPDATE bookings SET admin_confirmed_at = NOW() WHERE id = ? AND status = 'confirmed'`,
      [bookingId],
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Booking not found or not pending" })
    }

    res.json({ success: true, message: "Booking confirmed" })
  } catch (error) {
    console.error("Admin confirm booking error:", error)
    res.status(500).json({ error: "Server error", details: error.message })
  }
})

// Get confirmed bookings
router.get("/bookings/confirmed", async (req, res) => {
  try {
    // Ensure admin access
    if (!req.session.user || req.session.user.user_type !== "admin") {
      return res.status(403).json({ error: "Unauthorized" })
    }

    const { q } = req.query
    const like = q ? `%${q.trim()}%` : null

    const params = []
    let where = "(b.status = 'confirmed' OR b.status = 'completed') AND b.admin_confirmed_at IS NOT NULL"
    if (like) {
      where += ` AND (
        b.booking_reference LIKE ? OR
        t.first_name LIKE ? OR t.last_name LIKE ? OR
        u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.username LIKE ? OR
        pu.first_name LIKE ? OR pu.last_name LIKE ? OR pu.username LIKE ?
      )`
      params.push(like, like, like, like, like, like, like, like, like, like)
    }

    const [rows] = await db.query(
      `
      SELECT 
        b.id,
        b.booking_reference,
        b.booking_date,
        b.number_of_participants,
        b.total_amount,
        b.status,
        b.special_requests,
        b.payment_method,
        b.payment_reference,
        b.created_at,
        p.id AS package_id,
        p.name AS package_name,
        p.activity_type,
        p.image AS package_image,
        COALESCE(t.first_name, u.first_name, '') AS first_name,
        COALESCE(t.last_name, u.last_name, '') AS last_name,
        COALESCE(t.email, u.email, '') AS email,
        COALESCE(t.phone, b.contact_number, u.contact_number, '') AS contact_number,
        pu.user_id AS provider_id,
        COALESCE(NULLIF(CONCAT(TRIM(pu.first_name), ' ', TRIM(pu.last_name)), ' '), pu.username, 'Unknown') AS provider_name
      FROM bookings b
      JOIN packages p ON b.package_id = p.id
      LEFT JOIN tourists t ON b.tourist_id = t.tourist_id
      LEFT JOIN users u ON b.user_id = u.user_id
      LEFT JOIN users pu ON p.created_by = pu.user_id
      WHERE ${where}
      ORDER BY b.created_at DESC
      `,
      params,
    )

    res.json(rows)
  } catch (error) {
    console.error("Admin confirmed bookings error:", error)
    res.status(500).json({ error: "Server error", details: error.message })
  }
})

// Cancel booking
router.post("/bookings/:bookingId/cancel", async (req, res) => {
  try {
    // Ensure admin access
    if (!req.session.user || req.session.user.user_type !== "admin") {
      return res.status(403).json({ error: "Unauthorized" })
    }

    const { bookingId } = req.params

    const [result] = await db.query(
      `UPDATE bookings SET status = 'cancelled', updated_at = NOW() WHERE id = ? AND status = 'confirmed'`,
      [bookingId],
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Booking not found or not confirmed" })
    }

    res.json({ success: true, message: "Booking cancelled" })
  } catch (error) {
    console.error("Admin cancel booking error:", error)
    res.status(500).json({ error: "Server error", details: error.message })
  }
})

// Get detailed booking information
router.get("/bookings/:bookingId/details", async (req, res) => {
  try {
    // Ensure admin access
    if (!req.session.user || req.session.user.user_type !== "admin") {
      return res.status(403).json({ error: "Unauthorized" })
    }

    const { bookingId } = req.params

    const [bookings] = await db.query(`
      SELECT 
        b.*,
        p.name AS package_name,
        p.activity_type,
        p.description,
        p.duration,
        p.gcash_number,
        p.gcash_name,
        COALESCE(NULLIF(CONCAT(TRIM(pu.first_name), ' ', TRIM(pu.last_name)), ' '), pu.username, 'Unknown') AS provider_name,
        pu.contact_number AS provider_contact,
        COALESCE(t.first_name, u.first_name, '') AS first_name,
        COALESCE(t.last_name, u.last_name, '') AS last_name,
        COALESCE(t.email, u.email, '') AS email,
        COALESCE(t.phone, b.contact_number, u.contact_number, '') AS contact_number,
        -- Add the missing timestamp columns
        b.provider_confirmed_at,
        b.admin_confirmed_at,
        b.provider_completed_at AS activity_completed_at,
        b.activity_completed
      FROM bookings b
      LEFT JOIN packages p ON b.package_id = p.id
      LEFT JOIN tourists t ON b.tourist_id = t.tourist_id
      LEFT JOIN users u ON b.user_id = u.user_id
      LEFT JOIN users pu ON p.created_by = pu.user_id
      WHERE b.id = ?
    `, [bookingId])

    if (bookings.length === 0) {
      return res.status(404).json({ error: "Booking not found" })
    }

    const booking = bookings[0]
    res.json(booking)
  } catch (error) {
    console.error("Admin booking details error:", error)
    res.status(500).json({ error: "Server error", details: error.message })
  }
})

// Provider suspension/activation routes
router.post("/providers/:providerId/suspend", async (req, res) => {
  try {
    console.log("Suspend request received for provider:", req.params.providerId)
    console.log("Request body:", req.body)

    // Check if user is admin
    if (req.session.user.user_type !== "admin") {
      console.log("Unauthorized: User is not admin", req.session.user)
      return res.status(403).json({ error: "Unauthorized" })
    }

    const { providerId } = req.params
    const { reason } = req.body

    console.log("About to execute SQL query with params:", {
      reason: reason || null,
      suspended_by: req.session.user.user_id,
      providerId,
    })

    // Update provider status in database
    const [result] = await db.query(
      `UPDATE users 
       SET is_suspended = 1, 
           suspension_reason = ?, 
           suspended_at = CURRENT_TIMESTAMP, 
           suspended_by = ? 
       WHERE user_id = ? AND user_type IN ('entry_provider', 'activity_provider')`,
      [reason || null, req.session.user.user_id, providerId],
    )

    console.log("SQL update result:", result)

    if (result.affectedRows === 0) {
      console.log("Provider not found or not updated")
      return res.status(404).json({ error: "Provider not found" })
    }

    // Get updated provider
    const [rows] = await db.query(
      `SELECT 
        user_id as id, 
        username, 
        email, 
        first_name, 
        last_name, 
        contact_number,
        user_type as provider_type, 
        gender,
        date_of_birth,
        nationality,
        address,
        is_suspended,
        suspension_reason,
        suspended_at,
        created_at
      FROM users
      WHERE user_id = ?`,
      [providerId],
    )

    console.log("Updated provider data:", rows[0])
    res.json(rows[0])
  } catch (error) {
    console.error("Suspend provider error:", error)
    res.status(500).json({ error: "Server error", details: error.message })
  }
})

router.post("/providers/:providerId/activate", async (req, res) => {
  try {
    // Check if user is admin
    if (req.session.user.user_type !== "admin") {
      return res.status(403).json({ error: "Unauthorized" })
    }

    const { providerId } = req.params

    // Update provider status in database
    const [result] = await db.query(
      `UPDATE users 
       SET is_suspended = 0, 
           suspension_reason = NULL, 
           suspended_at = NULL, 
           suspended_by = NULL 
       WHERE user_id = ? AND user_type IN ('entry_provider', 'activity_provider')`,
      [providerId],
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Provider not found" })
    }

    // Get updated provider
    const [rows] = await db.query(
      `SELECT 
        user_id as id, 
        username, 
        email, 
        first_name, 
        last_name, 
        contact_number,
        user_type as provider_type, 
        gender,
        date_of_birth,
        nationality,
        address,
        is_suspended,
        suspension_reason,
        suspended_at,
        created_at
      FROM users
      WHERE user_id = ?`,
      [providerId],
    )

    res.json(rows[0])
  } catch (error) {
    console.error("Activate provider error:", error)
    res.status(500).json({ error: "Server error", details: error.message })
  }
})

// GPS Nearby route
router.get("/gps-nearby", async (req, res) => {
  try {
    // Check if user is admin
    if (!req.session.user || req.session.user.user_type !== "admin") {
      req.session.error = "You do not have permission to access this page."
      return res.redirect("/userlogin")
    }

    // Render the GPS Nearby page
    res.render("admin/GPSNearby", {
      title: "GPS Nearby",
      user: req.session.user,
    })
  } catch (error) {
    console.error("Error rendering GPS Nearby page:", error)
    req.session.error = "Error loading GPS Nearby page"
    res.redirect("/admin/dashboard")
  }
})

// Tourist Locations Management Routes
// IMPORTANT: This is the API endpoint that your JavaScript is trying to access
// This route returns JSON data of all tourist locations
router.get("/tourist-locations", async (req, res) => {
  try {
    // Check if user is admin
    if (!req.session.user || req.session.user.user_type !== "admin") {
      return res.status(403).json({ error: "Unauthorized" })
    }

    // Check if tourist_locations table exists
    const [tables] = await db.query(`SHOW TABLES LIKE 'tourist_locations'`)
    if (tables.length === 0) {
      // Create the table if it doesn't exist
      const createTableSQL = fs.readFileSync(
        path.join(__dirname, "../database/create_tourist_locations_table.sql"),
        "utf8",
      )
      await db.query(createTableSQL)
    }

    // Get all tourist locations
    const [locations] = await db.query(`
      SELECT * FROM tourist_locations
      ORDER BY name ASC
    `)

    res.json(locations)
  } catch (error) {
    console.error("Error getting tourist locations:", error)
    res.status(500).json({ error: "Server error", details: error.message })
  }
})

// Get a specific tourist location
router.get("/tourist-locations/:locationId", async (req, res) => {
  try {
    // Check if user is admin
    if (!req.session.user || req.session.user.user_type !== "admin") {
      return res.status(403).json({ error: "Unauthorized" })
    }

    const { locationId } = req.params

    // Get the location
    const [locations] = await db.query(
      `
      SELECT * FROM tourist_locations
      WHERE id = ?
    `,
      [locationId],
    )

    if (locations.length === 0) {
      return res.status(404).json({ error: "Tourist location not found" })
    }

    // Get additional images if any
    const [images] = await db.query(
      `
      SELECT * FROM tourist_location_images
      WHERE location_id = ?
      ORDER BY is_primary DESC, created_at ASC
    `,
      [locationId],
    )

    // Add images to the location object
    const location = locations[0]
    location.additional_images = images

    res.json(location)
  } catch (error) {
    console.error("Error getting tourist location:", error)
    res.status(500).json({ error: "Server error", details: error.message })
  }
})

// Create a new tourist location
router.post("/tourist-locations", upload.single("image"), async (req, res) => {
  try {
    // Check if user is admin
    if (!req.session.user || req.session.user.user_type !== "admin") {
      return res.status(403).json({ error: "Unauthorized" })
    }

    const {
      name,
      description,
      latitude,
      longitude,
      address,
      category,
      opening_hours,
      contact_info,
      website,
      entrance_fee,
      rating,
    } = req.body

    // Validate required fields
    if (!name || !description || !latitude || !longitude || !address || !category) {
      return res.status(400).json({ error: "Missing required fields" })
    }

    // Get the image filename if an image was uploaded
    const image = req.file ? req.file.filename : null

    // Insert the location into the database
    const [result] = await db.query(
      `
      INSERT INTO tourist_locations (
        name, description, latitude, longitude, address, category,
        image, opening_hours, contact_info, website, entrance_fee,
        rating, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        name,
        description,
        latitude,
        longitude,
        address,
        category,
        image,
        opening_hours || null,
        contact_info || null,
        website || null,
        entrance_fee || null,
        rating || null,
        req.session.user.user_id,
      ],
    )

    res.status(201).json({
      id: result.insertId,
      message: "Tourist location created successfully",
    })
  } catch (error) {
    console.error("Error creating tourist location:", error)
    res.status(500).json({ error: "Server error", details: error.message })
  }
})

// Update a tourist location
router.put("/tourist-locations/:locationId", upload.single("image"), async (req, res) => {
  try {
    // Check if user is admin
    if (!req.session.user || req.session.user.user_type !== "admin") {
      return res.status(403).json({ error: "Unauthorized" })
    }

    const { locationId } = req.params
    const {
      name,
      description,
      latitude,
      longitude,
      address,
      category,
      opening_hours,
      contact_info,
      website,
      entrance_fee,
      rating,
    } = req.body

    // Validate required fields
    if (!name || !description || !latitude || !longitude || !address || !category) {
      return res.status(400).json({ error: "Missing required fields" })
    }

    // Check if the location exists
    const [locations] = await db.query(
      `
      SELECT * FROM tourist_locations
      WHERE id = ?
    `,
      [locationId],
    )

    if (locations.length === 0) {
      return res.status(404).json({ error: "Tourist location not found" })
    }

    const location = locations[0]

    // Handle image update
    let imageToUpdate = location.image
    if (req.file) {
      // If a new image is uploaded, delete the old one
      if (location.image) {
        const oldImagePath = path.join(__dirname, "../public/uploads/locations", location.image)
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath)
        }
      }
      imageToUpdate = req.file.filename
    }

    // Update the location in the database
    const [result] = await db.query(
      `
      UPDATE tourist_locations
      SET name = ?, description = ?, latitude = ?, longitude = ?, address = ?,
          category = ?, image = ?, opening_hours = ?, contact_info = ?,
          website = ?, entrance_fee = ?, rating = ?
      WHERE id = ?
    `,
      [
        name,
        description,
        latitude,
        longitude,
        address,
        category,
        imageToUpdate,
        opening_hours || null,
        contact_info || null,
        website || null,
        entrance_fee || null,
        rating || null,
        locationId,
      ],
    )

    res.json({
      id: locationId,
      message: "Tourist location updated successfully",
    })
  } catch (error) {
    console.error("Error updating tourist location:", error)
    res.status(500).json({ error: "Server error", details: error.message })
  }
})

// Delete a tourist location
router.delete("/tourist-locations/:locationId", async (req, res) => {
  try {
    // Check if user is admin
    if (!req.session.user || req.session.user.user_type !== "admin") {
      return res.status(403).json({ error: "Unauthorized" })
    }

    const { locationId } = req.params

    // Get the location to get the image filename
    const [locations] = await db.query(
      `
      SELECT * FROM tourist_locations
      WHERE id = ?
    `,
      [locationId],
    )

    if (locations.length === 0) {
      return res.status(404).json({ error: "Tourist location not found" })
    }

    const location = locations[0]

    // Delete the location from the database
    await db.query(
      `
      DELETE FROM tourist_locations
      WHERE id = ?
    `,
      [locationId],
    )

    // Delete the image if it exists
    if (location.image) {
      const imagePath = path.join(__dirname, "../public/uploads/locations", location.image)
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath)
      }
    }

    // Delete any additional images
    const [images] = await db.query(
      `
      SELECT * FROM tourist_location_images
      WHERE location_id = ?
    `,
      [locationId],
    )

    for (const image of images) {
      const imagePath = path.join(__dirname, "../public/uploads/locations", image.image_path)
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath)
      }
    }

    // Delete the image records
    await db.query(
      `
      DELETE FROM tourist_location_images
      WHERE location_id = ?
    `,
      [locationId],
    )

    res.json({
      message: "Tourist location deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting tourist location:", error)
    res.status(500).json({ error: "Server error", details: error.message })
  }
})

// Error handler for this router
router.use((err, req, res, next) => {
  console.error("Admin routes error:", err)
  if (req.xhr || req.headers.accept.includes("application/json")) {
    return res.status(500).json({ error: "Server error", details: err.message })
  }
  req.session.error = "An error occurred in the admin area."
  res.redirect("/admin/dashboard")
})

router.post("/create-admin", AdminController.createAdminAccount)

router.get("/reports/age-gender-data", AdminController.getAgeGenderReport)

// Monthly chart data route
router.get("/reports/monthly-chart", AdminController.getMonthlyChartData)

module.exports = router
