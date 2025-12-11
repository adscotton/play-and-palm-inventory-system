// backend/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { supabase, hasSupabaseKey } = require('./utils/supabaseClient');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Log startup info
console.log('=== Play & Palm Backend Starting ===');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Listening on port: ${PORT}`);
console.log(`Supabase configured: ${hasSupabaseKey}`);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);

// Root + health
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Play & Palm backend running' });
});

app.get('/health', async (req, res) => {
  const base = {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };

  if (!hasSupabaseKey || !supabase) {
    return res.json({ status: 'ok', supabase: 'disabled', ...base });
  }
  try {
    // Lightweight Supabase probe: head-only select against products table
    const { error } = await supabase
      .from('products')
      .select('id', { head: true, count: 'exact' })
      .limit(1);

    if (error) {
      console.error('Supabase health check failed:', error.message || error);
      return res.status(503).json({ status: 'error', supabase: 'failed', supabaseError: error.message, ...base });
    }

    res.json({ status: 'ok', supabase: 'connected', ...base });
  } catch (err) {
    console.error('Health check exception:', err);
    res.status(503).json({ status: 'error', supabase: 'failed', supabaseError: err.message || 'Health check failed', ...base });
  }
});

// Postman helper (optional)
app.get('/postman', (req, res) => {
  try {
    const collection = require('./postman_collection.json');
    res.json(collection);
  } catch (err) {
    res.status(404).json({ error: 'Postman collection not found' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend ready at http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`PORT ${PORT} is already in use. Change PORT in .env (e.g., 4001).`);
  } else {
    console.error('Server startup error:', err);
  }
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Backend stopped.');
    process.exit(0);
  });
});
