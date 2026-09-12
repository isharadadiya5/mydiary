const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'mydiary.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at mydiary.db');
  }
});

// Enable foreign keys and set up schema
db.serialize(() => {
  db.run(`PRAGMA foreign_keys = ON;`);

  // Users Table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Entries Table
  db.run(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      mood TEXT NOT NULL,
      tags TEXT,
      body TEXT NOT NULL,
      photo TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Future Letters Table
  db.run(`
    CREATE TABLE IF NOT EXISTS letters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Goals Table
  db.run(`
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
});

// Async DB wrapper helpers for clean promise-based usage
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = { db, dbRun, dbGet, dbAll };
