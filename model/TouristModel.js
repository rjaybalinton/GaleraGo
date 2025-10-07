// UPDATED: model/TouristModel.js
const db = require('../config/db');

class TouristModel {
  static async registerTourist(touristData) {
    try {
      // Validate required fields
      const requiredFields = ['user_id', 'email', 'phone', 'first_name', 'last_name', 'registration_type'];
      const missingFields = requiredFields.filter(field => !touristData[field]);

      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      const [result] = await db.query('INSERT INTO tourists SET ?', touristData);
      return { insertId: result.insertId };
    } catch (error) {
      console.error('Error in registerTourist:', error);
      throw error;
    }
  }

  static async getTouristHistory(userId) {
    try {
      const [rows] = await db.query(`
        SELECT tourist_id, first_name, last_name, phone, 
               registration_type, qrcode, created_at, email,
               age, gender, nationality, residence
        FROM tourists 
        WHERE user_id = ? 
        ORDER BY created_at DESC
      `, [userId]);
      return rows;
    } catch (error) {
      console.error('Error in getTouristHistory:', error);
      throw error;
    }
  }

  static async getAllTourists() {
    try {
      const [rows] = await db.query(`
        SELECT tourist_id as id, first_name, last_name, email, 
               phone as contact_number, nationality, gender, 
               registration_type, created_at, qrcode
        FROM tourists 
        ORDER BY created_at DESC
      `);
      return rows;
    } catch (error) {
      console.error('Error in getAllTourists:', error);
      return [];
    }
  }

  static async getTouristById(touristId) {
    try {
      const [rows] = await db.query(`
        SELECT * FROM tourists WHERE tourist_id = ?
      `, [touristId]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error in getTouristById:', error);
      return null;
    }
  }

  static async updateTourist(touristId, updateData) {
    try {
      // Build dynamic query
      let query = "UPDATE tourists SET ";
      const values = [];
      const fields = [];

      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      }

      if (fields.length === 0) {
        return { affectedRows: 0 };
      }

      query += fields.join(", ");
      query += " WHERE tourist_id = ?";
      values.push(touristId);

      const [result] = await db.query(query, values);
      return result;
    } catch (error) {
      console.error('Error in updateTourist:', error);
      throw error;
    }
  }

  static async deleteTourist(touristId) {
    try {
      const [result] = await db.query('DELETE FROM tourists WHERE tourist_id = ?', [touristId]);
      return result;
    } catch (error) {
      console.error('Error in deleteTourist:', error);
      throw error;
    }
  }

  static async getTouristCount() {
    try {
      const [rows] = await db.query('SELECT COUNT(*) as count FROM tourists');
      return rows[0].count;
    } catch (error) {
      console.error('Error in getTouristCount:', error);
      return 0;
    }
  }
}

module.exports = TouristModel;