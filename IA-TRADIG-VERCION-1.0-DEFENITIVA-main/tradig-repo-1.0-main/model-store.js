// model-store.js
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_URL_LOCAL || 'postgres://trading:trading@localhost:5432/trading'
});

export async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS model_store (
      id SERIAL PRIMARY KEY,
      key TEXT UNIQUE,
      data BYTEA,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

export async function saveModelBlob(key, buffer) {
  await pool.query(
    `INSERT INTO model_store (key,data,updated_at) VALUES ($1,$2,NOW())
     ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [key, buffer]
  );
}

export async function loadModelBlob(key) {
  const res = await pool.query(`SELECT data FROM model_store WHERE key=$1 LIMIT 1`, [key]);
  if (res.rows.length === 0) return null;
  return res.rows[0].data; // Buffer
}

export async function close() {
  await pool.end();
}
