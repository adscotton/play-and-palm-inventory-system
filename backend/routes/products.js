// backend/routes/products.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { supabase, hasSupabaseKey } = require('../utils/supabaseClient');

const DB_PRODUCTS = path.join(__dirname, '..', 'database', 'products.json');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const AUDIT_TABLE = 'audit_logs';
const TABLE_PRODUCTS = 'products';
const TABLE_BRANDS = 'brands';
const TABLE_CATEGORIES = 'categories';
const TABLE_MANUFACTURERS = 'manufacturers';
const PRODUCT_SELECT_JOINED = [
  'id',
  'name',
  'brand_id',
  'category_id',
  'manufacturer_id',
  'storage',
  'edition',
  'price',
  'stock',
  'status',
  'description',
  'release_date',
  'tags',
  'image',
  'brand:brands (id, name)',
  'category:categories (id, name)',
  'manufacturer:manufacturers (id, name)'
].join(', ');

const SUPABASE_ENABLED = String(process.env.SUPABASE_ENABLED || '').toLowerCase() !== 'false';
const FORCE_LOCAL_PRODUCTS = String(process.env.FORCE_LOCAL_PRODUCTS || '').toLowerCase() === 'true';
const HAS_SUPABASE = hasSupabaseKey && !!supabase;
const PRODUCT_CACHE_TTL_MS = parseInt(process.env.PRODUCT_CACHE_TTL_MS || '15000', 10);
const SUPABASE_TIMEOUT_MS = parseInt(process.env.SUPABASE_TIMEOUT_MS || '7000', 10);
const productCache = {
  list: null,
  listTs: 0,
  items: new Map(), // id -> { data, ts }
};

function nowMs() {
  return Date.now();
}

function withTimeout(promise, ms, label = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function runSupabase(promise, label) {
  return withTimeout(promise, SUPABASE_TIMEOUT_MS, label);
}

function getCachedList() {
  if (!PRODUCT_CACHE_TTL_MS) return null;
  if (productCache.list && nowMs() - productCache.listTs < PRODUCT_CACHE_TTL_MS) {
    return productCache.list;
  }
  return null;
}

function cacheList(items) {
  const ts = nowMs();
  productCache.list = items;
  productCache.listTs = ts;
  if (Array.isArray(items)) {
    items.forEach((p) => {
      if (p?.id !== undefined && p?.id !== null) {
        productCache.items.set(String(p.id), { data: p, ts });
      }
    });
  }
}

function getCachedItem(id) {
  if (!PRODUCT_CACHE_TTL_MS) return null;
  const entry = productCache.items.get(String(id));
  if (entry && nowMs() - entry.ts < PRODUCT_CACHE_TTL_MS) return entry.data;
  return null;
}

function cacheItem(item) {
  if (!item || item.id === undefined || item.id === null) return;
  productCache.items.set(String(item.id), { data: item, ts: nowMs() });
}

function invalidateCache(id = null) {
  productCache.list = null;
  productCache.listTs = 0;
  if (id !== null && id !== undefined) {
    productCache.items.delete(String(id));
  } else {
    productCache.items.clear();
  }
}

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
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p) => ({
      ...p,
      price: p.price !== undefined && p.price !== null ? Number(p.price) : 0,
      stock: p.stock !== undefined && p.stock !== null ? Number(p.stock) : 0,
    }));
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
  return SUPABASE_ENABLED && !FORCE_LOCAL_PRODUCTS && HAS_SUPABASE;
}

async function resolveLookupId(table, value) {
  if (!isSupabaseAvailable()) return null;
  const cleaned = (value || '').trim();
  if (!cleaned) return null;
  try {
    const { data: existing, error: fetchErr } = await runSupabase(
      supabase
        .from(table)
        .select('id')
        .ilike('name', cleaned)
        .maybeSingle(),
      `lookup ${table}`
    );
    if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
    if (existing?.id) return existing.id;

    const { data, error } = await runSupabase(
      supabase
        .from(table)
        .insert([{ name: cleaned }])
        .select('id')
        .single(),
      `insert ${table}`
    );

    if (error) {
      // Handle race on unique name by re-selecting
      if (error.code === '23505' || (error.message || '').toLowerCase().includes('duplicate')) {
        const { data: dup } = await runSupabase(
          supabase
            .from(table)
            .select('id')
            .ilike('name', cleaned)
            .maybeSingle(),
          `lookup-dup ${table}`
        );
        return dup?.id || null;
      }
      throw error;
    }
    return data?.id || null;
  } catch (err) {
    console.error(`Failed to resolve lookup id for ${table}:`, err.message || err);
    return null;
  }
}

async function resolveProductLookups({ brand, category, manufacturer }) {
  const [brandId, categoryId, manufacturerId] = await Promise.all([
    resolveLookupId(TABLE_BRANDS, brand),
    resolveLookupId(TABLE_CATEGORIES, category),
    resolveLookupId(TABLE_MANUFACTURERS, manufacturer)
  ]);
  return { brandId, categoryId, manufacturerId };
}

async function fetchProductsFromSupabase({ term = null, id = null, limit = null, orderById = true }) {
  if (!isSupabaseAvailable()) return null;

  const applyFilters = (query) => {
    if (term) query = query.ilike('name', `%${term}%`);
    if (id) query = query.eq('id', id);
    if (limit) query = query.limit(limit);
    if (orderById) query = query.order('id', { ascending: true });
    return query;
  };

  const { data, error } = await runSupabase(
    applyFilters(
      supabase
        .from(TABLE_PRODUCTS)
        .select(PRODUCT_SELECT_JOINED)
    ),
    'Supabase products (joined)'
  );
  if (error) throw error;
  return data || [];
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

function mapProductRow(row) {
  if (!row) return row;
  const tags = normalizeTags(row.tags) || [];
  const brandName = row.brand?.name ?? row.brand ?? null;
  const categoryName = row.category?.name ?? row.category ?? null;
  const manufacturerName = row.manufacturer?.name ?? row.manufacturer ?? null;

  return shapeProductResponse({
    ...row,
    brand: brandName,
    category: categoryName,
    manufacturer: manufacturerName,
    brand_id: row.brand_id ?? row.brand?.id ?? null,
    category_id: row.category_id ?? row.category?.id ?? null,
    manufacturer_id: row.manufacturer_id ?? row.manufacturer?.id ?? null,
    tags
  });
}

async function fetchProductById(id) {
  if (!isSupabaseAvailable()) return null;
  const cached = getCachedItem(id);
  if (cached) return cached;

  try {
    const data = await fetchProductsFromSupabase({ id });
    const mapped = mapProductRow((data || [])[0]);
    if (mapped) cacheItem(mapped);
    return mapped;
  } catch (err) {
    console.error('fetchProductById failed:', err.message || err);
    return null;
  }
}

async function logAudit(userId, entityId, action, details = {}, username = null) {
  if (!isSupabaseAvailable()) return;
  try {
    const payloadDetails = username ? { ...details, username } : details;
    await supabase.from(AUDIT_TABLE).insert([{
      user_id: userId || null,
      entity_type: 'product',
      entity_id: entityId || null,
      action,
      details: payloadDetails
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

// GET /api/products/search?name=foo (auth required)
router.get('/search', verifyToken, async (req, res) => {
  const term = (req.query.name || '').trim();
  if (!term) return res.json([]);

  // Serve from cache if available and supabase is used
  const cachedList = getCachedList();
  if (cachedList) {
    const needle = term.toLowerCase();
    const results = cachedList
      .filter((p) => (p.name || '').toLowerCase().includes(needle))
      .slice(0, 20);
    return res.json(results);
  }

  if (isSupabaseAvailable()) {
    try {
      const data = await fetchProductsFromSupabase({ term, limit: 20, orderById: false });
      const mapped = (data || []).map(mapProductRow);
      if (mapped.length) return res.json(mapped);
      // fall through to local if no results
    } catch (err) {
      console.error('Supabase search failed:', err.message || err);
    }
  }

  try {
    const items = readProductsLocal();
    const results = items.filter((p) => normalizeName(p.name).includes(normalizeName(term))).slice(0, 20);
    return res.json(results);
  } catch (err) {
    console.error('Local search failed:', err);
    return res.status(500).json({ error: 'Failed to search products' });
  }
});

// GET /api/products
router.get('/', async (req, res) => {
  const cached = getCachedList();
  if (cached) {
    return res.json(cached);
  }

  if (isSupabaseAvailable()) {
    try {
      const data = await fetchProductsFromSupabase({ orderById: true });
      const mapped = (data || []).map(mapProductRow);
      if (mapped.length) {
        cacheList(mapped);
        return res.json(mapped);
      }
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

  const cached = getCachedItem(id);
  if (cached) {
    return res.json(cached);
  }

  if (isSupabaseAvailable()) {
    try {
      const data = await fetchProductsFromSupabase({ id });
      const item = (data || [])[0];
      if (item) {
        const mapped = mapProductRow(item);
        cacheItem(mapped);
        return res.json(mapped);
      }
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
    manufacturer,
    storage,
    edition,
    releaseDate,
    tags,
    image,
  } = req.body;

  if (!name || !brand || price == null) {
    return res.status(400).json({
      error: 'Missing required fields: name, brand, and price are required',
    });
  }

  const normalizedName = normalizeName(name);
  const normalizedEdition = normalizeName(edition || '');
  const parsedStock =
    stock === undefined || stock === null || stock === ''
      ? 0
      : parseInt(stock, 10);
  if (!Number.isFinite(parsedStock) || parsedStock < 0) {
    return res.status(400).json({ error: 'Stock must be 0 or greater' });
  }
  const computedStatus = computeStatus(parsedStock);

  const payload = {
    name,
    brand,
    category,
    price: parseFloat(price),
    stock: parsedStock,
    status: computedStatus,
    description: description || null,
    manufacturer: manufacturer || null,
    storage: storage || null,
    edition: edition || null,
    release_date: releaseDate || null,
    tags: normalizeTags(tags),
    image: image || null,
  };

  if (isSupabaseAvailable()) {
    try {
      const { brandId, categoryId, manufacturerId } = await resolveProductLookups({
        brand,
        category,
      manufacturer
    });

      if (!brandId) {
        return res.status(400).json({ error: 'Brand could not be resolved' });
      }

      // Duplicate check by composite variant (name + edition)
      const { data: dupRows, error: dupErr } = await runSupabase(
        supabase
          .from(TABLE_PRODUCTS)
          .select('id, name, edition')
          .ilike('name', normalizedName),
        'Supabase duplicate check'
      );
      if (dupErr) console.error('Supabase duplicate check error:', dupErr);
      const hasDup = (dupRows || []).some((row) => normalizeName(row.edition || '') === normalizedEdition);
      if (hasDup) {
        return res.status(409).json({ error: 'Product variant (name + edition) already exists' });
      }

      const supabasePayload = {
        name,
        brand_id: brandId,
        category_id: categoryId,
        manufacturer_id: manufacturerId,
        storage: storage || null,
        edition: edition || null,
        price: parseFloat(price),
        stock: parsedStock,
        status: computedStatus,
        description: description || null,
        release_date: releaseDate || null,
        tags: normalizeTags(tags),
        image: image || null,
      };

      const { data, error } = await runSupabase(
        supabase
          .from(TABLE_PRODUCTS)
          .insert([supabasePayload])
          .select('id')
          .single(),
        'Supabase insert product'
      );

      if (error) {
        console.error('Supabase insert error:', error);
        return res.status(400).json({ error: error.message || 'Failed to create product' });
      }

      invalidateCache();
      const created = await fetchProductById(data.id);
      cacheItem(created);
      await logAudit(req.user?.id, data.id, 'CREATE', { name: name, stock: parsedStock }, req.user?.username);
      return res.status(201).json(created || shapeProductResponse({ ...supabasePayload, id: data.id }));
    } catch (err) {
      console.error('Supabase POST failed:', err.message || err);
    }
  }

  // Local fallback
  try {
    const items = readProductsLocal();
    const duplicate = items.find(
      (p) =>
        normalizeName(p.name) === normalizedName &&
        normalizeName(p.edition || '') === normalizedEdition
    );
    if (duplicate) {
      return res.status(409).json({ error: 'Product variant (name + edition) already exists' });
    }
    const maxId = items.reduce((max, item) => Math.max(max, item.id || 0), 0);
    const newItem = {
      ...payload,
      id: maxId + 1,
    };
    items.push(newItem);
    writeProductsLocal(items);
    res.status(201).json(newItem);
  } catch (err) {
    console.error('Local POST failed:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id/stock (staff/manager/admin) - supports absolute stock or additive delta
router.put('/:id/stock', verifyToken, async (req, res) => {
  const id = req.params.id;
  const role = (req.user && req.user.role) || '';
  if (!['admin', 'manager', 'staff'].includes(role)) {
    return res.status(403).json({ error: 'Forbidden: requires staff, manager or admin role' });
  }

  const body = req.body || {};
  const delta = body.delta ?? body.add ?? body.increment ?? null;
  const absolute = body.stock;

  const parseIntOrNull = (val) => {
    const num = parseInt(val, 10);
    return Number.isFinite(num) ? num : null;
  };

  const parsedDelta = parseIntOrNull(delta);
  const parsedAbsolute = parseIntOrNull(absolute);

  if (parsedDelta === null && absolute === undefined) {
    return res.status(400).json({ error: 'Provide a stock delta or absolute stock' });
  }

  const applyUpdate = (currentStock) => {
    if (parsedDelta !== null) {
      if (parsedDelta <= 0) throw new Error('Add quantity must be greater than zero');
      const newStock = currentStock + parsedDelta;
      return { newStock, status: computeStatus(newStock) };
    }
    if (absolute !== undefined) {
      if (absolute === null || absolute === '') throw new Error('Stock must be a non-negative integer');
      if (parsedAbsolute === null || parsedAbsolute < 0) throw new Error('Stock must be a non-negative integer');
      const newStock = parsedAbsolute;
      return { newStock, status: computeStatus(newStock) };
    }
    throw new Error('Invalid stock payload');
  };

  if (isSupabaseAvailable()) {
    try {
      const { data: existing, error: fetchErr } = await runSupabase(
        supabase
          .from(TABLE_PRODUCTS)
          .select('id, stock')
          .eq('id', id)
          .maybeSingle(),
        'Supabase stock fetch'
      );
      if (fetchErr) throw fetchErr;
      if (!existing) throw new Error('not-found');
      const currentStock = Number(existing.stock) || 0;
      let update;
      try {
        update = applyUpdate(currentStock);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }

      const { data, error } = await supabase
        .from(TABLE_PRODUCTS)
        .update({ stock: update.newStock, status: update.status })
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) {
        console.error('Supabase stock update error:', error);
        return res.status(400).json({ error: error.message || 'Update failed' });
      }
      const refreshed = await fetchProductById(data?.id || id);
      invalidateCache(id);
      cacheItem(refreshed);
      await logAudit(req.user?.id, data.id, 'UPDATE_STOCK', { stock: update.newStock, status: update.status }, req.user?.username);
      return res.json(refreshed || shapeProductResponse({ ...data, status: update.status }));
    } catch (err) {
      if (err?.message === 'not-found') {
        return res.status(404).json({ error: 'Product not found' });
      }
      console.error('Supabase stock PUT failed, falling back to local:', err?.message || err);
      // Fall through to local fallback below
    }
  }

  // Local fallback
  try {
    const items = readProductsLocal();
    const idx = items.findIndex((p) => String(p.id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'Product not found' });
    const currentStock = Number(items[idx].stock) || 0;
    let update;
    try {
      update = applyUpdate(currentStock);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    items[idx] = { ...items[idx], stock: update.newStock, status: update.status };
    writeProductsLocal(items);
    await logAudit(req.user?.id, id, 'UPDATE_STOCK', { stock: update.newStock, status: update.status }, req.user?.username);
    return res.json(items[idx]);
  } catch (err) {
    console.error('Local stock PUT failed:', err);
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

// PUT /api/products/:id/stock/reduce (staff/manager/admin) - subtract sold units, never below zero
router.put('/:id/stock/reduce', verifyToken, async (req, res) => {
  const id = req.params.id;
  const role = (req.user && req.user.role) || '';
  if (!['admin', 'manager', 'staff'].includes(role)) {
    return res.status(403).json({ error: 'Forbidden: requires staff, manager or admin role' });
  }

  const delta = parseInt((req.body || {}).delta, 10);
  if (!Number.isFinite(delta) || delta <= 0) {
    return res.status(400).json({ error: 'Reduce quantity must be a positive integer' });
  }

  const applyUpdate = (currentStock) => {
    const newStock = Math.max(0, currentStock - delta);
    return { newStock, status: computeStatus(newStock) };
  };

  if (isSupabaseAvailable()) {
    try {
      const { data: existing, error: fetchErr } = await runSupabase(
        supabase
          .from(TABLE_PRODUCTS)
          .select('id, stock')
          .eq('id', id)
          .maybeSingle(),
        'Supabase reduce stock fetch'
      );
      if (fetchErr) throw fetchErr;
      if (!existing) throw new Error('not-found');
      const currentStock = Number(existing.stock) || 0;
      const update = applyUpdate(currentStock);

      const { data, error } = await runSupabase(
        supabase
          .from(TABLE_PRODUCTS)
          .update({ stock: update.newStock, status: update.status })
          .eq('id', id)
          .select()
          .maybeSingle(),
        'Supabase reduce stock update'
      );
      if (error) {
        console.error('Supabase reduce stock error:', error);
        return res.status(400).json({ error: error.message || 'Update failed' });
      }
      const refreshed = await fetchProductById(data?.id || id);
      invalidateCache(id);
      cacheItem(refreshed);
      await logAudit(req.user?.id, data.id, 'REDUCE_STOCK', { delta, stock: update.newStock, status: update.status }, req.user?.username);
      return res.json(refreshed || shapeProductResponse({ ...data, status: update.status }));
    } catch (err) {
      if (err?.message === 'not-found') {
        return res.status(404).json({ error: 'Product not found' });
      }
      console.error('Supabase reduce stock PUT failed, falling back to local:', err?.message || err);
      // Fall through to local fallback below
    }
  }

  // Local fallback
  try {
    const items = readProductsLocal();
    const idx = items.findIndex((p) => String(p.id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'Product not found' });
    const currentStock = Number(items[idx].stock) || 0;
    const update = applyUpdate(currentStock);
    items[idx] = { ...items[idx], stock: update.newStock, status: update.status };
    writeProductsLocal(items);
    await logAudit(req.user?.id, id, 'REDUCE_STOCK', { delta, stock: update.newStock, status: update.status }, req.user?.username);
    return res.json(items[idx]);
  } catch (err) {
    console.error('Local reduce stock PUT failed:', err);
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

// PUT /api/products/:id/price (manager/admin only)
router.put('/:id/price', verifyToken, requireManagerOrAdmin, async (req, res) => {
  const id = req.params.id;
  const { price } = req.body || {};
  const parsedPrice = parseFloat(price);
  if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
    return res.status(400).json({ error: 'Price must be a non-negative number' });
  }

  if (isSupabaseAvailable()) {
    try {
      const { data, error } = await runSupabase(
        supabase
          .from(TABLE_PRODUCTS)
          .update({ price: parsedPrice })
          .eq('id', id)
          .select('id')
          .maybeSingle(),
        'Supabase price update'
      );

      if (error) {
        console.error('Supabase price update error:', error);
        return res.status(400).json({ error: error.message || 'Update failed' });
      }
      if (!data) return res.status(404).json({ error: 'Product not found' });
      await logAudit(req.user?.id, data.id, 'UPDATE_PRICE', { price: parsedPrice }, req.user?.username);
      const refreshed = await fetchProductById(data.id);
      invalidateCache(id);
      cacheItem(refreshed);
      return res.json(refreshed || shapeProductResponse({ ...data, price: parsedPrice }));
    } catch (err) {
      console.error('Supabase price PUT failed, falling back to local:', err?.message || err);
      // Fall through to local fallback below
    }
  }

  // Local fallback
  try {
    const items = readProductsLocal();
    const idx = items.findIndex((p) => String(p.id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'Product not found' });
    items[idx] = { ...items[idx], price: parsedPrice };
    writeProductsLocal(items);
    await logAudit(req.user?.id, id, 'UPDATE_PRICE', { price: parsedPrice }, req.user?.username);
    return res.json(items[idx]);
  } catch (err) {
    console.error('Local price PUT failed:', err);
    res.status(500).json({ error: 'Failed to update price' });
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
    manufacturer,
    storage,
    edition,
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
    if (manufacturer !== undefined) updates.manufacturer = manufacturer || null;
    if (storage !== undefined) updates.storage = storage || null;
    if (edition !== undefined) updates.edition = edition || null;
    if (releaseDate !== undefined) updates.release_date = releaseDate || null;
    if (tags !== undefined) updates.tags = normalizeTags(tags);
    if (image !== undefined) updates.image = image || null;
  }
  if (stock !== undefined) {
    if (stock === '' || stock === null) {
      // ignore empty string
    } else {
      const parsedStock = parseInt(stock, 10);
      if (!Number.isFinite(parsedStock) || parsedStock < 0) {
        return res.status(400).json({ error: 'Stock must be 0 or greater' });
      }
      updates.stock = parsedStock;
      updates.status = computeStatus(parsedStock);
    }
  }

  if (isStaff) {
    // Only stock/status allowed already; proceed
  } else if (role !== 'admin' && role !== 'manager') {
    return res.status(403).json({ error: 'Forbidden: requires manager or admin role' });
  }

  if (isSupabaseAvailable()) {
    try {
      const { data: current, error: currentErr } = await runSupabase(
        supabase
          .from(TABLE_PRODUCTS)
          .select('id, name, brand_id, edition')
          .eq('id', id)
          .maybeSingle(),
        'Supabase fetch product for update'
      );
      if (currentErr) throw currentErr;
      if (!current) return res.status(404).json({ error: 'Product not found' });

      const brandIdForUpdates = updates.brand !== undefined
        ? await resolveLookupId(TABLE_BRANDS, updates.brand)
        : current.brand_id;

      if (updates.brand !== undefined && !brandIdForUpdates) {
        return res.status(400).json({ error: 'Brand could not be resolved' });
      }

      const targetName = updates.name !== undefined ? updates.name : current.name;
      const targetEdition = updates.edition !== undefined ? updates.edition : current.edition;
      const normalizedTargetName = normalizeName(targetName || '');
      const normalizedTargetEdition = normalizeName(targetEdition || '');
      const requiresVariantCheck = updates.name !== undefined || updates.edition !== undefined;

      if (requiresVariantCheck && targetName) {
        const { data: dupRows, error: dupErr } = await runSupabase(
          supabase
            .from(TABLE_PRODUCTS)
            .select('id, name, edition')
            .ilike('name', normalizedTargetName)
            .neq('id', id),
          'Supabase duplicate check update'
        );
        if (dupErr) console.error('Supabase duplicate check error:', dupErr);
        const hasDup = (dupRows || []).some((row) => normalizeName(row.edition || '') === normalizedTargetEdition);
        if (hasDup) {
          return res.status(409).json({ error: 'Product variant (name + edition) already exists' });
        }
      }

      const supabaseUpdates = {};

      if (updates.name !== undefined) supabaseUpdates.name = updates.name;
      if (updates.brand !== undefined) {
        supabaseUpdates.brand_id = brandIdForUpdates;
      }
      if (updates.category !== undefined) {
        supabaseUpdates.category_id = await resolveLookupId(TABLE_CATEGORIES, updates.category);
      }
      if (updates.manufacturer !== undefined) {
        supabaseUpdates.manufacturer_id = await resolveLookupId(TABLE_MANUFACTURERS, updates.manufacturer);
      }
      if (updates.price !== undefined) supabaseUpdates.price = updates.price;
      if (updates.description !== undefined) supabaseUpdates.description = updates.description;
      if (updates.storage !== undefined) supabaseUpdates.storage = updates.storage;
      if (updates.edition !== undefined) supabaseUpdates.edition = updates.edition;
      if (updates.release_date !== undefined) supabaseUpdates.release_date = updates.release_date;
      if (updates.tags !== undefined) supabaseUpdates.tags = updates.tags;
      if (updates.stock !== undefined) {
        supabaseUpdates.stock = updates.stock;
        supabaseUpdates.status = updates.status;
      }

      let targetId = id;
      if (Object.keys(supabaseUpdates).length) {
        const { data, error } = await runSupabase(
          supabase
            .from(TABLE_PRODUCTS)
            .update(supabaseUpdates)
            .eq('id', id)
            .select('id')
            .maybeSingle(),
          'Supabase update product'
        );

        if (error) {
          console.error('Supabase update error:', error);
          return res.status(400).json({ error: error.message || 'Update failed' });
        }
        if (!data) return res.status(404).json({ error: 'Product not found' });
        targetId = data.id;
      } else {
        targetId = current.id;
      }

      const refreshed = await fetchProductById(targetId);
      invalidateCache(targetId);
      cacheItem(refreshed);
      await logAudit(req.user?.id, targetId, 'UPDATE', { updates }, req.user?.username);
      return res.json(refreshed || shapeProductResponse({ ...updates, id: targetId }));
    } catch (err) {
      console.error('Supabase PUT failed:', err);
    }
  }

  // Local fallback
  try {
    const items = readProductsLocal();
    const idx = items.findIndex((p) => String(p.id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'Product not found' });

    const current = items[idx];
    const targetName = updates.name !== undefined ? updates.name : current.name;
    const targetEdition = updates.edition !== undefined ? updates.edition : current.edition;
    const requiresVariantCheck = updates.name !== undefined || updates.edition !== undefined;

    if (requiresVariantCheck) {
      const dup = items.find(
        (p, i) =>
          i !== idx &&
          normalizeName(p.name) === normalizeName(targetName) &&
          normalizeName(p.edition || '') === normalizeName(targetEdition || '')
      );
      if (dup) {
        return res.status(409).json({ error: 'Product variant (name + edition) already exists' });
      }
    }

    const updated = { ...current, ...updates };
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
      const { data, error } = await runSupabase(
        supabase
          .from(TABLE_PRODUCTS)
          .delete()
          .eq('id', id)
          .select()
          .maybeSingle(),
        'Supabase delete product'
      );

      if (error) {
        console.error('Supabase delete error:', error);
        return res.status(400).json({ error: error.message || 'Delete failed' });
      }
      invalidateCache(id);
      await logAudit(req.user?.id, id, 'DELETE', { name: data?.name }, req.user?.username);
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
