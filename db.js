const mysql = require('mysql2/promise');
require('dotenv').config();

// Determine connection parameters
let poolConfig;

if (process.env.MYSQL_URL || process.env.DATABASE_URL || process.env.CLEARDB_DATABASE_URL) {
  poolConfig = {
    uri: process.env.MYSQL_URL || process.env.DATABASE_URL || process.env.CLEARDB_DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  };
} else {
  poolConfig = {
    host: process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
    user: process.env.MYSQL_USER || process.env.DB_USER || 'root',
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'mydiary',
    port: parseInt(process.env.MYSQL_PORT || process.env.DB_PORT || '3306'),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  };
}

const pool = mysql.createPool(poolConfig);

// Initialize MySQL Schema
async function initSchema() {
  try {
    const connection = await pool.getConnection();

    // Users Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Entries Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        date VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        mood VARCHAR(100) NOT NULL,
        tags VARCHAR(255),
        body LONGTEXT NOT NULL,
        photo LONGTEXT,
        audio LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Letters Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS letters (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        date VARCHAR(50) NOT NULL,
        body LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Goals Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS goals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        text VARCHAR(255) NOT NULL,
        done TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Gratitude Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS gratitude (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        date VARCHAR(50) NOT NULL,
        item1 TEXT,
        item2 TEXT,
        item3 TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    connection.release();
    console.log('Connected to MySQL database & schema initialized successfully.');
  } catch (err) {
    console.warn('MySQL initialization notice (verify database configuration):', err.message);
  }
}

initSchema();

// Async DB wrapper helpers matching previous helper API contract
async function dbRun(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return { lastID: result.insertId, changes: result.affectedRows };
}

async function dbGet(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows[0] || null;
}

async function dbAll(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

module.exports = { pool, dbRun, dbGet, dbAll };
