const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');
require('dotenv').config();

const configuredPath = process.env.DB_PATH || './data/zero-trust.sqlite';
const databasePath = path.resolve(process.cwd(), configuredPath);
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('mahasiswa','dosen','admin')),
  nim TEXT UNIQUE
);
CREATE TABLE IF NOT EXISTS devices (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL, PRIMARY KEY(user_id, device_id)
);
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL,
  lecturer_id TEXT NOT NULL REFERENCES users(id), finalized INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS grades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id TEXT NOT NULL REFERENCES classes(id), student_id TEXT NOT NULL REFERENCES users(id),
  score REAL NOT NULL CHECK(score >= 0 AND score <= 100), UNIQUE(class_id, student_id)
);
CREATE TABLE IF NOT EXISTS transcripts (
  student_id TEXT PRIMARY KEY REFERENCES users(id), data TEXT NOT NULL DEFAULT '[]', updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL, revoked_at INTEGER
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, occurred_at TEXT NOT NULL, subject TEXT,
  endpoint TEXT NOT NULL, device_id TEXT, decision TEXT NOT NULL CHECK(decision IN ('allow','deny')),
  reason TEXT NOT NULL, method TEXT NOT NULL
);
`);
module.exports = db;
