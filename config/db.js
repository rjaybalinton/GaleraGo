const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'puerto galera',
    charset: 'utf8mb4',
    // Add connection pooling for production
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
});

// Test the connection
(async () => {
    try {
        const conn = await db.getConnection();
        console.log("✅ Database Connected Successfully");
        conn.release();
    } catch (err) {
        console.error("❌ Database Connection Error:", err);
    }
})();

module.exports = db;
