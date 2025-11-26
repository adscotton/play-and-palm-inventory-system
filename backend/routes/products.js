// backend/routes/products.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { supabase } = require('../utils/supabaseClient');

const DB_PRODUCTS = path.join(__dirname, '..', 'database', 'products.json');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const AUDIT_TABLE = 'audit_logs';

function ensureProductsFile() {
  try {
    if (!fs.existsSync(path.dirname(DB_PRODUCTS))) {
      fs.mkdirSync(path.dirname(DB_PRODUCTS), { recursive: true });
    }
    if (!fs.existsSync(DB_PRODUCTS)) {
      fs.writeFileSync(DB_PRODUCTS, JSON.stringify([], null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Failed to ensure products file:', err);
  }
}

function readProductsLocal() {
  ensureProductsFile();
  try {
    const raw = fs.readFileSync(DB_PRODUCTS, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('Local products.json parse error, resetting:', err);
    fs.writeFileSync(DB_PRODUCTS, JSON.stringify([], null, 2), 'utf-8');
    return [];
  }
}

function writeProductsLocal(products) {
  ensureProductsFile();
  fs.writeFileSync(DB_PRODUCTS, JSON.stringify(products, null, 2), 'utf-8');
}

function isSupabaseAvailable() {
  return supabase !== null;
}

function computeStatus(stock) {
  const qty = Number(stock) || 0;
  if (qty <= 0) return 'No Stock';
  if (qty <= 5) return 'Low in Stock';
  return 'Available';
}

function normalizeName(name) {
  return (name || '').trim().toLowerCase();
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return null;
}

function shapeProductResponse(row) {
  if (!row) return row;
  return {
    ...row,
    price: row.price !== null && row.price !== undefined ? Number(row.price) : row.price,
    stock: row.stock !== null && row.stock !== undefined ? Number(row.stock) : row.stock,
  };
}

async function logAudit(userId, entityId, action, details = {}) {
  if (!supabase) return;
  try {
    await supabase.from(AUDIT_TABLE).insert([{
      user_id: userId || null,
      entity_type: 'product',
      entity_id: entityId || null,
      action,
      details
    }]);
  } catch (err) {
    console.error('Audit log failed:', err.message || err);
  }
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

// GET /api/products
router.get('/', async (req, res) => {
  if (isSupabaseAvailable()) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, sku, name, brand, manufacturer, category, price, stock, status, description, release_date, tags, image')
        .order('id', { ascending: true });

      if (error) throw error;
      return res.json((data || []).map(shapeProductResponse));
    } catch (err) {
      console.error('Supabase GET /products failed:', err.message || err);
    }
  }

  try {
    res.json(readProductsLocal());
  } catch (err) {
    console.error('Local fallback failed:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  const id = req.params.id;

  if (isSupabaseAvailable()) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, sku, name, brand, manufacturer, category, price, stock, status, description, release_date, tags, image')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Product not found' });
      return res.json(shapeProductResponse(data));
    } catch (err) {
      console.error('Supabase GET /products/:id failed:', err.message || err);
    }
  }

  try {
    const items = readProductsLocal();
    const found = items.find((p) => String(p.id) === String(id));
    if (!found) return res.status(404).json({ error: 'Product not found' });
    res.json(found);
  } catch (err) {
    console.error('Local fallback failed:', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// POST /api/products (admin/manager only)
router.post('/', verifyToken, requireManagerOrAdmin, async (req, res) => {
  const {
    name,
    brand,
    category = 'Console',
    price,
    stock,
    description,
    sku,
    manufacturer,
    releaseDate,
    tags,
    image,
  } = req.body;

  if (!name || !brand || price == null || stock == null) {
    return res.status(400).json({
      error: 'Missing required fields: name, brand, price, and stock are required',
    });
  }

  const normalizedName = normalizeName(name);
  const computedStatus = computeStatus(stock);

  const payload = {
    name,
    brand,
    category,
    price: parseFloat(price),
    stock: parseInt(stock, 10),
    status: computedStatus,
    description: description || null,
    sku: sku || null,
    manufacturer: manufacturer || null,
    release_date: releaseDate || null,
    tags: normalizeTags(tags),
    image: image || null,
  };

  if (isSupabaseAvailable()) {
    try {
      // Duplicate check by name (case-insensitive)
      const { data: existing, error: dupErr } = await supabase
        .from('products')
        .select('id, name')
        .ilike('name', normalizedName)
        .maybeSingle();
      if (dupErr) console.error('Supabase duplicate check error:', dupErr);
      if (existing?.id) {
        return res.status(409).json({ error: 'Product name already exists' });
      }

      const { data, error } = await supabase
        .from('products')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        return res.status(400).json({ error: error.message || 'Failed to create product' });
      }

      await logAudit(req.user?.id, data.id, 'CREATE', { name: data.name, sku: data.sku, stock: data.stock });
      return res.status(201).json(shapeProductResponse(data));
    } catch (err) {
      console.error('Supabase POST failed:', err.message || err);
    }
  }

  // Local fallback
  try {
    const items = readProductsLocal();
    const duplicate = items.find((p) => normalizeName(p.name) === normalizedName);
    if (duplicate) {
      return res.status(409).json({ error: 'Product name already exists' });
    }
    const maxId = items.reduce((max, item) => Math.max(max, item.id || 0), 0);
    const newItem = { ...payload, id: maxId + 1 };
    items.push(newItem);
    writeProductsLocal(items);
    res.status(201).json(newItem);
  } catch (err) {
    console.error('Local POST failed:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id
router.put('/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  const {
    name,
    brand,
    category,
    price,
    stock,
    description,
    sku,
    manufacturer,
    releaseDate,
    tags,
    image,
  } = req.body;

  const role = (req.user && req.user.role) || '';
  const isStaff = role === 'staff';

  const updates = {};
  if (!isStaff) {
    if (name !== undefined) updates.name = name;
    if (brand !== undefined) updates.brand = brand;
    if (category !== undefined) updates.category = category;
    if (price !== undefined) updates.price = parseFloat(price);
    if (description !== undefined) updates.description = description || null;
    if (sku !== undefined) updates.sku = sku || null;
    if (manufacturer !== undefined) updates.manufacturer = manufacturer || null;
    if (releaseDate !== undefined) updates.release_date = releaseDate || null;
    if (tags !== undefined) updates.tags = normalizeTags(tags);
    if (image !== undefined) updates.image = image || null;
  }
  if (stock !== undefined) {
    updates.stock = parseInt(stock, 10);
    updates.status = computeStatus(stock);
  }

  if (isStaff) {
    // Only stock/status allowed already; proceed
  } else if (role !== 'admin' && role !== 'manager') {
    return res.status(403).json({ error: 'Forbidden: requires manager or admin role' });
  }

  if (isSupabaseAvailable()) {
    try {
      // Duplicate name check (if name changing)
      if (updates.name) {
        const normalizedName = normalizeName(updates.name);
        const { data: dup } = await supabase
          .from('products')
          .select('id, name')
          .ilike('name', normalizedName)
          .neq('id', id)
          .maybeSingle();
        if (dup?.id) {
          return res.status(409).json({ error: 'Product name already exists' });
        }
      }

      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Supabase update error:', error);
        return res.status(400).json({ error: error.message || 'Update failed' });
      }
      if (!data) return res.status(404).json({ error: 'Product not found' });
      await logAudit(req.user?.id, data.id, 'UPDATE', { updates });
      return res.json(shapeProductResponse(data));
    } catch (err) {
      console.error('Supabase PUT failed:', err);
    }
  }

  // Local fallback
  try {
    const items = readProductsLocal();
    const idx = items.findIndex((p) => String(p.id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'Product not found' });

    if (updates.name) {
      const normalizedName = normalizeName(updates.name);
      const dup = items.find((p, i) => i !== idx && normalizeName(p.name) === normalizedName);
      if (dup) {
        return res.status(409).json({ error: 'Product name already exists' });
      }
    }

    const updated = { ...items[idx], ...updates };
    if (updates.stock !== undefined) {
      updated.status = computeStatus(updated.stock);
    }
    items[idx] = updated;
    writeProductsLocal(items);
    res.json(updated);
  } catch (err) {
    console.error('Local PUT failed:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id (admin/manager only)
router.delete('/:id', verifyToken, requireManagerOrAdmin, async (req, res) => {
  const id = req.params.id;

  if (isSupabaseAvailable()) {
    try {
      const { data, error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Supabase delete error:', error);
        return res.status(400).json({ error: error.message || 'Delete failed' });
      }
      await logAudit(req.user?.id, id, 'DELETE', { name: data?.name, sku: data?.sku });
      return res.json({ message: 'Deleted', product: data });
    } catch (err) {
      console.error('Supabase DELETE failed:', err);
    }
  }

  try {
    const items = readProductsLocal();
    const idx = items.findIndex((p) => String(p.id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'Product not found' });
    const deleted = items.splice(idx, 1)[0];
    writeProductsLocal(items);
    res.json({ message: 'Deleted', product: deleted });
  } catch (err) {
    console.error('Local DELETE failed:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
