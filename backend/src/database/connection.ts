import { Pool, PoolClient } from 'pg';
import { createClient } from 'redis';

// Database connection pool
let pool: Pool | null = null;
let redisClient: ReturnType<typeof createClient> | null = null;
let initPromise: Promise<void> | null = null;

export const initDatabase = async (): Promise<void> => {
  // If initialization is already in progress, wait for it
  if (initPromise) {
    return initPromise;
  }

  // Create the initialization promise
  initPromise = (async () => {
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

    } catch (error) {
      console.error('❌ PostgreSQL connection failed:', error);
      console.log('⚠️  Continuing without database connection...');
    }

    // Initialize Redis connection separately
    try {
      redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('Redis reconnection failed after 10 attempts');
              return new Error('Redis reconnection failed');
            }
            return retries * 50;
          },
        },
      });

      redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
      });

      redisClient.on('connect', () => {
        console.log('✅ Redis connected');
      });

      redisClient.on('ready', () => {
        console.log('✅ Redis ready');
      });

      await redisClient.connect();

    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      console.log('⚠️  Continuing without Redis connection...');
      redisClient = null;
    }
  })();

  return initPromise;
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
  if (redisClient) {
    return redisClient;
  }
  
  // If Redis hasn't been initialized yet but is in progress, return null
  // It will be available once initDatabase completes
  if (!redisClient && !initPromise) {
    console.warn('⚠️  Redis client not yet initialized');
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