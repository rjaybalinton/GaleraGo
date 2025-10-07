const db = require("../config/db")

class ProviderModel {
  static async getAllProviders() {
    try {
      const [rows] = await db.query(`
        SELECT user_id as id, username, email, first_name, last_name, contact_number, 
               user_type as provider_type, gender, created_at
        FROM users
        WHERE user_type IN ('entry_provider', 'activity_provider')
        ORDER BY created_at DESC
      `)
      return rows
    } catch (error) {
      console.error("Error in getAllProviders:", error)
      return []
    }
  }

  static async findByUsernameOrEmail(username, email) {
    try {
      const [rows] = await db.query(
        `
        SELECT user_id as id FROM users
        WHERE username = ? OR email = ?
      `,
        [username, email],
      )
      return rows.length > 0 ? rows[0] : null
    } catch (error) {
      console.error("Error in findByUsernameOrEmail:", error)
      return null
    }
  }

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
          contact_number, user_type, gender
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          providerData.username,
          providerData.email,
          providerData.password,
          providerData.first_name,
          providerData.last_name,
          providerData.contact_number || "",
          providerData.provider_type,
          providerData.gender || "Other",
        ],
      )

      return result.insertId
    } catch (error) {
      console.error("Error in createProvider:", error)
      throw error
    }
  }

  static async getProviderById(providerId) {
    try {
      const [rows] = await db.query(
        `
        SELECT user_id as id, username, email, first_name, last_name, contact_number,
               user_type as provider_type, gender, created_at
        FROM users
        WHERE user_id = ? AND user_type IN ('entry_provider', 'activity_provider')
      `,
        [providerId],
      )

      return rows.length > 0 ? rows[0] : null
    } catch (error) {
      console.error("Error in getProviderById:", error)
      return null
    }
  }

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
        return { affectedRows: 0 } // Nothing to update
      }

      query += fields.join(", ")
      query += ' WHERE user_id = ? AND user_type IN ("entry_provider", "activity_provider")'
      values.push(providerId)

      const [result] = await db.query(query, values)
      return result
    } catch (error) {
      console.error("Error in updateProvider:", error)
      throw error
    }
  }

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

  static async getProviderCount() {
    try {
      const [rows] = await db.query(`
        SELECT COUNT(*) as count
        FROM users
        WHERE user_type IN ('entry_provider', 'activity_provider')
      `)

      return rows[0].count
    } catch (error) {
      console.error("Error in getProviderCount:", error)
      return 0
    }
  }

  // Get providers by type
  static async getProvidersByType() {
    try {
      const [rows] = await db.query(`
        SELECT user_type as provider_type, COUNT(*) as count
        FROM users
        WHERE user_type IN ('entry_provider', 'activity_provider')
        GROUP BY user_type
        ORDER BY count DESC
      `)

      return rows
    } catch (error) {
      console.error("Error in getProvidersByType:", error)
      return []
    }
  }
}

module.exports = ProviderModel
