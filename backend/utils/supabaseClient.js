// utils/supabaseClient.js
const { createClient } = require('@supabase/supabase-js');

// Ensure environment variables are loaded (if dotenv is used, it must be required in server.js FIRST)
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();

// Fallback URL only for development — do not rely on hardcoded URLs in production
const DEFAULT_SUPABASE_URL = 'https://zcrytpyuxmrnjdbyjhsr.supabase.co';

const finalUrl = SUPABASE_URL || DEFAULT_SUPABASE_URL;
const finalKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY || null;

if (!finalUrl) {
  console.warn('Supabase URL not set; Supabase features will be disabled.');
}

let supabase = null;
let hasSupabaseKey = false;

if (finalKey) {
  // create client if there is a key; otherwise keep supabase as null to enable local fallback
  try {
    supabase = createClient(finalUrl, finalKey);
    hasSupabaseKey = true;
    console.log('Supabase client created. Using service-role key:', !!SUPABASE_SERVICE_ROLE_KEY);
  } catch (err) {
    console.error('Failed to create Supabase client:', err?.message || err);
    supabase = null;
    hasSupabaseKey = false;
  }
} else {
  console.warn('No Supabase key found. Server will use local JSON fallback for persistence.');
}

module.exports = { supabase, hasSupabaseKey };