// In UserModel.js
const db = require('../config/db');
const bcrypt = require('bcrypt');

const UserModel = {
    findByEmail: async (email) => {
        try {
            const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('Error in findByEmail:', error);
            throw error;
        }
    },
  
      createUser: (userData) => {
        return new Promise(async (resolve, reject) => {
          try {
            const sql = `
              INSERT INTO users 
              (username, first_name, last_name, contact_number, email, password, date_of_birth, gender, nationality, address, profile_picture, user_type) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const params = [
              userData.username,
              userData.first_name,
              userData.last_name,
              userData.contact_number,
              userData.email,
              userData.password,
              userData.date_of_birth,
              userData.gender,
              userData.nationality,
              userData.address,
              userData.profile_picture || 'default.jpg',
              userData.user_type || 'tourist'
            ];
            
            const [result] = await db.query(sql, params);
            resolve(result);
          } catch (err) {
            reject(err);
          }
        });
      },
  
    getUserById: (id) => {
      return new Promise(async (resolve, reject) => {
        try {
          const [rows] = await db.query('SELECT * FROM users WHERE user_id = ?', [id]);
          resolve(rows[0]);
        } catch (err) {
          reject(err);
        }
      });
    },// Added methods to support AdminDashboard functionality

    // Get all users
    getAllUsers: async () => {
      try {
        const [rows] = await db.query(`
                  SELECT user_id, username, email, first_name, last_name, 
                         contact_number, user_type, gender, nationality, 
                         created_at
                  FROM users
                  ORDER BY created_at DESC
              `)
        return rows
      } catch (error) {
        console.error("Error in getAllUsers:", error)
        throw error
      }
    },
  
    // Update user
    updateUser: async (userId, userData) => {
      try {
        // Build dynamic query
        let query = "UPDATE users SET "
        const params = []
        const fields = []
  
        for (const [key, value] of Object.entries(userData)) {
          if (value !== undefined && key !== "user_id") {
            fields.push(`${key} = ?`)
            params.push(value)
          }
        }
  
        if (fields.length === 0) {
          return { affectedRows: 0 }
        }
  
        query += fields.join(", ")
        query += " WHERE user_id = ?"
        params.push(userId)
  
        const [result] = await db.query(query, params)
        return result
      } catch (error) {
        console.error("Error in updateUser:", error)
        throw error
      }
    },
  
    // Delete user
    deleteUser: async (userId) => {
      try {
        const [result] = await db.query("DELETE FROM users WHERE user_id = ?", [userId])
        return result
      } catch (error) {
        console.error("Error in deleteUser:", error)
        throw error
      }
    },
  
    // Count users by type
    countUsersByType: async () => {
      try {
        const [rows] = await db.query(`
                  SELECT user_type, COUNT(*) as count
                  FROM users
                  GROUP BY user_type
              `)
        return rows
      } catch (error) {
        console.error("Error in countUsersByType:", error)
        throw error
      }
    },
  
};
  
module.exports = UserModel;