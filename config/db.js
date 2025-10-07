const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'puerto galera',
    charset: 'utf8mb4'
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