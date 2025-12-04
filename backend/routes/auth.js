// backend/routes/auth.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { supabase } = require('../utils/supabaseClient');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', 'database', 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const HAS_SUPABASE = !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
const SUPABASE_USERS_TABLE = 'app_users';
const SUPABASE_TIMEOUT_MS = parseInt(process.env.SUPABASE_TIMEOUT_MS || '2000', 10);
const SELECT_USER = 'id, username, email, password_hash, first_name, last_name, role, contact_number, location';

function readUsers() {
  if (!fs.existsSync(DB_PATH)) return [];
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
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

// NOTE: This is a demo login -- passwords are stored in plain-text in the sample DB.
// For production, always store hashed passwords and use secure comparisons.
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }

  const normalized = normalize(username);

  // Prefer Supabase if configured
  if (HAS_SUPABASE && supabase) {
    try {
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
      if (!data || data.password_hash !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const roleName = data.role || 'staff';
      const token = jwt.sign(
        { id: data.id, username: data.username, role: roleName },
        JWT_SECRET,
        { expiresIn: '8h' }
      );
      const safeUser = {
        id: data.id,
        username: data.username,
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        role: roleName,
        contact_number: data.contact_number,
        location: data.location,
      };
      return res.json({ token, user: safeUser });
    } catch (err) {
      console.error('Supabase login error:', err.message || err);
      // fall through to local fallback
    }
  }

  // Local JSON fallback
  const users = readUsers();
  const user = users.find(
    (u) => normalize(u.username) === normalized && u.password === password
  );
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
    expiresIn: '8h',
  });
  const { password: _p, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

module.exports = router;
