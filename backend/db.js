
const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "ecoscan.db");
const db = new Database(dbPath);

// Create the users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    image_name TEXT NOT NULL,
    category TEXT NOT NULL,
    confidence TEXT NOT NULL DEFAULT 'Demo',
    image_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

const scanColumns = db.prepare("PRAGMA table_info(scans)").all();
if (!scanColumns.some((column) => column.name === "image_path")) {
  db.exec("ALTER TABLE scans ADD COLUMN image_path TEXT");
}

console.log("EcoScan AI database is ready!");
console.log("Users table created successfully.");

// Eco Points and Rewards table
db.exec(`
  CREATE TABLE IF NOT EXISTS reward_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    scan_id INTEGER NOT NULL UNIQUE,
    points INTEGER NOT NULL CHECK (points > 0),
    reason TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (scan_id) REFERENCES scans(id)
  );
`);

module.exports = db;
