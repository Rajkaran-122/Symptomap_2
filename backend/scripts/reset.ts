import { getPool } from '../src/database/connection.js';

async function resetDatabase() {
  const pool = getPool();
  
  try {
    console.log('🔄 Resetting database...');
    
    // Drop all tables
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('CREATE SCHEMA public');
    
    console.log('✅ Database reset completed');
    
  } catch (error) {
    console.error('❌ Reset failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run reset if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  resetDatabase();
}
