import { io, Socket } from 'socket.io-client';
import { OutbreakCluster, MLPrediction, GeographicBounds } from '@/types';

export class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(private url: string = 'http://localhost:8787') {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.url, {
          transports: ['websocket'],
          timeout: 10000,
          auth: {
            token: localStorage.getItem('auth_token'),
          },
        });

        this.socket.on('connect', () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error);
          reject(error);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('WebSocket disconnected:', reason);
          if (reason === 'io server disconnect') {
            // Server disconnected, try to reconnect
            this.handleReconnect();
          }
        });

        this.setupEventHandlers();
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Outbreak events
    this.socket.on('outbreak:created', (outbreak: OutbreakCluster) => {
      this.emit('outbreak:created', outbreak);
    });

    this.socket.on('outbreak:updated', (outbreak: OutbreakCluster) => {
      this.emit('outbreak:updated', outbreak);
    });

    this.socket.on('outbreak:deleted', (id: string) => {
      this.emit('outbreak:deleted', id);
    });

    // Prediction events
    this.socket.on('prediction:ready', (prediction: MLPrediction) => {
      this.emit('prediction:ready', prediction);
    });

    // System events
    this.socket.on('system:maintenance', (message: string) => {
      this.emit('system:maintenance', message);
    });

    this.socket.on('system:error', (error: string) => {
      this.emit('system:error', error);
    });
  }

  // Map subscription
  subscribeToMap(bounds: GeographicBounds): void {
    if (this.socket) {
      this.socket.emit('map:subscribe', bounds);
    }
  }

  unsubscribeFromMap(): void {
    if (this.socket) {
      this.socket.emit('map:unsubscribe');
    }
  }

  // Prediction requests
  requestPrediction(region: GeographicBounds): void {
    if (this.socket) {
      this.socket.emit('prediction:request', region);
    }
  }

  // Private event emitter
  private eventHandlers: Map<string, Set<Function>> = new Map();

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data?: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().catch((error) => {
          console.error('Reconnection failed:', error);
        });
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('connection:failed', 'Max reconnection attempts reached');
    }
  }

  // Connection status
  get isConnected(): boolean {
    return this.socket?.connected || false;
  }

  get connectionId(): string | undefined {
    return this.socket?.id;
  }

  // Latency measurement
  ping(): Promise<number> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve(-1);
        return;
      }

      const startTime = performance.now();
      this.socket.emit('ping', () => {
        const latency = performance.now() - startTime;
        resolve(latency);
      });
    });
  }
}

// Singleton instance
export const websocketService = new WebSocketService();

// React hook for WebSocket
export const useWebSocket = () => {
  return websocketService;
};

