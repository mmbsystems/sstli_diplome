import {createClient} from '@supabase/supabase-js';
import {loadEnvFile} from 'node:process';
loadEnvFile('.env.local');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {auth:{persistSession:false}});

// Use the Management API to run raw SQL
async function runSQL(sql) {
  const projectRef = 'crzedkbjvujcmcikgvoe';
  const mgmtUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  const response = await fetch(mgmtUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({query: sql})
  });
  const text = await response.text();
  if (!response.ok) {
    console.log('Error:', response.status, text);
    throw new Error(`Failed: ${text}`);
  }
  console.log('Success:', text);
}

async function main() {
  // Try with a personal access token instead
  // The service role key might not work for Management API
  // Let me try the Supabase CLI db query approach with a file
}

main().catch(console.error);