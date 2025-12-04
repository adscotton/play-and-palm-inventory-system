// backend/routes/users.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { supabase, hasSupabaseKey } = require('../utils/supabaseClient');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', 'database', 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const SUPABASE_USERS_TABLE = 'app_users';
const SUPABASE_TIMEOUT_MS = parseInt(process.env.SUPABASE_TIMEOUT_MS || '2000', 10);
const SELECT_USER = 'id, username, email, first_name, last_name, role, contact_number, location, created_at';
const AUDIT_TABLE = 'audit_logs';

function ensureUsersFile() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Failed to ensure users file', err);
  }
}

function readUsersLocal() {
  ensureUsersFile();
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw || '[]');
}

function writeUsersLocal(users) {
  ensureUsersFile();
  fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2), 'utf-8');
}

async function logAudit(userId, targetId, action, details = {}) {
  if (!hasSupabaseKey || !supabase) return;
  try {
    await supabase.from(AUDIT_TABLE).insert([{
      user_id: userId || null,
      entity_type: 'user',
      entity_id: targetId || null,
      action,
      details
    }]);
  } catch (err) {
    console.error('Audit log failed:', err.message || err);
  }
}

function mapSupabaseUser(row) {
  if (!row) return row;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    first_name: row.first_name,
    last_name: row.last_name,
    role: row.role || null,
    contact_number: row.contact_number,
    location: row.location,
    created_at: row.created_at,
  };
}

function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Authorization header missing' });
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid authorization format' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireManagerOrAdmin(req, res, next) {
  const role = (req.user && req.user.role) || '';
  if (role === 'admin' || role === 'manager') return next();
  return res.status(403).json({ error: 'Forbidden: requires manager or admin role' });
}

function withTimeout(promise, ms, label = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// GET current user (uses local JWT payload or Supabase if configured)
router.get('/me', verifyToken, async (req, res) => {
  try {
    if (hasSupabaseKey && supabase) {
      const { id, username } = req.user || {};
      let query = supabase.from(SUPABASE_USERS_TABLE).select(SELECT_USER);
      if (id) query = query.eq('id', id).limit(1).maybeSingle();
      else if (username) query = query.ilike('username', username).limit(1).maybeSingle();
      const { data, error } = await withTimeout(query, SUPABASE_TIMEOUT_MS, 'Supabase user me');
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'User not found' });
      return res.json(mapSupabaseUser(data));
    }
    const users = readUsersLocal();
    const user = users.find((u) => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    console.error('GET /api/users/me error', err.message || err);
    res.status(500).json({ error: err.message || 'Failed to fetch user' });
  }
});

// POST /api/users - create user (aligns with local users.json schema)
// Expected body: { username, password, firstName, lastName, email, role, contactNumber, location }
router.post('/', verifyToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const p = req.body || {};
    const localUser = {
      username: p.username || p.usersnames || null,
      password: p.password || null,
      firstName: p.firstName || p.first_name || null,
      lastName: p.lastName || p.last_name || null,
      email: p.email || null,
      role: p.role || 'staff',
      contactNumber: p.contactNumber || p.contact_number || null,
      location: p.location || null
    };

    const supabasePayload = {
      username: localUser.username,
      password_hash: localUser.password,
      email: localUser.email,
      first_name: localUser.firstName,
      last_name: localUser.lastName,
      role: localUser.role,
      contact_number: localUser.contactNumber,
      location: localUser.location,
      created_at: new Date().toISOString()
    };

    if (hasSupabaseKey && supabase) {
      const { data, error } = await supabase.from(SUPABASE_USERS_TABLE)
        .insert([supabasePayload])
        .select(SELECT_USER)
        .single();
      if (error) {
        throw error;
      }
      const returned = mapSupabaseUser(data);
      await logAudit(req.user?.id, data.id, 'CREATE', { username: data.username, role: returned.role });
      return res.status(201).json(returned);
    }

    // Local fallback: persist to users.json with incremental id
    const users = readUsersLocal();
    const maxId = users.reduce((m, u) => Math.max(m, Number(u.id || 0)), 0);
    const newUser = {
      id: maxId + 1,
      username: localUser.username,
      password: localUser.password,
      firstName: localUser.firstName,
      lastName: localUser.lastName,
      email: localUser.email,
      role: localUser.role,
      contactNumber: localUser.contactNumber,
      location: localUser.location
    };
    users.push(newUser);
    writeUsersLocal(users);
    await logAudit(req.user?.id, newUser.id, 'CREATE', { username: newUser.username, role: newUser.role });
    return res.status(201).json(newUser);
  } catch (err) {
    console.error('POST /api/users error', err.message || err);
    res.status(500).json({ error: err.message || 'Failed to create user' });
  }
});

// GET /api/users - list users (admin)
router.get('/', verifyToken, requireManagerOrAdmin, async (req, res) => {
  try {
    if (hasSupabaseKey && supabase) {
      let data = null;
      let error = null;
      try {
        ({ data, error } = await withTimeout(
          supabase.from(SUPABASE_USERS_TABLE).select(SELECT_USER).order('id', { ascending: true }),
          SUPABASE_TIMEOUT_MS,
          'Supabase list users'
        ));
      } catch (err) {
        console.warn(err.message);
      }
      if (error) throw error;
      return res.json((data || []).map(mapSupabaseUser));
    }
    const users = readUsersLocal();
    return res.json(users.map(u => ({ id: u.id, username: u.username, email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role, contactNumber: u.contactNumber, location: u.location })));
  } catch (err) {
    console.error('GET /api/users error', err.message || err);
    res.status(500).json({ error: err.message || 'Failed to list users' });
  }
});

// PUT update user (keeps existing verifyToken permission checks)
router.put('/:id', verifyToken, async (req, res) => {
  const id = Number(req.params.id);
  try {
    // permission check
    if (req.user.id !== id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const p = req.body || {};
    const updates = {
      ...(p.username && { username: p.username }),
      ...(p.email && { email: p.email }),
      ...(p.first_name && { first_name: p.first_name }),
      ...(p.last_name && { last_name: p.last_name }),
      ...(p.firstName && { first_name: p.firstName }),
      ...(p.lastName && { last_name: p.lastName }),
      ...(p.role && { role: p.role }),
      ...(p.contact_number && { contact_number: p.contact_number }),
      ...(p.contactNumber && { contact_number: p.contactNumber }),
      ...(p.location && { location: p.location })
    };

    if (hasSupabaseKey && supabase) {
      const supabaseUpdates = { ...updates };
      if (supabaseUpdates.role) {
        supabaseUpdates.role = supabaseUpdates.role;
      }

      const { data, error } = await supabase.from(SUPABASE_USERS_TABLE)
        .update(supabaseUpdates)
        .eq('id', id)
        .select(SELECT_USER)
        .single();
      if (error) throw error;
      await logAudit(req.user?.id, id, 'UPDATE', { updates });
      return res.json(mapSupabaseUser(data));
    }

    const users = readUsersLocal();
    const idx = users.findIndex(u => Number(u.id) === id);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    users[idx] = { ...users[idx], ...{
      username: updates.username || users[idx].username,
      email: updates.email || users[idx].email,
      firstName: updates.first_name || users[idx].firstName,
      lastName: updates.last_name || users[idx].lastName,
      role: updates.role || users[idx].role,
      contactNumber: updates.contact_number || users[idx].contactNumber,
      location: updates.location || users[idx].location
    }};
    writeUsersLocal(users);
    const { password, ...safeUser } = users[idx];
    await logAudit(req.user?.id, id, 'UPDATE', { updates });
    res.json(safeUser);
  } catch (err) {
    console.error('PUT /api/users/:id error', err.message || err);
    res.status(500).json({ error: err.message || 'Failed to update user' });
  }
});

module.exports = router;
