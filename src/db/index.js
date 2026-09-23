const fs = require('fs');
const path = require('path');
const config = require('../config');

// Ensure database directory exists
const dbDir = path.dirname(config.DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let dbInstance;

try {
  const { DatabaseSync } = require('node:sqlite');
  dbInstance = new DatabaseSync(config.DB_PATH);
  // Enable foreign keys and WAL mode for better concurrency
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  dbInstance.exec('PRAGMA journal_mode = WAL;');
} catch (err) {
  console.error('Failed to initialize SQLite database:', err);
  throw err;
}

const db = {
  get(sql, ...params) {
    const stmt = dbInstance.prepare(sql);
    return stmt.get(...params);
  },

  all(sql, ...params) {
    const stmt = dbInstance.prepare(sql);
    return stmt.all(...params);
  },

  run(sql, ...params) {
    const stmt = dbInstance.prepare(sql);
    return stmt.run(...params);
  },

  exec(sql) {
    return dbInstance.exec(sql);
  },

  prepare(sql) {
    return dbInstance.prepare(sql);
  },

  raw: dbInstance,
};

module.exports = db;
