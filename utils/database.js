require('dotenv').config();
const { Pool } = require('pg');

let ownsPool = true;
let pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('connect', () => {
  console.info('Database client connected');
});

pool.on('error', (err) => {
  console.error(`Database error: ${err.message}`);
});

const database = {
  query: (...args) => pool.query(...args),
  connect: (...args) => pool.connect(...args),
  usePool: (externalPool) => {
    if (!externalPool || typeof externalPool.query !== 'function') throw new TypeError('database must provide a query method.');
    pool = externalPool;
    ownsPool = false;
  },
  close: async () => {
    if (ownsPool && typeof pool.end === 'function') await pool.end();
  },
};

module.exports = database;
