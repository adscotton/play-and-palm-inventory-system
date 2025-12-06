// backend/routes/auth.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { supabase, hasSupabaseKey } = require('../utils/supabaseClient');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', 'database', 'users.json');
const DB_DIR = path.dirname(DB_PATH);
const DEFAULT_USERS = [
  {
    id: 1,
    username: 'admin',
    password: 'admin123',
    firstName: 'Alex',
    lastName: 'Admin',
    email: 'admin@playpalm.local',
    role: 'admin',
    contactNumber: '555-0101',
    location: 'HQ',
  },
  {
    id: 2,
    username: 'staff',
    password: 'staff123',
    firstName: 'Sasha',
    lastName: 'Staff',
    email: 'staff@playpalm.local',
    role: 'staff',
    contactNumber: '555-0102',
    location: 'Outlet',
  },
];
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const HAS_SUPABASE = hasSupabaseKey && !!supabase;
const SUPABASE_USERS_TABLE = 'app_users';
const SUPABASE_TIMEOUT_MS = parseInt(process.env.SUPABASE_TIMEOUT_MS || '7000', 10);
const SELECT_USER = 'id, username, email, password_hash, first_name, last_name, role, contact_number, location';
const FORCE_LOCAL_AUTH = String(process.env.FORCE_LOCAL_AUTH || '').toLowerCase() === 'true';

function ensureUsersFile() {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_USERS, null, 2), 'utf-8');
      return;
    }
    // Seed defaults if file exists but is empty or not an array
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed) || parsed.length === 0) {
      fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_USERS, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Failed to ensure users file, resetting to defaults', err);
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_USERS, null, 2), 'utf-8');
    } catch (_) {
      // swallow secondary errors to avoid crashing auth
    }
  }
}

function readUsers() {
  ensureUsersFile();
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw || '[]');
    if (Array.isArray(parsed) && parsed.length) return parsed;
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_USERS, null, 2), 'utf-8');
    return DEFAULT_USERS;
  } catch (err) {
    console.error('Failed to read users file, restoring defaults', err);
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_USERS, null, 2), 'utf-8');
    return DEFAULT_USERS;
  }
}

function normalize(val) {
  return (val || '').trim().toLowerCase();
}

function withTimeout(promise, ms, label = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function localAuthenticate(normalizedUsername, password) {
  const users = readUsers();
  const user = users.find(
    (u) => normalize(u.username) === normalizedUsername && u.password === password
  );
  if (!user) return null;
  const roleName = user.role || 'staff';
  const token = jwt.sign(
    { id: user.id, username: user.username, role: roleName },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  const { password: _p, ...safeUser } = user;
  return { token, user: { ...safeUser, role: roleName } };
}

// NOTE: This is a demo login -- passwords are stored in plain-text in the sample DB.
// For production, always store hashed passwords and use secure comparisons.
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }

  const normalized = normalize(username);

  // Prefer Supabase if configured
  if (!FORCE_LOCAL_AUTH && HAS_SUPABASE && supabase) {
    const attemptLogin = async () => {
      const { data, error } = await withTimeout(
        supabase
          .from(SUPABASE_USERS_TABLE)
          .select(SELECT_USER)
          .ilike('username', normalized)
          .maybeSingle(),
        SUPABASE_TIMEOUT_MS,
        'Supabase login'
      );
      if (error) throw error;
      return data;
    };

    try {
      let userRow = null;
      let lastErr = null;
      for (let i = 0; i < 2 && !userRow; i += 1) {
        try {
          userRow = await attemptLogin();
        } catch (err) {
          lastErr = err;
          if (i === 0) {
            await wait(250);
          }
        }
      }
      if (lastErr && !userRow) throw lastErr;

      if (!userRow || userRow.password_hash !== password) {
        // If Supabase has no match, fall back to local demo users
        if (!userRow) {
          const localResult = localAuthenticate(normalized, password);
          if (localResult) return res.json(localResult);
        }
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const roleName = userRow.role || 'staff';
      const token = jwt.sign(
        { id: userRow.id, username: userRow.username, role: roleName },
        JWT_SECRET,
        { expiresIn: '8h' }
      );
      const safeUser = {
        id: userRow.id,
        username: userRow.username,
        email: userRow.email,
        first_name: userRow.first_name,
        last_name: userRow.last_name,
        role: roleName,
        contact_number: userRow.contact_number,
        location: userRow.location,
      };
      return res.json({ token, user: safeUser });
    } catch (err) {
      console.error('Supabase login error, falling back to local:', err.message || err);
      const localResult = localAuthenticate(normalized, password);
      if (localResult) return res.json(localResult);
      return res.status(503).json({ error: 'Login service temporarily unavailable. Please retry.' });
    }
  }

  // Local JSON fallback
  const localResult = localAuthenticate(normalized, password);
  if (!localResult) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json(localResult);
});

module.exports = router;
