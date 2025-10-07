const db = require("../config/db")
const path = require("path")
const fs = require("fs")
const multer = require("multer")

// Configure multer for package images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/packages")
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    cb(null, `package-${uniqueSuffix}${ext}`)
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

const ProviderController = {
  // Multer upload middleware
  upload: upload,

  // Create Package (Enhanced with image support)
  createPackage: async (req, res) => {
    try {
      // Check if user is activity provider
      if (!req.session.user || req.session.user.user_type !== "activity_provider") {
        return res.status(403).json({ success: false, message: "Unauthorized: Activity provider access required" })
      }

      const { name, activity_type, description, price, duration, max_participants, includes, gcash_number, gcash_name } = req.body

      // Validate required fields
      if (!name || !activity_type || !description || !price || !duration || !max_participants || !includes) {
        return res.status(400).json({ success: false, message: "All fields are required" })
      }

      // Validate activity_type
      if (!["Island Hopping", "Snorkeling"].includes(activity_type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid activity type. Only 'Island Hopping' and 'Snorkeling' are allowed.",
        })
      }

      // Get image filename if uploaded
      const image = req.file ? req.file.filename : null

      const [result] = await db.query(
        `INSERT INTO packages (name, activity_type, description, price, duration, max_participants, includes, image, created_by, gcash_number, gcash_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          activity_type,
          description,
          Number.parseFloat(price),
          Number.parseInt(duration),
          Number.parseInt(max_participants),
          includes,
          image,
          req.session.user.user_id,
          gcash_number || "",
          gcash_name || "",
        ],
      )

      res.json({
        success: true,
        message: "Package created successfully",
        packageId: result.insertId,
      })
    } catch (error) {
      console.error("Create package error:", error)
      res.status(500).json({ success: false, message: "Failed to create package: " + error.message })
    }
  },

  // Update Package (Provider-specific version)
  updatePackage: async (req, res) => {
    try {
      // Check if user is activity provider
      if (!req.session.user || req.session.user.user_type !== "activity_provider") {
        return res.status(403).json({ success: false, message: "Unauthorized: Activity provider access required" })
      }

      const { packageId } = req.params

      // Check if package exists and belongs to this provider
      const [packageCheck] = await db.query("SELECT * FROM packages WHERE id = ? AND created_by = ?", [
        packageId,
        req.session.user.user_id,
      ])

      if (packageCheck.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Package not found or you do not have permission to edit it" })
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

      // Validate activity_type if provided
      if (updateData.activity_type && !["Island Hopping", "Snorkeling"].includes(updateData.activity_type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid activity type. Only 'Island Hopping' and 'Snorkeling' are allowed.",
        })
      }

      // Handle image update
      if (req.file) {
        updateData.image = req.file.filename

        // Delete old image if it exists
        if (packageData.image) {
          const oldImagePath = path.join(__dirname, "../uploads/packages", packageData.image)
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath)
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
        return res.status(400).json({ success: false, message: "No fields to update" })
      }

      query += queryParts.join(", ")
      query += " WHERE id = ? AND created_by = ?"
      queryParams.push(packageId, req.session.user.user_id)

      const [result] = await db.query(query, queryParams)

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "Package not found or no changes made" })
      }

      res.json({ success: true, message: "Package updated successfully" })
    } catch (error) {
      console.error("Update package error:", error)
      res.status(500).json({ success: false, message: "Failed to update package: " + error.message })
    }
  },

  // Delete Package (Provider-specific version)
  deletePackage: async (req, res) => {
    try {
      // Check if user is activity provider
      if (!req.session.user || req.session.user.user_type !== "activity_provider") {
        return res.status(403).json({ success: false, message: "Unauthorized: Activity provider access required" })
      }

      const { packageId } = req.params

      // Check if package exists and belongs to this provider
      const [packageCheck] = await db.query("SELECT * FROM packages WHERE id = ? AND created_by = ?", [
        packageId,
        req.session.user.user_id,
      ])

      if (packageCheck.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Package not found or you do not have permission to delete it" })
      }

      const packageData = packageCheck[0]

      // Check if there are any active bookings for this package
      const [bookingCheck] = await db.query(
        "SELECT COUNT(*) as count FROM bookings WHERE package_id = ? AND status IN ('pending', 'confirmed')",
        [packageId],
      )

      if (bookingCheck[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete package with active bookings. Please complete or cancel all bookings first.",
        })
      }

      // Delete package
      const [result] = await db.query("DELETE FROM packages WHERE id = ? AND created_by = ?", [
        packageId,
        req.session.user.user_id,
      ])

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "Package not found" })
      }

      // Delete image if it exists
      if (packageData.image) {
        const imagePath = path.join(__dirname, "../uploads/packages", packageData.image)
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath)
        }
      }

      res.json({ success: true, message: "Package deleted successfully" })
    } catch (error) {
      console.error("Delete package error:", error)
      res.status(500).json({ success: false, message: "Failed to delete package: " + error.message })
    }
  },

  // Get Package by ID (for editing)
  getPackageById: async (req, res) => {
    try {
      // Check if user is activity provider
      if (!req.session.user || req.session.user.user_type !== "activity_provider") {
        return res.status(403).json({ success: false, message: "Unauthorized: Activity provider access required" })
      }

      const { packageId } = req.params

      const [packages] = await db.query("SELECT * FROM packages WHERE id = ? AND created_by = ?", [
        packageId,
        req.session.user.user_id,
      ])

      if (packages.length === 0) {
        return res.status(404).json({ success: false, message: "Package not found" })
      }

      res.json({ success: true, package: packages[0] })
    } catch (error) {
      console.error("Get package error:", error)
      res.status(500).json({ success: false, message: "Failed to get package: " + error.message })
    }
  },

}

module.exports = ProviderController
