import { useEffect, useRef, useState, useCallback } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  fps: number;
  componentCount: number;
  reRenderCount: number;
}

interface UsePerformanceOptions {
  enabled?: boolean;
  sampleRate?: number; // 0-1, how often to sample
  reportInterval?: number; // ms
  onMetricsUpdate?: (metrics: PerformanceMetrics) => void;
}

export const usePerformance = (options: UsePerformanceOptions = {}) => {
  const {
    enabled = process.env.NODE_ENV === 'development',
    sampleRate = 0.1,
    reportInterval = 5000,
    onMetricsUpdate
  } = options;

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    fps: 0,
    componentCount: 0,
    reRenderCount: 0
  });

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const renderStartRef = useRef(0);
  const reRenderCountRef = useRef(0);
  const componentCountRef = useRef(0);
  const rafIdRef = useRef<number>();

  // Measure render time
  const startRender = useCallback(() => {
    if (!enabled) return;
    renderStartRef.current = performance.now();
  }, [enabled]);

  const endRender = useCallback(() => {
    if (!enabled || renderStartRef.current === 0) return;
    
    const renderTime = performance.now() - renderStartRef.current;
    reRenderCountRef.current++;
    
    setMetrics(prev => ({
      ...prev,
      renderTime,
      reRenderCount: reRenderCountRef.current
    }));
  }, [enabled]);

  // FPS measurement
  const measureFPS = useCallback(() => {
    if (!enabled) return;

    const now = performance.now();
    frameCountRef.current++;

    if (now - lastTimeRef.current >= 1000) {
      const fps = Math.round((frameCountRef.current * 1000) / (now - lastTimeRef.current));
      
      setMetrics(prev => ({
        ...prev,
        fps
      }));

      frameCountRef.current = 0;
      lastTimeRef.current = now;
    }

    rafIdRef.current = requestAnimationFrame(measureFPS);
  }, [enabled]);

  // Memory usage measurement
  const measureMemory = useCallback(() => {
    if (!enabled) return;

    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
      
      setMetrics(prev => ({
        ...prev,
        memoryUsage: Math.round(memoryUsage * 100) / 100
      }));
    }
  }, [enabled]);

  // Component count measurement
  const incrementComponentCount = useCallback(() => {
    if (!enabled) return;
    componentCountRef.current++;
    setMetrics(prev => ({
      ...prev,
      componentCount: componentCountRef.current
    }));
  }, [enabled]);

  const decrementComponentCount = useCallback(() => {
    if (!enabled) return;
    componentCountRef.current = Math.max(0, componentCountRef.current - 1);
    setMetrics(prev => ({
      ...prev,
      componentCount: componentCountRef.current
    }));
  }, [enabled]);

  // Start performance monitoring
  useEffect(() => {
    if (!enabled) return;

    // Start FPS measurement
    rafIdRef.current = requestAnimationFrame(measureFPS);

    // Memory measurement interval
    const memoryInterval = setInterval(measureMemory, 1000);

    // Report metrics interval
    const reportIntervalId = setInterval(() => {
      if (Math.random() < sampleRate) {
        onMetricsUpdate?.(metrics);
      }
    }, reportInterval);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      clearInterval(memoryInterval);
      clearInterval(reportIntervalId);
    };
  }, [enabled, measureFPS, measureMemory, sampleRate, reportInterval, onMetricsUpdate, metrics]);

  return {
    metrics,
    startRender,
    endRender,
    incrementComponentCount,
    decrementComponentCount
  };
};

// Hook for measuring component render performance
export const useRenderPerformance = (componentName: string, options: UsePerformanceOptions = {}) => {
  const { startRender, endRender, metrics } = usePerformance(options);

  useEffect(() => {
    startRender();
    return () => endRender();
  }, [startRender, endRender]);

  // Log slow renders in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && metrics.renderTime > 16) {
      console.warn(`Slow render detected in ${componentName}: ${metrics.renderTime.toFixed(2)}ms`);
    }
  }, [componentName, metrics.renderTime]);

  return metrics;
};

// Hook for measuring API call performance
export const useAPIPerformance = () => {
  const [apiMetrics, setApiMetrics] = useState<{
    [endpoint: string]: {
      count: number;
      totalTime: number;
      averageTime: number;
      slowestTime: number;
      errors: number;
    }
  }>({});

  const measureAPICall = useCallback(async <T>(
    endpoint: string,
    apiCall: () => Promise<T>
  ): Promise<T> => {
    const startTime = performance.now();
    
    try {
      const result = await apiCall();
      const endTime = performance.now();
      const duration = endTime - startTime;

      setApiMetrics(prev => {
        const current = prev[endpoint] || {
          count: 0,
          totalTime: 0,
          averageTime: 0,
          slowestTime: 0,
          errors: 0
        };

        const newCount = current.count + 1;
        const newTotalTime = current.totalTime + duration;
        const newAverageTime = newTotalTime / newCount;
        const newSlowestTime = Math.max(current.slowestTime, duration);

        return {
          ...prev,
          [endpoint]: {
            count: newCount,
            totalTime: newTotalTime,
            averageTime: newAverageTime,
            slowestTime: newSlowestTime,
            errors: current.errors
          }
        };
      });

      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      setApiMetrics(prev => {
        const current = prev[endpoint] || {
          count: 0,
          totalTime: 0,
          averageTime: 0,
          slowestTime: 0,
          errors: 0
        };

        return {
          ...prev,
          [endpoint]: {
            ...current,
            count: current.count + 1,
            totalTime: current.totalTime + duration,
            averageTime: (current.totalTime + duration) / (current.count + 1),
            slowestTime: Math.max(current.slowestTime, duration),
            errors: current.errors + 1
          }
        };
      });

      throw error;
    }
  }, []);

  return {
    apiMetrics,
    measureAPICall
  };
};

// Hook for measuring map performance
export const useMapPerformance = () => {
  const [mapMetrics, setMapMetrics] = useState<{
    markersRendered: number;
    clustersGenerated: number;
    mapRenderTime: number;
    zoomLevel: number;
    viewportUpdates: number;
  }>({
    markersRendered: 0,
    clustersGenerated: 0,
    mapRenderTime: 0,
    zoomLevel: 0,
    viewportUpdates: 0
  });

  const updateMapMetrics = useCallback((updates: Partial<typeof mapMetrics>) => {
    setMapMetrics(prev => ({ ...prev, ...updates }));
  }, []);

  const measureMapRender = useCallback(async (renderFunction: () => Promise<void>) => {
    const startTime = performance.now();
    await renderFunction();
    const endTime = performance.now();
    
    updateMapMetrics({
      mapRenderTime: endTime - startTime
    });
  }, [updateMapMetrics]);

  return {
    mapMetrics,
    updateMapMetrics,
    measureMapRender
  };
};

// Performance monitoring component
export const PerformanceMonitor: React.FC<{ enabled?: boolean }> = ({ enabled = process.env.NODE_ENV === 'development' }) => {
  const { metrics } = usePerformance({ enabled });

  if (!enabled) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-75 text-white text-xs p-3 rounded-lg font-mono z-50">
      <div className="space-y-1">
        <div>FPS: {metrics.fps}</div>
        <div>Memory: {metrics.memoryUsage}MB</div>
        <div>Render: {metrics.renderTime.toFixed(2)}ms</div>
        <div>Components: {metrics.componentCount}</div>
        <div>Re-renders: {metrics.reRenderCount}</div>
      </div>
    </div>
  );
};