import { Server as SocketIOServer, Socket } from 'socket.io';
import { getPool, getRedisClient } from '../database/connection.js';
import { outbreakService } from '../services/outbreakService.js';
import { predictionService } from '../services/predictionService.js';

export const setupWebSocket = (io: SocketIOServer): void => {
  const pool = getPool();
  const redis = getRedisClient();

  io.on('connection', (socket: Socket) => {
    console.log(`WebSocket client connected: ${socket.id}`);

    // Store connection info
    const storeConnection = async () => {
      try {
        const query = `
          INSERT INTO websocket_connections (
            connection_id, ip_address, user_agent, connected_at
          )
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (connection_id) DO UPDATE SET
            connected_at = NOW(),
            last_ping_at = NOW(),
            disconnected_at = NULL
        `;

        await pool.query(query, [
          socket.id,
          socket.handshake.address,
          socket.handshake.headers['user-agent'],
        ]);
      } catch (error) {
        console.error('Failed to store WebSocket connection:', error);
      }
    };

    storeConnection();

    // Handle map subscription
    socket.on('map:subscribe', async (bounds: any) => {
      try {
        // Update connection with subscribed regions
        await pool.query(
          'UPDATE websocket_connections SET subscribed_regions = $1 WHERE connection_id = $2',
          [JSON.stringify([bounds]), socket.id]
        );

        // Join room for this region
        const roomId = `region:${bounds.north}:${bounds.south}:${bounds.east}:${bounds.west}`;
        socket.join(roomId);

        // Send current outbreaks in the region
        const outbreaks = await outbreakService.getOutbreaks({
          lat_min: bounds.south,
          lat_max: bounds.north,
          lng_min: bounds.west,
          lng_max: bounds.east,
          days: 7, // Last 7 days
        });

        socket.emit('outbreaks:initial', outbreaks);
        console.log(`Client ${socket.id} subscribed to region, sent ${outbreaks.length} outbreaks`);
      } catch (error) {
        console.error('Map subscription error:', error);
        socket.emit('error', 'Failed to subscribe to map region');
      }
    });

    // Handle map unsubscription
    socket.on('map:unsubscribe', async () => {
      try {
        await pool.query(
          'UPDATE websocket_connections SET subscribed_regions = $1 WHERE connection_id = $2',
          ['[]', socket.id]
        );

        // Leave all region rooms
        const rooms = Array.from(socket.rooms).filter(room => room.startsWith('region:'));
        rooms.forEach(room => socket.leave(room));

        console.log(`Client ${socket.id} unsubscribed from map`);
      } catch (error) {
        console.error('Map unsubscription error:', error);
      }
    });

    // Handle prediction requests
    socket.on('prediction:request', async (region: any) => {
      try {
        const prediction = await predictionService.generatePrediction({
          region,
          horizonDays: 7,
        });

        socket.emit('prediction:ready', prediction);
        console.log(`Generated prediction for client ${socket.id}`);
      } catch (error) {
        console.error('Prediction request error:', error);
        socket.emit('error', 'Failed to generate prediction');
      }
    });

    // Handle ping for connection health
    socket.on('ping', (callback) => {
      if (typeof callback === 'function') {
        callback();
      }
      
      // Update last ping time
      pool.query(
        'UPDATE websocket_connections SET last_ping_at = NOW() WHERE connection_id = $1',
        [socket.id]
      ).catch(console.error);
    });

    // Handle disconnection
    socket.on('disconnect', async (reason) => {
      console.log(`WebSocket client disconnected: ${socket.id}, reason: ${reason}`);
      
      try {
        await pool.query(
          'UPDATE websocket_connections SET disconnected_at = NOW() WHERE connection_id = $1',
          [socket.id]
        );
      } catch (error) {
        console.error('Failed to update disconnection time:', error);
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`WebSocket error for client ${socket.id}:`, error);
    });
  });

  // Broadcast outbreak updates to subscribed clients
  const broadcastOutbreakUpdate = async (outbreak: any, action: 'created' | 'updated' | 'deleted') => {
    try {
      // Find all connections that might be interested in this outbreak
      const query = `
        SELECT connection_id, subscribed_regions
        FROM websocket_connections
        WHERE disconnected_at IS NULL
      `;

      const result = await pool.query(query);
      
      for (const row of result.rows) {
        const subscribedRegions = JSON.parse(row.subscribed_regions || '[]');
        
        // Check if outbreak is within any subscribed region
        const isInRegion = subscribedRegions.some((region: any) => {
          return outbreak.latitude >= region.south &&
                 outbreak.latitude <= region.north &&
                 outbreak.longitude >= region.west &&
                 outbreak.longitude <= region.east;
        });

        if (isInRegion) {
          const socket = io.sockets.sockets.get(row.connection_id);
          if (socket) {
            socket.emit(`outbreak:${action}`, outbreak);
          }
        }
      }
    } catch (error) {
      console.error('Failed to broadcast outbreak update:', error);
    }
  };

  // Set up database triggers for real-time updates
  const setupDatabaseTriggers = async () => {
    try {
      // Create a function to notify WebSocket clients
      await pool.query(`
        CREATE OR REPLACE FUNCTION notify_outbreak_change()
        RETURNS TRIGGER AS $$
        BEGIN
          PERFORM pg_notify('outbreak_change', json_build_object(
            'action', TG_OP,
            'id', COALESCE(NEW.id, OLD.id),
            'data', COALESCE(row_to_json(NEW), row_to_json(OLD))
          )::text);
          RETURN COALESCE(NEW, OLD);
        END;
        $$ LANGUAGE plpgsql;
      `);

      // Create trigger for outbreak changes
      await pool.query(`
        DROP TRIGGER IF EXISTS outbreak_change_trigger ON outbreak_reports;
        CREATE TRIGGER outbreak_change_trigger
          AFTER INSERT OR UPDATE OR DELETE ON outbreak_reports
          FOR EACH ROW EXECUTE FUNCTION notify_outbreak_change();
      `);

      console.log('✅ Database triggers set up for real-time updates');
    } catch (error) {
      console.error('Failed to set up database triggers:', error);
    }
  };

  setupDatabaseTriggers();

  // Listen for database notifications
  const client = pool.connect();
  client.then(async (pgClient) => {
    await pgClient.query('LISTEN outbreak_change');
    
    pgClient.on('notification', async (msg) => {
      try {
        const data = JSON.parse(msg.payload);
        const outbreak = data.data;
        
        // Broadcast to WebSocket clients
        await broadcastOutbreakUpdate(outbreak, data.action.toLowerCase());
      } catch (error) {
        console.error('Failed to process database notification:', error);
      }
    });
  }).catch(console.error);

  // Cleanup old connections periodically
  setInterval(async () => {
    try {
      await pool.query(`
        UPDATE websocket_connections 
        SET disconnected_at = NOW() 
        WHERE disconnected_at IS NULL 
        AND last_ping_at < NOW() - INTERVAL '5 minutes'
      `);
    } catch (error) {
      console.error('Failed to cleanup old connections:', error);
    }
  }, 60000); // Every minute

  // Broadcast system metrics periodically
  setInterval(async () => {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        active_connections: io.sockets.sockets.size,
        total_outbreaks: await outbreakService.getOutbreakStats({ days_back: 1 }).then(s => s.total_outbreaks),
      };

      io.emit('system:metrics', metrics);
    } catch (error) {
      console.error('Failed to broadcast system metrics:', error);
    }
  }, 30000); // Every 30 seconds
};

