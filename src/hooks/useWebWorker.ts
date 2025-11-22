import { useRef, useCallback, useEffect } from 'react';

interface WebWorkerMessage<T = any> {
  id: number;
  type: string;
  payload: T;
}

interface WebWorkerResponse<T = any> {
  id: number;
  type: 'SUCCESS' | 'ERROR';
  result?: T;
  error?: string;
}

export const useWebWorker = (workerScript: string) => {
  const workerRef = useRef<Worker | null>(null);
  const messageIdRef = useRef(0);
  const pendingMessagesRef = useRef<Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }>>(new Map());

  // Initialize worker
  useEffect(() => {
    try {
      workerRef.current = new Worker(workerScript);
      
      workerRef.current.onmessage = (event: MessageEvent<WebWorkerResponse>) => {
        const { id, type, result, error } = event.data;
        const pendingMessage = pendingMessagesRef.current.get(id);
        
        if (pendingMessage) {
          pendingMessagesRef.current.delete(id);
          
          if (type === 'SUCCESS') {
            pendingMessage.resolve(result);
          } else {
            pendingMessage.reject(new Error(error || 'Worker error'));
          }
        }
      };
      
      workerRef.current.onerror = (error) => {
        console.error('Web Worker error:', error);
        // Reject all pending messages
        pendingMessagesRef.current.forEach(({ reject }) => {
          reject(new Error('Worker crashed'));
        });
        pendingMessagesRef.current.clear();
      };
      
    } catch (error) {
      console.error('Failed to create Web Worker:', error);
    }
    
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      // Reject all pending messages
      pendingMessagesRef.current.forEach(({ reject }) => {
        reject(new Error('Worker terminated'));
      });
      pendingMessagesRef.current.clear();
    };
  }, [workerScript]);

  // Send message to worker
  const sendMessage = useCallback(<T = any, R = any>(
    type: string,
    payload: T
  ): Promise<R> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const messageId = ++messageIdRef.current;
      const message: WebWorkerMessage<T> = {
        id: messageId,
        type,
        payload
      };

      pendingMessagesRef.current.set(messageId, { resolve, reject });
      workerRef.current.postMessage(message);
    });
  }, []);

  return {
    sendMessage,
    isReady: workerRef.current !== null
  };
};

// Specialized hook for outbreak processing
export const useOutbreakProcessor = () => {
  const worker = useWebWorker('/workers/outbreak-processor.js');

  const clusterOutbreaks = useCallback(async (
    outbreaks: any[],
    algorithm: 'dbscan' | 'kmeans' = 'dbscan',
    params: any = {}
  ) => {
    return worker.sendMessage('CLUSTER_OUTBREAKS', {
      outbreaks,
      algorithm,
      params
    });
  }, [worker.sendMessage]);

  const calculateRiskScores = useCallback(async (outbreaks: any[]) => {
    return worker.sendMessage('CALCULATE_RISK_SCORES', { outbreaks });
  }, [worker.sendMessage]);

  const detectAnomalies = useCallback(async (
    outbreaks: any[],
    threshold: number = 2.0
  ) => {
    return worker.sendMessage('DETECT_ANOMALIES', {
      outbreaks,
      threshold
    });
  }, [worker.sendMessage]);

  const generateHeatmapData = useCallback(async (
    outbreaks: any[],
    bounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    },
    gridSize: number = 50
  ) => {
    return worker.sendMessage('GENERATE_HEATMAP', {
      outbreaks,
      bounds,
      gridSize
    });
  }, [worker.sendMessage]);

  return {
    clusterOutbreaks,
    calculateRiskScores,
    detectAnomalies,
    generateHeatmapData,
    isReady: worker.isReady
  };
};

// Hook for managing multiple workers
export const useWorkerPool = (workerScript: string, poolSize: number = 4) => {
  const workersRef = useRef<Worker[]>([]);
  const currentWorkerRef = useRef(0);
  const messageIdRef = useRef(0);
  const pendingMessagesRef = useRef<Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }>>(new Map());

  // Initialize worker pool
  useEffect(() => {
    try {
      for (let i = 0; i < poolSize; i++) {
        const worker = new Worker(workerScript);
        
        worker.onmessage = (event: MessageEvent<WebWorkerResponse>) => {
          const { id, type, result, error } = event.data;
          const pendingMessage = pendingMessagesRef.current.get(id);
          
          if (pendingMessage) {
            pendingMessagesRef.current.delete(id);
            
            if (type === 'SUCCESS') {
              pendingMessage.resolve(result);
            } else {
              pendingMessage.reject(new Error(error || 'Worker error'));
            }
          }
        };
        
        worker.onerror = (error) => {
          console.error(`Worker ${i} error:`, error);
        };
        
        workersRef.current.push(worker);
      }
    } catch (error) {
      console.error('Failed to create worker pool:', error);
    }
    
    return () => {
      workersRef.current.forEach(worker => worker.terminate());
      workersRef.current = [];
      pendingMessagesRef.current.clear();
    };
  }, [workerScript, poolSize]);

  // Send message to next available worker (round-robin)
  const sendMessage = useCallback(<T = any, R = any>(
    type: string,
    payload: T
  ): Promise<R> => {
    return new Promise((resolve, reject) => {
      if (workersRef.current.length === 0) {
        reject(new Error('No workers available'));
        return;
      }

      const messageId = ++messageIdRef.current;
      const message: WebWorkerMessage<T> = {
        id: messageId,
        type,
        payload
      };

      pendingMessagesRef.current.set(messageId, { resolve, reject });
      
      // Round-robin worker selection
      const worker = workersRef.current[currentWorkerRef.current];
      currentWorkerRef.current = (currentWorkerRef.current + 1) % workersRef.current.length;
      
      worker.postMessage(message);
    });
  }, []);

  return {
    sendMessage,
    isReady: workersRef.current.length > 0,
    poolSize: workersRef.current.length
  };
};
