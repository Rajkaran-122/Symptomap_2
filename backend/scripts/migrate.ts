import { getPool } from '../src/database/connection.js';
import fs from 'fs';
import path from 'path';

async function runMigrations() {
  const pool = getPool();
  
  try {
    console.log('🔄 Running database migrations...');
    
    // Read the schema file
    const schemaPath = path.join(process.cwd(), 'src', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the schema
    await pool.query(schema);
    
    console.log('✅ Database migrations completed successfully');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}
