// model/AdminModel.js
const db = require("../config/db")


class AdminModel {
  // Get tourist counts with improved error handling
  static async getTouristCounts() {
    try {
      // Get tourist count from tourists table
      const [touristResults] = await db.query(`
        SELECT COUNT(*) as count
        FROM tourists
      `)

      // Get user count from users table
      const [userResults] = await db.query(`
        SELECT COUNT(*) as count
        FROM users
      `)

      // Get provider count from users table with provider types
      const [providerResults] = await db.query(`
        SELECT COUNT(*) as count
        FROM users
        WHERE user_type IN ('entry_provider', 'activity_provider')
      `)

      // Get package count
      const [packageResults] = await db.query(`
        SELECT COUNT(*) as count
        FROM packages
      `)

      return {
        tourists: touristResults[0].count,
        users: userResults[0].count,
        providers: providerResults[0].count,
        packages: packageResults[0].count,
      }
    } catch (error) {
      console.error("Error in getTouristCounts:", error)
      // Return default values on error
      return {
        tourists: 0,
        users: 0,
        providers: 0,
        packages: 0,
      }
    }
  }

  // Get recent tourists with improved error handling
  static async getRecentTourists(limit = 10) {
    try {
      const [results] = await db.query(
        `
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
        LIMIT ?
      `,
        [limit],
      )

      return results
    } catch (error) {
      console.error("Error in getRecentTourists:", error)
      return []
    }
  }

  // Get all tourists with improved error handling
  static async getAllTourists() {
    try {
      const [results] = await db.query(`
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

      return results
    } catch (error) {
      console.error("Error in getAllTourists:", error)
      return []
    }
  }

  // Get tourist by ID with improved error handling
  static async getTouristById(touristId) {
    try {
      const [results] = await db.query(
        `
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
        WHERE tourist_id = ?
      `,
        [touristId],
      )

      return results.length > 0 ? results[0] : null
    } catch (error) {
      console.error("Error in getTouristById:", error)
      return null
    }
  }

  // Get all providers with improved error handling
  static async getAllProviders() {
    try {
      const [results] = await db.query(`
        SELECT 
          user_id as id, 
          username, 
          email, 
          first_name, 
          last_name, 
          contact_number,
          user_type as provider_type, 
          gender, 
          created_at
        FROM users
        WHERE user_type IN ('entry_provider', 'activity_provider')
        ORDER BY created_at DESC
      `)

      return results
    } catch (error) {
      console.error("Error in getAllProviders:", error)
      return []
    }
  }

  // Get provider by ID with improved error handling
  static async getProviderById(providerId) {
    try {
      const [results] = await db.query(
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
          created_at
        FROM users
        WHERE user_id = ? AND user_type IN ('entry_provider', 'activity_provider')
      `,
        [providerId],
      )

      return results.length > 0 ? results[0] : null
    } catch (error) {
      console.error("Error in getProviderById:", error)
      return null
    }
  }

  // Create provider with improved error handling
  static async createProvider(providerData) {
    try {
      // Validate required fields
      const requiredFields = ["username", "email", "password", "first_name", "last_name", "provider_type"]
      const missingFields = requiredFields.filter((field) => !providerData[field])

      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(", ")}`)
      }

      const [result] = await db.query(
        `
        INSERT INTO users (
          username, email, password, first_name, last_name,
          contact_number, user_type, gender, nationality, address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          providerData.username,
          providerData.email,
          providerData.password, // Should be hashed before passing to this method
          providerData.first_name,
          providerData.last_name,
          providerData.contact_number || "",
          providerData.provider_type, // Maps to user_type in database
          providerData.gender || "Other",
          providerData.nationality || "N/A",
          providerData.address || "N/A",
        ],
      )

      return { insertId: result.insertId }
    } catch (error) {
      console.error("Error in createProvider:", error)
      throw error
    }
  }

  // Update provider with improved error handling
  static async updateProvider(providerId, updateData) {
    try {
      // Build dynamic query based on provided fields
      let query = "UPDATE users SET "
      const values = []
      const fields = []

      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          // Map provider_type to user_type for database compatibility
          const fieldName = key === "provider_type" ? "user_type" : key
          fields.push(`${fieldName} = ?`)
          values.push(value)
        }
      }

      if (fields.length === 0) {
        return { affectedRows: 0 }
      }

      query += fields.join(", ")
      query += " WHERE user_id = ? AND user_type IN ('entry_provider', 'activity_provider')"
      values.push(providerId)

      const [result] = await db.query(query, values)
      return result
    } catch (error) {
      console.error("Error in updateProvider:", error)
      throw error
    }
  }

  // Delete provider with improved error handling
  static async deleteProvider(providerId) {
    try {
      const [result] = await db.query(
        `
        DELETE FROM users
        WHERE user_id = ? AND user_type IN ('entry_provider', 'activity_provider')
      `,
        [providerId],
      )

      return result
    } catch (error) {
      console.error("Error in deleteProvider:", error)
      throw error
    }
  }

  // Get tourist statistics by type with improved error handling
  static async getTouristStatsByType() {
    try {
      const [results] = await db.query(`
        SELECT 
          COALESCE(registration_type, 'Regular Tourist') as type,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM tourists), 1) as percentage
        FROM tourists
        GROUP BY registration_type
        ORDER BY count DESC
      `)

      return results
    } catch (error) {
      console.error("Error in getTouristStatsByType:", error)
      return []
    }
  }

  // Get tourist statistics by nationality with improved error handling
  static async getTouristStatsByNationality(limit = 10) {
    try {
      const [results] = await db.query(
        `
        SELECT 
          COALESCE(nationality, 'Not Specified') as nationality,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM tourists), 1) as percentage
        FROM tourists
        GROUP BY nationality
        ORDER BY count DESC
        LIMIT ?
      `,
        [limit],
      )

      return results
    } catch (error) {
      console.error("Error in getTouristStatsByNationality:", error)
      return []
    }
  }

  // Get tourist statistics by month with improved error handling
  static async getTouristStatsByMonth(limit = 12) {
    try {
      const [results] = await db.query(
        `
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') as month_year,
          DATE_FORMAT(created_at, '%b %Y') as month,
          COUNT(*) as count
        FROM tourists
        GROUP BY month_year
        ORDER BY month_year ASC
        LIMIT ?
      `,
        [limit],
      )

      return results
    } catch (error) {
      console.error("Error in getTouristStatsByMonth:", error)
      return []
    }
  }

  // Get all packages with improved error handling
  static async getAllPackages() {
    try {
      const [results] = await db.query(`
        SELECT p.*, u.username as created_by_name
        FROM packages p
        LEFT JOIN users u ON p.created_by = u.user_id
        ORDER BY p.created_at DESC
      `)

      return results
    } catch (error) {
      console.error("Error in getAllPackages:", error)
      return []
    }
  }

  // Get package by ID with improved error handling
  static async getPackageById(packageId) {
    try {
      const [results] = await db.query(
        `
        SELECT p.*, u.username as created_by_name
        FROM packages p
        LEFT JOIN users u ON p.created_by = u.user_id
        WHERE p.id = ?
      `,
        [packageId],
      )

      return results.length > 0 ? results[0] : null
    } catch (error) {
      console.error("Error in getPackageById:", error)
      return null
    }
  }

  // Create package with improved error handling
  static async createPackage(packageData) {
    try {
      // Validate required fields
      const requiredFields = ["name", "price", "created_by"]
      const missingFields = requiredFields.filter((field) => !packageData[field])

      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(", ")}`)
      }

      const [result] = await db.query(
        `
        INSERT INTO packages (
          name, description, price, duration, max_participants,
          includes, image, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          packageData.name,
          packageData.description || "",
          packageData.price,
          packageData.duration || 1,
          packageData.max_participants || 10,
          packageData.includes || "",
          packageData.image || "placeholder.svg",
          packageData.created_by,
        ],
      )

      return { insertId: result.insertId }
    } catch (error) {
      console.error("Error in createPackage:", error)
      throw error
    }
  }

  // Update package with improved error handling
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
        return { affectedRows: 0 }
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

  // Delete package with improved error handling
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

  // Get package count with improved error handling
  static async getPackageCount() {
    try {
      const [results] = await db.query(`
        SELECT COUNT(*) as count
        FROM packages
      `)

      return results[0].count
    } catch (error) {
      console.error("Error in getPackageCount:", error)
      return 0
    }
  }

  // Get dashboard statistics with improved error handling
  static async getDashboardStats() {
    try {
      // Get counts
      const counts = await this.getTouristCounts()

      // Get recent tourists
      const recentTourists = await this.getRecentTourists(5)

      // Get tourist stats
      const touristsByType = await this.getTouristStatsByType()
      const touristsByNationality = await this.getTouristStatsByNationality(5)
      const touristsByMonth = await this.getTouristStatsByMonth(12)

      return {
        counts,
        recentTourists,
        stats: {
          byType: touristsByType,
          byNationality: touristsByNationality,
          byMonth: touristsByMonth,
        },
      }
    } catch (error) {
      console.error("Error in getDashboardStats:", error)
      return {
        counts: { tourists: 0, users: 0, providers: 0, packages: 0 },
        recentTourists: [],
        stats: {
          byType: [],
          byNationality: [],
          byMonth: [],
        },
      }
    }
  }
  // Method to create an admin account
  static async createAdminAccount(adminData) {
    try {
      const [result] = await db.query(`
        INSERT INTO users (
          username, email, password, first_name, last_name, contact_number, 
          date_of_birth, gender, nationality, address, user_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        adminData.username,
        adminData.email,
        adminData.password, // Hashed password
        adminData.first_name,
        adminData.last_name,
        adminData.contact_number,
        adminData.date_of_birth,
        adminData.gender,
        adminData.nationality,
        adminData.address,
        'admin'  // user_type is set to 'admin'
      ]);

      return { insertId: result.insertId };
    } catch (error) {
      console.error("Error in createAdminAccount:", error);
      throw error;  // Ensure error is thrown so the controller can handle it
    }
  }
}


module.exports = AdminModel
