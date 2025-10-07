const db = require("../config/db")

class PackageModel {
  static async getAllPackages() {
    try {
      const [rows] = await db.query(`
        SELECT p.*, u.username as created_by_name
        FROM packages p
        LEFT JOIN users u ON p.created_by = u.user_id
        ORDER BY p.created_at DESC
      `)
      return rows
    } catch (error) {
      console.error("Error in getAllPackages:", error)
      return []
    }
  }

  static async createPackage(packageData) {
    try {
      // Validate required fields
      const requiredFields = ["name", "price", "duration", "max_participants", "created_by"]
      const missingFields = requiredFields.filter((field) => !packageData[field])

      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(", ")}`)
      }

      const [result] = await db.query(
        `
        INSERT INTO packages (
          name, price, duration, max_participants,
          description, includes, image, created_by, gcash_number, gcash_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          packageData.name,
          packageData.price,
          packageData.duration,
          packageData.max_participants,
          packageData.description || "",
          packageData.includes || "",
          packageData.image || "placeholder.svg",
          packageData.created_by,
          packageData.gcash_number || "",
          packageData.gcash_name || "",
        ],
      )

      return { insertId: result.insertId }
    } catch (error) {
      console.error("Error in createPackage:", error)
      throw error
    }
  }

  static async getPackageById(packageId) {
    try {
      const [rows] = await db.query(
        `
        SELECT p.*, u.username as created_by_name
        FROM packages p
        LEFT JOIN users u ON p.created_by = u.user_id
        WHERE p.id = ?
      `,
        [packageId],
      )

      return rows.length > 0 ? rows[0] : null
    } catch (error) {
      console.error("Error in getPackageById:", error)
      return null
    }
  }

  static async updatePackage(packageId, updateData) {
    try {
      // Build dynamic query based on provided fields
      let query = "UPDATE packages SET "
      const values = []
      const fields = []

      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          fields.push(`${key} = ?`)
          values.push(value)
        }
      }

      if (fields.length === 0) {
        return { affectedRows: 0 } // Nothing to update
      }

      query += fields.join(", ")
      query += " WHERE id = ?"
      values.push(packageId)

      const [result] = await db.query(query, values)
      return result
    } catch (error) {
      console.error("Error in updatePackage:", error)
      throw error
    }
  }

  static async deletePackage(packageId) {
    try {
      const [result] = await db.query(
        `
        DELETE FROM packages
        WHERE id = ?
      `,
        [packageId],
      )

      return result
    } catch (error) {
      console.error("Error in deletePackage:", error)
      throw error
    }
  }

  static async getPackageCount() {
    try {
      const [rows] = await db.query(`
        SELECT COUNT(*) as count
        FROM packages
      `)

      return rows[0].count
    } catch (error) {
      console.error("Error in getPackageCount:", error)
      return 0
    }
  }

  // Get packages by popularity (booking count)
  static async getPackagesByPopularity(limit = 5) {
    try {
      // Check if bookings table exists
      const [tables] = await db.query(`
        SHOW TABLES LIKE 'bookings'
      `)

      if (tables.length === 0) {
        // If bookings table doesn't exist, return packages ordered by creation date
        const [rows] = await db.query(
          `
          SELECT id, name, price, COUNT(*) as booking_count
          FROM packages
          GROUP BY id
          ORDER BY created_at DESC
          LIMIT ?
        `,
          [limit],
        )
        return rows
      }

      // If bookings table exists, get packages by booking count
      const [rows] = await db.query(
        `
        SELECT p.id, p.name, p.price, COUNT(b.id) as booking_count
        FROM packages p
        LEFT JOIN bookings b ON p.id = b.package_id
        GROUP BY p.id
        ORDER BY booking_count DESC
        LIMIT ?
      `,
        [limit],
      )

      return rows
    } catch (error) {
      console.error("Error in getPackagesByPopularity:", error)
      return []
    }
  }
}

module.exports = PackageModel
