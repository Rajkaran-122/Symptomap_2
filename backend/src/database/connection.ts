import { Pool, PoolClient } from 'pg';
import { createClient } from 'redis';

// Database connection pool
let pool: Pool | null = null;
let redisClient: ReturnType<typeof createClient> | null = null;

export const initDatabase = async (): Promise<void> => {
  try {
    // Initialize PostgreSQL connection pool
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://symptomap:password@localhost:5432/symptomap',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test PostgreSQL connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ PostgreSQL connected');

    // Initialize Redis connection
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    await redisClient.connect();
    console.log('✅ Redis connected');

  } catch (error) {
    console.error('❌ Database connection failed:', error);
    // Don't throw error, just log it and continue
    console.log('⚠️  Continuing without database connection...');
  }
};

export const getPool = (): Pool => {
  if (!pool) {
    // Initialize pool if not already done
    initDatabase().catch(console.error);
    if (!pool) {
      throw new Error('Database pool not initialized');
    }
  }
  return pool;
};

export const getRedisClient = () => {
  if (!redisClient) {
    // Initialize Redis if not already done
    initDatabase().catch(console.error);
    if (!redisClient) {
      console.warn('⚠️  Redis client not initialized, continuing without Redis...');
      return null;
    }
  }
  return redisClient;
};

export const closeConnections = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
  }
  
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};