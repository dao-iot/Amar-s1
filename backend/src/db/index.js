const { Pool } = require('pg');
require('dotenv').config();

// ================================================
// DATABASE CONNECTION POOL - OPTIMIZED FOR HIGH SCALE
// ================================================
// With 250 vehicles sending telemetry every 500ms:
// - Expected load: ~500 telemetry inserts/second
// - Each telemetry triggers: 1 INSERT + 1 UPDATE + alert evaluation
// - Pool size tuned for concurrent connections without overwhelming PostgreSQL

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,

  // Connection pool sizing for high throughput
  // Formula: (core_count * 2) + effective_spindle_count = ~20 for typical dev machines
  // With high concurrency from 250 vehicles, we need more connections
  max: 50,                    // Maximum connections in pool (default: 10)
  min: 10,                     // Minimum connections to maintain (default: 0)
  idleTimeoutMillis: 30000,   // Close idle connections after 30s (default: 10000)
  connectionTimeoutMillis: 10000, // Timeout for new connections (default: 0)

  // Performance tuning
  statement_timeout: 10000,   // Max query execution time (10s)
  query_timeout: 10000,       // Max query duration (10s)
});

// Connection event logging
pool.on('connect', (client) => {
  console.log(`[DB] New client connected. Total: ${pool.totalCount}, Idle: ${pool.idleCount}, Waiting: ${pool.waitingCount}`);
});

pool.on('acquire', () => {
  // Silent - too noisy at high scale
});

pool.on('remove', () => {
  // Silent - too noisy at high scale
});

pool.on('error', (err, client) => {
  console.error('[DB] Unexpected error on idle client', err);
  // Don't exit - let the pool recover
});

// Log pool statistics periodically (every 60 seconds)
setInterval(() => {
  console.log(`[DB Pool] Total: ${pool.totalCount}, Idle: ${pool.idleCount}, Waiting: ${pool.waitingCount}`);
}, 60000);

module.exports = {
  /**
   * Execute a SQL query with parameters
   * @param {string} text - SQL query string
   * @param {Array} params - Query parameters
   * @returns {Promise} - Query result
   */
  query: (text, params) => pool.query(text, params),
  /**
   * Get a client from the pool for transactions
   */
  getClient: () => pool.connect(),
  /**
   * Get current pool statistics
   */
  getPoolStats: () => ({
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  })
};
