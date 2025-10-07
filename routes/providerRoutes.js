const express = require("express")
const router = express.Router()
const db = require("../config/db")
const sessionAuth = require("../middleware/sessionAuth")
const roleAuth = require("../middleware/roleAuth")
const ProviderController = require("../controller/ProviderController")

// Add error logging middleware
router.use((req, res, next) => {
  console.log(`🔍 Provider route: ${req.method} ${req.path}`)
  console.log(`👤 User:`, req.session.user?.username, req.session.user?.user_type)
  next()
})

// Entry Provider Dashboard - USING 'picture' COLUMN DIRECTLY
router.get("/entry", sessionAuth, roleAuth(["entry_provider"]), async (req, res) => {
  try {
    console.log("✅ Entry dashboard accessed by:", req.session.user.username)

    // Get today's date
    const today = new Date().toISOString().split("T")[0]
    console.log("📅 Today's date:", today)

    // Get all tourists with PICTURE column directly
    const [tourists] = await db.query(
      `SELECT 
        t.tourist_id,
        t.first_name,
        t.last_name, 
        t.email,
        t.phone,
        t.nationality,
        t.picture,
        t.arrival_date,
        t.departure_date,
        t.verified_at,
        t.created_at
      FROM tourists t 
      ORDER BY t.created_at DESC 
      LIMIT 50`,
    )

    console.log("👥 Found tourists:", tourists.length)

    // Log picture information for debugging
    const touristsWithPictures = tourists.filter((t) => t.picture && t.picture !== "default.jpg")
    console.log("📸 Tourists with pictures:", touristsWithPictures.length)

    if (touristsWithPictures.length > 0) {
      console.log(
        "📸 Sample picture paths:",
        touristsWithPictures.slice(0, 3).map((t) => ({
          name: `${t.first_name} ${t.last_name}`,
          picture: t.picture,
        })),
      )
    }

    // Simple stats calculation
    const stats = {
      total_today: tourists.filter((t) => {
        const arrivalDate = new Date(t.arrival_date).toISOString().split("T")[0]
        return arrivalDate === today
      }).length,
      verified: tourists.filter((t) => t.verified_at).length,
      pending: tourists.filter((t) => !t.verified_at).length,
      expired: tourists.filter((t) => {
        const departureDate = new Date(t.departure_date)
        return departureDate < new Date()
      }).length,
    }

    console.log("📊 Stats:", stats)

    // Render the dashboard
    res.render("provider/entry-dashboard", {
      title: "Entry Provider Dashboard",
      tourists: tourists,
      stats: stats,
      user: req.session.user,
    })
  } catch (error) {
    console.error("❌ Entry dashboard error:", error.message)
    console.error("📍 Error stack:", error.stack)

    // Send detailed error for debugging
    res.status(500).send(`
      <h1>Entry Dashboard Error</h1>
      <p><strong>Error:</strong> ${error.message}</p>
      <p><strong>User:</strong> ${req.session.user?.username}</p>
      <p><strong>User Type:</strong> ${req.session.user?.user_type}</p>
      <pre>${error.stack}</pre>
    `)
  }
})

// Verify Tourist Entry
router.post("/entry/verify/:touristId", sessionAuth, roleAuth(["entry_provider"]), async (req, res) => {
  try {
    const { touristId } = req.params
    console.log("✅ Verifying tourist:", touristId)

    await db.query(
      `UPDATE tourists 
       SET verified_at = NOW() 
       WHERE tourist_id = ?`,
      [touristId],
    )

    res.json({
      success: true,
      message: "Tourist verified successfully",
    })
  } catch (error) {
    console.error("❌ Verification error:", error)
    res.status(500).json({
      success: false,
      message: "Verification failed: " + error.message,
    })
  }
})

// Search Tourists - USING 'picture' COLUMN DIRECTLY
router.get("/entry/search", sessionAuth, roleAuth(["entry_provider"]), async (req, res) => {
  try {
    const { q } = req.query
    console.log("🔍 Searching for:", q)

    const [tourists] = await db.query(
      `SELECT 
        tourist_id,
        first_name,
        last_name,
        email,
        phone,
        picture,
        verified_at
      FROM tourists 
      WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ?
      ORDER BY created_at DESC
      LIMIT 20`,
      [`%${q}%`, `%${q}%`, `%${q}%`],
    )

    console.log("📋 Search results:", tourists.length)
    console.log(
      "📸 Search results with pictures:",
      tourists.filter((t) => t.picture && t.picture !== "default.jpg").length,
    )
    res.json({ tourists })
  } catch (error) {
    console.error("❌ Search error:", error)
    res.status(500).json({
      success: false,
      message: "Search failed: " + error.message,
    })
  }
})

// Get Tourist by QR Code - USING 'picture' COLUMN DIRECTLY
router.post("/entry/scan-qr", sessionAuth, roleAuth(["entry_provider"]), async (req, res) => {
  try {
    const { qrData } = req.body
    console.log("🔍 QR scan request:", qrData)

    // Extract information from QR text format
    const touristInfo = extractTouristInfoFromQR(qrData)
    console.log("🎯 Extracted tourist info:", touristInfo)

    if (!touristInfo) {
      return res.status(400).json({
        success: false,
        message: "Could not extract tourist information from QR code",
      })
    }

    // Search for tourist by name and phone - INCLUDING EXISTING PICTURES FROM 'picture' COLUMN
    let query = `SELECT 
      tourist_id,
      first_name,
      last_name,
      email,
      phone,
      nationality,
      picture,
      arrival_date,
      departure_date,
      verified_at
    FROM tourists WHERE 1=1`

    const params = []

    // Build search query based on available info
    if (touristInfo.name) {
      const nameParts = touristInfo.name.toLowerCase().split(" ")
      if (nameParts.length >= 2) {
        query += ` AND (LOWER(first_name) LIKE ? AND LOWER(last_name) LIKE ?)`
        params.push(`%${nameParts[0]}%`, `%${nameParts[nameParts.length - 1]}%`)
      } else {
        query += ` AND (LOWER(first_name) LIKE ? OR LOWER(last_name) LIKE ?)`
        params.push(`%${nameParts[0]}%`, `%${nameParts[0]}%`)
      }
    }

    if (touristInfo.phone) {
      query += ` AND phone LIKE ?`
      params.push(`%${touristInfo.phone}%`)
    }

    console.log("🔍 Search query:", query)
    console.log("🔍 Search params:", params)

    const [tourists] = await db.query(query, params)

    if (tourists.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Tourist not found. Searched for: ${touristInfo.name || "Unknown"}, Phone: ${touristInfo.phone || "Unknown"}`,
      })
    }

    // If multiple matches, return the first one
    const tourist = tourists[0]
    console.log("✅ Found tourist:", tourist.first_name, tourist.last_name)
    console.log("📸 Tourist picture path:", tourist.picture)

    res.json({
      success: true,
      tourist: tourist,
      matches: tourists.length > 1 ? `Found ${tourists.length} matches, showing first result` : null,
    })
  } catch (error) {
    console.error("❌ QR scan error:", error)
    res.status(500).json({
      success: false,
      message: "QR scan failed: " + error.message,
    })
  }
})

// Helper function to extract tourist info from QR text
function extractTouristInfoFromQR(qrData) {
  console.log("🔍 Parsing QR data:", qrData)

  try {
    // Try JSON format first
    const jsonData = JSON.parse(qrData)
    return {
      id: jsonData.tourist_id || jsonData.id,
      name: jsonData.name,
      phone: jsonData.phone,
    }
  } catch {
    // Handle text format: "Name: janine lubaton, Phone: 0699461, Type: Regular Tourist"
    const info = {}

    // Extract name
    const nameMatch = qrData.match(/Name:\s*([^,]+)/i)
    if (nameMatch) {
      info.name = nameMatch[1].trim()
    }

    // Extract phone
    const phoneMatch = qrData.match(/Phone:\s*([^,]+)/i)
    if (phoneMatch) {
      info.phone = phoneMatch[1].trim()
    }

    // Extract type
    const typeMatch = qrData.match(/Type:\s*([^,]+)/i)
    if (typeMatch) {
      info.type = typeMatch[1].trim()
    }

    // Try to extract tourist ID if present
    const idMatch = qrData.match(/ID:\s*(\d+)/i)
    if (idMatch) {
      info.id = Number.parseInt(idMatch[1])
    }

    console.log("📋 Parsed info:", info)
    return Object.keys(info).length > 0 ? info : null
  }
}

// Activity Provider Dashboard
router.get("/activities", sessionAuth, roleAuth(["activity_provider"]), async (req, res) => {
  try {
    console.log("Activity dashboard accessed by user:", req.session.user)

    // Check if packages table exists
    let packages = []
    let bookings = []

    try {
      const [packagesResult] = await db.query(`SELECT * FROM packages WHERE created_by = ? ORDER BY created_at DESC`, [
        req.session.user.user_id,
      ])
      packages = packagesResult
    } catch (packagesError) {
      console.log("Packages table might not exist:", packagesError.message)
    }

    try {
      const [bookingsResult] = await db.query(
        `
              SELECT b.*, p.name as package_name, p.activity_type,
                     t.first_name, t.last_name, t.email, t.phone
              FROM bookings b
              JOIN packages p ON b.package_id = p.id
              LEFT JOIN tourists t ON b.tourist_id = t.tourist_id
              WHERE p.created_by = ?
              ORDER BY b.created_at DESC
          `,
        [req.session.user.user_id],
      )
      bookings = bookingsResult
    } catch (bookingsError) {
      console.log("Bookings query failed:", bookingsError.message)
    }

    // Calculate stats
    const activeBookings = bookings.filter((b) => b.status === "confirmed").length
    const pendingBookings = bookings.filter((b) => b.status === "pending").length

    const stats = {
      totalPackages: packages.length,
      totalBookings: bookings.length,
      activeBookings: activeBookings,
      pendingBookings: pendingBookings,
    }

    res.render("provider/activity-dashboard", {
      title: "Activity Provider Dashboard",
      packages: packages,
      bookings: bookings,
      stats: stats,
      user: req.session.user,
    })
  } catch (error) {
    console.error("❌ Activity dashboard error:", error)
    res.status(500).json({
      error: "Error loading dashboard",
      message: error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    })
  }
})

// Package Management Routes - Using ProviderController ONLY

// Create Package - Enhanced with image support
router.post(
  "/activities/packages",
  sessionAuth,
  roleAuth(["activity_provider"]),
  (req, res, next) => {
    ProviderController.upload.single("image")(req, res, (err) => {
      if (err) {
        console.error("Upload error:", err)
        return res.status(400).json({
          success: false,
          message: err.message || "File upload failed",
        })
      }
      next()
    })
  },
  ProviderController.createPackage,
)

// Get Package by ID for editing
router.get(
  "/activities/packages/:packageId",
  sessionAuth,
  roleAuth(["activity_provider"]),
  ProviderController.getPackageById,
)

// Update Package - Enhanced with image support
router.put(
  "/activities/packages/:packageId",
  sessionAuth,
  roleAuth(["activity_provider"]),
  (req, res, next) => {
    ProviderController.upload.single("image")(req, res, (err) => {
      if (err) {
        console.error("Upload error:", err)
        return res.status(400).json({
          success: false,
          message: err.message || "File upload failed",
        })
      }
      next()
    })
  },
  ProviderController.updatePackage,
)

// Delete Package
router.delete(
  "/activities/packages/:packageId",
  sessionAuth,
  roleAuth(["activity_provider"]),
  ProviderController.deletePackage,
)

// Update Booking Status
router.post(
  "/activities/bookings/:bookingId/status",
  sessionAuth,
  roleAuth(["activity_provider"]),
  async (req, res) => {
    try {
      const { bookingId } = req.params
      const { status } = req.body

              await db.query(
        `UPDATE bookings 
         SET status = ?, updated_at = NOW() 
         WHERE id = ?`,
        [status, bookingId],
      )

      // If provider confirms booking, record the confirmation timestamp
      if (status === 'confirmed') {
        await db.query(
          `UPDATE bookings SET provider_confirmed_at = NOW() WHERE id = ?`,
          [bookingId],
        )
      }

      // If provider marks completed, record the completion timestamp and flag
      if (status === 'completed') {
        await db.query(
          `UPDATE bookings SET provider_completed_at = NOW(), activity_completed = 1 WHERE id = ?`,
          [bookingId],
        )
      }

      res.json({ success: true, message: "Booking status updated successfully" })
    } catch (error) {
      console.error("Booking update error:", error)
      res.status(500).json({ success: false, message: "Failed to update booking status" })
    }
  },
)

// Cancel booking with reason
router.post(
  "/activities/bookings/:bookingId/cancel",
  sessionAuth,
  roleAuth(["activity_provider"]),
  async (req, res) => {
    try {
      const { bookingId } = req.params
      const { status, cancellation_reason, cancellation_notes } = req.body

      // Update booking with cancellation details
      await db.query(
        `UPDATE bookings 
         SET status = ?, 
             cancellation_reason = ?, 
             cancellation_notes = ?,
             updated_at = NOW() 
         WHERE id = ?`,
        [status, cancellation_reason, cancellation_notes, bookingId],
      )

      res.json({ success: true, message: "Booking cancelled successfully" })
    } catch (error) {
      console.error("Booking cancellation error:", error)
      res.status(500).json({ success: false, message: "Failed to cancel booking" })
    }
  },
)

// Reactivate cancelled booking
router.post(
  "/activities/bookings/:bookingId/reactivate",
  sessionAuth,
  roleAuth(["activity_provider"]),
  async (req, res) => {
    try {
      const { bookingId } = req.params
      const { status } = req.body

      // Update booking to reactivate
      await db.query(
        `UPDATE bookings 
         SET status = ?, 
             cancellation_reason = NULL, 
             cancellation_notes = NULL,
             updated_at = NOW() 
         WHERE id = ?`,
        [status, bookingId],
      )

      res.json({ success: true, message: "Booking reactivated successfully" })
    } catch (error) {
      console.error("Booking reactivation error:", error)
      res.status(500).json({ success: false, message: "Failed to reactivate booking" })
    }
  },
)

// Mark refund as processed
router.post(
  "/activities/bookings/:bookingId/refund-processed",
  sessionAuth,
  roleAuth(["activity_provider"]),
  async (req, res) => {
    try {
      const { bookingId } = req.params

      // Update booking to mark refund as processed
      await db.query(
        `UPDATE bookings 
         SET refund_processed = 1, refund_processed_at = NOW(), updated_at = NOW() 
         WHERE id = ? AND status = 'cancelled'`,
        [bookingId],
      )

      res.json({
        success: true,
        message: "Refund marked as processed successfully",
      })
    } catch (error) {
      console.error("Error marking refund as processed:", error)
      res.status(500).json({
        success: false,
        message: "Failed to mark refund as processed",
      })
    }
  },
)


// Get Monthly Income Data for Charts
router.get("/activities/analytics/monthly-income", sessionAuth, roleAuth(["activity_provider"]), async (req, res) => {
  try {
    console.log("📊 Fetching monthly income data for user:", req.session.user.user_id)

    // Get monthly income data for the last 12 months
    const [monthlyData] = await db.query(`
      SELECT 
        DATE_FORMAT(b.created_at, '%Y-%m') as month,
        COUNT(b.id) as total_bookings,
        SUM(CAST(b.total_amount AS DECIMAL(10,2))) as total_income
      FROM bookings b
      JOIN packages p ON b.package_id = p.id
      WHERE p.created_by = ?
        AND b.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        AND b.status IN ('confirmed', 'completed')
      GROUP BY DATE_FORMAT(b.created_at, '%Y-%m')
      ORDER BY month ASC
    `, [req.session.user.user_id])

    // Get monthly booking counts for the last 12 months
    const [bookingCounts] = await db.query(`
      SELECT 
        DATE_FORMAT(b.created_at, '%Y-%m') as month,
        COUNT(b.id) as booking_count
      FROM bookings b
      JOIN packages p ON b.package_id = p.id
      WHERE p.created_by = ?
        AND b.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(b.created_at, '%Y-%m')
      ORDER BY month ASC
    `, [req.session.user.user_id])

    console.log("📈 Monthly income data:", monthlyData.length, "months")
    console.log("📅 Monthly booking counts:", bookingCounts.length, "months")

    res.json({
      success: true,
      monthlyIncome: monthlyData,
      monthlyBookings: bookingCounts
    })
  } catch (error) {
    console.error("❌ Error fetching monthly income data:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch monthly income data"
    })
  }
})

// Search Bookings by Reference Code - CORRECTED FOR YOUR DATABASE SCHEMA
router.get("/activities/bookings/search", sessionAuth, roleAuth(["activity_provider"]), async (req, res) => {
  try {
    const { q } = req.query
    console.log("🔍 Searching bookings for:", q)

    if (!q || q.trim().length < 2) {
      return res.json({ success: false, message: "Please enter at least 2 characters to search" })
    }

    const searchTerm = `%${q.trim()}%`

    const [bookings] = await db.query(
      `
        SELECT b.*, p.name as package_name, p.activity_type,
               t.first_name, t.last_name, t.email, t.phone
        FROM bookings b
        JOIN packages p ON b.package_id = p.id
        LEFT JOIN tourists t ON b.tourist_id = t.tourist_id
        WHERE p.created_by = ? 
        AND (
          b.booking_reference LIKE ? OR
          CAST(b.id AS CHAR) LIKE ? OR
          t.first_name LIKE ? OR
          t.last_name LIKE ? OR
          t.email LIKE ? OR
          t.phone LIKE ? OR
          b.contact_number LIKE ?
        )
        ORDER BY b.created_at DESC
        LIMIT 20
        `,
      [req.session.user.user_id, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm],
    )

    console.log("📋 Booking search results:", bookings.length)
    res.json({ success: true, bookings })
  } catch (error) {
    console.error("❌ Booking search error:", error)
    res.status(500).json({
      success: false,
      message: "Search failed: " + error.message,
    })
  }
})

module.exports = router
