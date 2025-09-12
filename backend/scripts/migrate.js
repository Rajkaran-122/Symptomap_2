import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false
});

const sql = `
create table if not exists symptom_reports (
  id uuid primary key default gen_random_uuid(),
  symptom_description text not null,
  location_city text not null,
  location_country text not null,
  severity int not null default 5,
  symptoms jsonb not null default '[]'::jsonb,
  gpt4_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists symptom_reports_created_at_idx on symptom_reports (created_at);
create index if not exists symptom_reports_location_idx on symptom_reports (location_city, location_country);
`;

async function main() {
  try {
    await pool.query("create extension if not exists pgcrypto");
    await pool.query(sql);
    console.log('Migration completed.');
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
