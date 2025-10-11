const db = require("../config/db")

const ReportModel = {
  async getMonthlyGender() {
    try {
      const [rows] = await db.query(
        `
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') AS month_year,
          DATE_FORMAT(created_at, '%b %Y') AS month,
          gender,
          COUNT(*) AS count
        FROM tourists
        GROUP BY month_year, gender
        ORDER BY month_year ASC
        `,
      )
      return rows || []
    } catch (error) {
      console.error('Error fetching monthly gender data:', error)
      return []
    }
  },

  async getMonthlyAgeBuckets() {
    try {
      const [rows] = await db.query(
        `
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') AS month_year,
          DATE_FORMAT(created_at, '%b %Y') AS month,
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
          COUNT(*) AS count
        FROM tourists
        GROUP BY month_year, age_bucket
        ORDER BY month_year ASC
        `,
      )
      return rows || []
    } catch (error) {
      console.error('Error fetching monthly age data:', error)
      return []
    }
  },
}

module.exports = ReportModel
