const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
app.use(cors());
app.use(express.json());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required to run the API server.');
}

const sslOption = (() => {
  const mode = (process.env.PGSSLMODE || '').toLowerCase();
  if (mode === 'require') {
    return { rejectUnauthorized: false };
  }
  if (mode === 'disable' || mode === 'allow' || mode === '') {
    return false;
  }
  return undefined;
})();

const getErrorMessage = (error) => {
  if (!error) return 'Unknown error occurred.';
  if (typeof error === 'string') return error;
  if (error.detail) return error.detail;
  if (error.message) return error.message;
  return JSON.stringify(error);
};

const pool = new Pool({
  connectionString,
  ssl: sslOption,
});

const initializeDatabase = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wallet_submissions (
      id SERIAL PRIMARY KEY,
      address TEXT NOT NULL UNIQUE,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const sanitizeAddress = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return null;
  }
  return trimmed.toLowerCase();
};

app.get('/api/wallet-submissions', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT address, submitted_at AS "submittedAt" FROM wallet_submissions ORDER BY submitted_at DESC`
    );
    res.json({ submissions: rows });
  } catch (error) {
    console.error('Failed to fetch wallet submissions:', error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

app.post('/api/wallet-submissions', async (req, res) => {
  const { address } = req.body || {};
  const normalized = sanitizeAddress(address);

  if (!normalized) {
    return res.status(400).json({ error: 'A valid wallet address is required' });
  }

  try {
    await pool.query(
      `INSERT INTO wallet_submissions (address)
       VALUES ($1)
       ON CONFLICT (address) DO UPDATE SET submitted_at = NOW()`,
      [normalized]
    );

    const { rows } = await pool.query(
      `SELECT submitted_at AS "submittedAt" FROM wallet_submissions WHERE address = $1`,
      [normalized]
    );

    res.json({ ok: true, address: normalized, submittedAt: rows[0]?.submittedAt || null });
  } catch (error) {
    console.error('Failed to persist wallet submissions:', error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

const startServer = async () => {
  try {
    await initializeDatabase();
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log('API server running on port ' + PORT);
    });
  } catch (error) {
    console.error('Failed to initialize API server:', error);
    process.exit(1);
  }
};

startServer();

const shutdown = async () => {
  try {
    await pool.end();
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
