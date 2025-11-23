require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  console.log('Testing Supabase connection...');
  const { data, error } = await supabase.from('products').select('count()', { count: 'exact' });
  
  if (error) {
    console.error('❌ Supabase Error:', error);
  } else {
    console.log('✅ Success! Product count:', data[0].count);
  }
}

test();