const { Pool } = require("pg");

let pool = null;

function initPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable not set");
  }

  if (pool) {
    return pool;
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on("error", (err) => {
    console.error("Unexpected error on idle client", err);
  });

  console.log("[Database] PostgreSQL connection pool initialized");
  return pool;
}

/**
 * Get the database pool instance
 * @returns {Pool} PostgreSQL pool instance
 */
function getPool() {
  if (!pool) {
    return initPool();
  }
  return pool;
}

/**
 * Execute a query with parameters
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params = []) {
  const pool = getPool();

  try {
    console.log("[Database] Executing query:", text.substring(0, 100) + "...");
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error("[Database] Query error:", error);
    throw error;
  }
}

/**
 * Execute a query and return the first row
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object|null>} First row or null
 */
async function queryOne(text, params = []) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

/**
 * Execute a query and return all rows
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} All rows
 */
async function queryMany(text, params = []) {
  const result = await query(text, params);
  return result.rows;
}

/**
 * Execute a query and return a scalar value (first column of first row)
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<*>} Scalar value
 */
async function queryScalar(text, params = []) {
  const result = await query(text, params);
  if (result.rows.length === 0) {
    return null;
  }
  const firstRow = result.rows[0];
  const firstKey = Object.keys(firstRow)[0];
  return firstRow[firstKey];
}

/**
 * Execute a transaction with a callback function
 * @param {Function} callback - Function that receives the client and performs queries
 * @returns {Promise<*>} Result from the callback
 */
async function transaction(callback) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Test database connectivity
 * @returns {Promise<boolean>} True if connection is successful
 */
async function testConnection() {
  try {
    const result = await query("SELECT NOW() as current_time");
    console.log(
      "[Database] Connection test successful:",
      result.rows[0].current_time,
    );
    return true;
  } catch (error) {
    console.error("[Database] Connection test failed:", error.message);
    return false;
  }
}

/**
 * Close the database pool
 */
async function close() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log("[Database] Connection pool closed");
  }
}

module.exports = {
  initPool,
  getPool,
  query,
  queryOne,
  queryMany,
  queryScalar,
  transaction,
  testConnection,
  close,
};
