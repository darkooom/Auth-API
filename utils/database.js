require('dotenv').config();
const $console = require('Console');
const { Pool } = require('pg');

const db = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

db.on('connect', () => {
  $console.success('Database client connected');
});

db.on('error', (err) => {
  $console.error(`Database error: ${err.message}`);
});

module.exports = db;
