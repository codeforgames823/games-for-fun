const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;

// ---- RATE LIMITING ----
const rateLimits = new Map();
const RATE_WINDOW = 60000;
const RATE_MAX_WRITES = 20;
const RATE_MAX_READS = 60;

function rateLimit(maxRequests) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    let entry = rateLimits.get(key);
    if (!entry || now - entry.start > RATE_WINDOW) {
      entry = { start: now, count: 0 };
      rateLimits.set(key, entry);
    }
    entry.count++;
    if (entry.count > maxRequests) {
      return res.status(429).json({ error: 'Too many requests, slow down' });
    }
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits) {
    if (now - entry.start > RATE_WINDOW * 2) rateLimits.delete(key);
  }
}, RATE_WINDOW * 2);

// ---- INPUT VALIDATION ----
const VALID_VEHICLES = ['jeep', 'sports', 'monster', 'moonbuggy'];
const VALID_STAGES = ['countryside', 'desert', 'arctic', 'moon'];
const USERNAME_RE = /^[a-zA-Z0-9_-]{1,20}$/;

function sanitizeUsername(name) {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim().slice(0, 20);
  return USERNAME_RE.test(trimmed) ? trimmed : null;
}

function clampInt(val, min, max) {
  const n = parseInt(val);
  if (isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('azure')
    ? { rejectUnauthorized: false }
    : false,
});

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS hcr_players (
        id SERIAL PRIMARY KEY,
        username VARCHAR(30) UNIQUE NOT NULL,
        coins INT DEFAULT 0,
        save_data JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS hcr_leaderboard (
        id SERIAL PRIMARY KEY,
        username VARCHAR(30) NOT NULL,
        vehicle VARCHAR(20) NOT NULL,
        stage VARCHAR(20) NOT NULL,
        distance INT NOT NULL,
        coins_earned INT DEFAULT 0,
        max_speed INT DEFAULT 0,
        flips INT DEFAULT 0,
        best_air_time REAL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_lb_distance ON hcr_leaderboard(distance DESC);
      CREATE INDEX IF NOT EXISTS idx_lb_stage ON hcr_leaderboard(stage, distance DESC);
    `);
    console.log('Database tables ready');
  } catch (err) {
    console.warn('Database not available, running in local-only mode:', err.message);
  }
}

// ---- LEADERBOARD ----

app.get('/api/leaderboard', rateLimit(RATE_MAX_READS), async (req, res) => {
  try {
    const { stage } = req.query;
    const limit = clampInt(req.query.limit || 20, 1, 50);
    let query, params;
    if (stage && VALID_STAGES.includes(stage)) {
      query = `SELECT username, vehicle, stage, distance, coins_earned, max_speed, flips, best_air_time, created_at
               FROM hcr_leaderboard WHERE stage = $1
               ORDER BY distance DESC LIMIT $2`;
      params = [stage, limit];
    } else {
      query = `SELECT username, vehicle, stage, distance, coins_earned, max_speed, flips, best_air_time, created_at
               FROM hcr_leaderboard
               ORDER BY distance DESC LIMIT $1`;
      params = [limit];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/leaderboard', rateLimit(RATE_MAX_WRITES), async (req, res) => {
  try {
    const { vehicle, stage, distance, coins_earned, max_speed, flips, best_air_time } = req.body;
    const username = sanitizeUsername(req.body.username);
    if (!username) return res.status(400).json({ error: 'Invalid username (alphanumeric, 1-20 chars)' });
    if (!VALID_VEHICLES.includes(vehicle)) return res.status(400).json({ error: 'Invalid vehicle' });
    if (!VALID_STAGES.includes(stage)) return res.status(400).json({ error: 'Invalid stage' });
    if (distance == null) return res.status(400).json({ error: 'Missing distance' });

    const dist = clampInt(distance, 0, 999999);
    const coins = clampInt(coins_earned, 0, 999999);
    const speed = clampInt(max_speed, 0, 9999);
    const flipCount = clampInt(flips, 0, 9999);
    const air = Math.max(0, Math.min(parseFloat(best_air_time) || 0, 999));

    const result = await pool.query(
      `INSERT INTO hcr_leaderboard (username, vehicle, stage, distance, coins_earned, max_speed, flips, best_air_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [username, vehicle, stage, dist, coins, speed, flipCount, air]
    );
    const rank = await pool.query(
      `SELECT COUNT(*) + 1 as rank FROM hcr_leaderboard WHERE distance > $1`,
      [dist]
    );
    res.json({ id: result.rows[0].id, rank: parseInt(rank.rows[0].rank) });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ---- CLOUD SAVES ----

app.post('/api/save', rateLimit(RATE_MAX_WRITES), async (req, res) => {
  try {
    const { save_data } = req.body;
    const username = sanitizeUsername(req.body.username);
    if (!username) return res.status(400).json({ error: 'Invalid username' });
    if (!save_data || typeof save_data !== 'object') {
      return res.status(400).json({ error: 'Invalid save data' });
    }
    const saveStr = JSON.stringify(save_data);
    if (saveStr.length > 50000) return res.status(400).json({ error: 'Save data too large' });

    await pool.query(
      `INSERT INTO hcr_players (username, coins, save_data, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (username)
       DO UPDATE SET coins = $2, save_data = $3, updated_at = NOW()`,
      [username, clampInt(save_data.coins, 0, 99999999), saveStr]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/save/:username', rateLimit(RATE_MAX_READS), async (req, res) => {
  try {
    const username = sanitizeUsername(req.params.username);
    if (!username) return res.status(400).json({ error: 'Invalid username' });
    const result = await pool.query(
      `SELECT save_data FROM hcr_players WHERE username = $1`,
      [username]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json(result.rows[0].save_data);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ---- PLAYER STATS ----

app.get('/api/stats/:username', rateLimit(RATE_MAX_READS), async (req, res) => {
  try {
    const username = sanitizeUsername(req.params.username);
    if (!username) return res.status(400).json({ error: 'Invalid username' });
    const lb = await pool.query(
      `SELECT COUNT(*) as runs,
              MAX(distance) as best_distance,
              MAX(max_speed) as top_speed,
              SUM(coins_earned) as total_coins,
              SUM(flips) as total_flips,
              MAX(best_air_time) as best_air
       FROM hcr_leaderboard WHERE username = $1`,
      [username]
    );
    res.json(lb.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(PORT, () => {
  console.log(`Flip Master 3-D server running on port ${PORT}`);
  initDB();
});
