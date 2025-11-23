// backend/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { createClient } = require('@supabase/supabase-js');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// === Critical: Validate Supabase credentials at startup ===
if (!process.env.SUPABASE_URL) {
  console.error('❌ FATAL: SUPABASE_URL is not set in .env');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ FATAL: SUPABASE_SERVICE_ROLE_KEY is not set in .env');
  process.exit(1);
}

// Optional: Test Supabase connection on startup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware
app.use(cors()); // Allows frontend (e.g., http://localhost:5173) to call backend
app.use(morgan('dev')); // Logging
app.use(express.json({ limit: '10mb' })); // Modern replacement for bodyParser
app.use(express.urlencoded({ extended: true }));

// Log startup info
console.log('=== 🚀 Play & Palm Backend Starting ===');
console.log(`Node.js PID: ${process.pid}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Listening on port: ${PORT}`);
console.log(`Supabase URL: ${process.env.SUPABASE_URL}`);
console.log('✅ Supabase credentials loaded\n');

// === Routes ===
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);

// === Health & Debug Endpoints ===
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Play & Palm backend running' });
});

app.get('/health', async (req, res) => {
  // Optional: Ping Supabase to confirm connectivity
  try {
    const { data, error } = await supabase.rpc('pg_sleep', { seconds: 0 });
    const supabaseHealthy = !error;
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      supabase: supabaseHealthy ? 'connected' : 'failed',
      environment: {
        node_env: process.env.NODE_ENV,
        port: PORT,
        supabase_url_set: !!process.env.SUPABASE_URL,
      },
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: 'Health check failed' });
  }
});

// Optional: Serve Postman collection if exists
app.get('/postman', (req, res) => {
  try {
    const collection = require('./postman_collection.json');
    res.json(collection);
  } catch (err) {
    res.status(404).json({ error: 'Postman collection not found' });
  }
});

// === Global Error Handlers ===
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

// Catch async errors
app.use((err, req, res, next) => {
  console.error('💥 Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// === Start Server ===
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Backend ready at http://localhost:${PORT}`);
  console.log(`💡 Health check: http://localhost:${PORT}/health\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n🔥 PORT ${PORT} is already in use!`);
    console.error(`   → Run 'lsof -i :${PORT}' (macOS/Linux) or 'netstat -ano | findstr :${PORT}' (Windows) to find the process.`);
    console.error(`   → Or change PORT in .env to a different number (e.g., 4001)\n`);
  } else {
    console.error('_Server startup error:', err);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('🛑 Backend stopped.');
    process.exit(0);
  });
});