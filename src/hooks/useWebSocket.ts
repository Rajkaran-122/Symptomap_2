import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: Date;
  userId?: string;
}

interface UseWebSocketOptions {
  url: string;
  token?: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  sendMessage: (type: string, data: any) => void;
  subscribe: (event: string, callback: (data: any) => void) => void;
  unsubscribe: (event: string, callback: (data: any) => void) => void;
  reconnect: () => void;
  disconnect: () => void;
}

export const useWebSocket = ({
  url,
  token,
  autoConnect = true,
  reconnectAttempts = 5,
  reconnectInterval = 3000
}: UseWebSocketOptions): UseWebSocketReturn => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const eventListenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  // Initialize socket
  useEffect(() => {
    if (!autoConnect) return;

    const initializeSocket = () => {
      setIsConnecting(true);
      setError(null);

      const newSocket = io(url, {
        auth: {
          token
        },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true
      });

      // Connection event handlers
      newSocket.on('connect', () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;
      });

      newSocket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        setIsConnected(false);
        setIsConnecting(false);
        
        // Attempt reconnection if not manually disconnected
        if (reason !== 'io client disconnect' && reconnectAttemptsRef.current < reconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${reconnectAttempts})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            initializeSocket();
          }, reconnectInterval);
        }
      });

      newSocket.on('connect_error', (err) => {
        console.error('WebSocket connection error:', err);
        setError(err.message);
        setIsConnecting(false);
      });

      // Generic message handler
      newSocket.onAny((event, data) => {
        const listeners = eventListenersRef.current.get(event);
        if (listeners) {
          listeners.forEach(callback => {
            try {
              callback(data);
            } catch (error) {
              console.error(`Error in WebSocket event handler for ${event}:`, error);
            }
          });
        }
      });

      setSocket(newSocket);
    };

    initializeSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socket) {
        socket.disconnect();
      }
    };
  }, [url, token, autoConnect, reconnectAttempts, reconnectInterval]);

  // Send message
  const sendMessage = useCallback((type: string, data: any) => {
    if (socket && isConnected) {
      socket.emit(type, data);
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }, [socket, isConnected]);

  // Subscribe to event
  const subscribe = useCallback((event: string, callback: (data: any) => void) => {
    if (!eventListenersRef.current.has(event)) {
      eventListenersRef.current.set(event, new Set());
    }
    eventListenersRef.current.get(event)!.add(callback);

    // If socket is already connected, add the listener
    if (socket && isConnected) {
      socket.on(event, callback);
    }
  }, [socket, isConnected]);

  // Unsubscribe from event
  const unsubscribe = useCallback((event: string, callback: (data: any) => void) => {
    const listeners = eventListenersRef.current.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        eventListenersRef.current.delete(event);
      }
    }

    // Remove from socket if connected
    if (socket && isConnected) {
      socket.off(event, callback);
    }
  }, [socket, isConnected]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
    }
    reconnectAttemptsRef.current = 0;
    setError(null);
    setIsConnecting(true);
  }, [socket]);

  // Manual disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (socket) {
      socket.disconnect();
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, [socket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);

  return {
    socket,
    isConnected,
    isConnecting,
    error,
    sendMessage,
    subscribe,
    unsubscribe,
    reconnect,
    disconnect
  };
};

// Hook for outbreak-specific WebSocket events
export const useOutbreakWebSocket = (token?: string) => {
  const {
    socket,
    isConnected,
    isConnecting,
    error,
    sendMessage,
    subscribe,
    unsubscribe
  } = useWebSocket({
    url: process.env.REACT_APP_WS_URL || 'ws://localhost:8787',
    token,
    autoConnect: true
  });

  // Subscribe to outbreak events
  const subscribeToOutbreaks = useCallback((callback: (outbreak: any) => void) => {
    subscribe('outbreak:created', callback);
    subscribe('outbreak:updated', callback);
    subscribe('outbreak:deleted', callback);
  }, [subscribe]);

  // Subscribe to prediction events
  const subscribeToPredictions = useCallback((callback: (prediction: any) => void) => {
    subscribe('prediction:updated', callback);
  }, [subscribe]);

  // Subscribe to collaboration events
  const subscribeToCollaboration = useCallback((callback: (data: any) => void) => {
    subscribe('collaboration:user_joined', callback);
    subscribe('collaboration:user_left', callback);
    subscribe('collaboration:annotation_created', callback);
  }, [subscribe]);

  // Subscribe to map events
  const subscribeToMap = useCallback((bounds: any, callback: (data: any) => void) => {
    sendMessage('map:subscribe', bounds);
    subscribe('map:update', callback);
  }, [sendMessage, subscribe]);

  // Unsubscribe from map events
  const unsubscribeFromMap = useCallback((bounds: any) => {
    sendMessage('map:unsubscribe', bounds);
  }, [sendMessage]);

  // Join collaboration room
  const joinCollaborationRoom = useCallback((roomId: string) => {
    sendMessage('collaboration:join_room', roomId);
  }, [sendMessage]);

  // Leave collaboration room
  const leaveCollaborationRoom = useCallback((roomId: string) => {
    sendMessage('collaboration:leave_room', roomId);
  }, [sendMessage]);

  // Update annotation
  const updateAnnotation = useCallback((annotation: any) => {
    sendMessage('annotation:update', annotation);
  }, [sendMessage]);

  return {
    socket,
    isConnected,
    isConnecting,
    error,
    subscribeToOutbreaks,
    subscribeToPredictions,
    subscribeToCollaboration,
    subscribeToMap,
    unsubscribeFromMap,
    joinCollaborationRoom,
    leaveCollaborationRoom,
    updateAnnotation
  };
};