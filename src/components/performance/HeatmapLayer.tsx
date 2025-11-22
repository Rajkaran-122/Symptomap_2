import React, { memo, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOutbreakProcessor } from '../../hooks/useWebWorker';

interface HeatmapLayerProps {
  outbreaks: any[];
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  intensity?: number;
  radius?: number;
  className?: string;
}

interface HeatmapPoint {
  latitude: number;
  longitude: number;
  intensity: number;
}

const HeatmapLayer = memo<HeatmapLayerProps>(({
  outbreaks,
  bounds,
  intensity = 0.6,
  radius = 50,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const heatmapDataRef = useRef<HeatmapPoint[]>([]);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [heatmapData, setHeatmapData] = React.useState<HeatmapPoint[]>([]);

  const { generateHeatmapData, isReady: workerReady } = useOutbreakProcessor();

  // Generate heatmap data using web worker
  const generateHeatmap = useCallback(async () => {
    if (!workerReady || outbreaks.length === 0) {
      setHeatmapData([]);
      return;
    }

    setIsGenerating(true);
    
    try {
      const data = await generateHeatmapData(outbreaks, bounds, 100);
      setHeatmapData(data);
      heatmapDataRef.current = data;
    } catch (error) {
      console.error('Failed to generate heatmap data:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [outbreaks, bounds, generateHeatmapData, workerReady]);

  // Generate heatmap when data changes
  useEffect(() => {
    generateHeatmap();
  }, [generateHeatmap]);

  // Render heatmap on canvas
  const renderHeatmap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || heatmapData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Create gradient for heatmap
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStop(0, `rgba(255, 0, 0, ${intensity})`);
    gradient.addColorStop(0.5, `rgba(255, 255, 0, ${intensity * 0.5})`);
    gradient.addColorStop(1, `rgba(0, 0, 255, 0)`);

    // Convert geographic coordinates to canvas coordinates
    const latRange = bounds.north - bounds.south;
    const lngRange = bounds.east - bounds.west;

    heatmapData.forEach(point => {
      const x = ((point.longitude - bounds.west) / lngRange) * canvas.width;
      const y = ((bounds.north - point.latitude) / latRange) * canvas.height;
      
      ctx.save();
      ctx.globalAlpha = point.intensity;
      ctx.translate(x, y);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }, [heatmapData, bounds, intensity, radius]);

  // Update canvas size when bounds change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    renderHeatmap();
  }, [bounds, renderHeatmap]);

  // Render heatmap when data changes
  useEffect(() => {
    renderHeatmap();
  }, [renderHeatmap]);

  // Animate heatmap intensity
  useEffect(() => {
    const animate = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Add subtle animation to heatmap
      const time = Date.now() * 0.001;
      const animatedIntensity = intensity * (0.8 + 0.2 * Math.sin(time));
      
      // Re-render with animated intensity
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      gradient.addColorStop(0, `rgba(255, 0, 0, ${animatedIntensity})`);
      gradient.addColorStop(0.5, `rgba(255, 255, 0, ${animatedIntensity * 0.5})`);
      gradient.addColorStop(1, `rgba(0, 0, 255, 0)`);

      const latRange = bounds.north - bounds.south;
      const lngRange = bounds.east - bounds.west;

      heatmapData.forEach(point => {
        const x = ((point.longitude - bounds.west) / lngRange) * canvas.width;
        const y = ((bounds.north - point.latitude) / latRange) * canvas.height;
        
        ctx.save();
        ctx.globalAlpha = point.intensity * (0.8 + 0.2 * Math.sin(time + point.latitude));
        ctx.translate(x, y);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    if (heatmapData.length > 0) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [heatmapData, bounds, intensity, radius]);

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ mixBlendMode: 'multiply' }}
      />
      
      {/* Loading indicator */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-4 left-4 bg-black/50 text-white px-3 py-2 rounded-lg flex items-center space-x-2"
          >
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span className="text-sm">Generating heatmap...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Heatmap controls */}
      <div className="absolute bottom-4 right-4 bg-black/50 text-white p-3 rounded-lg">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <label className="text-sm">Intensity:</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={intensity}
              onChange={(e) => {
                // This would need to be passed up to parent component
                console.log('Intensity changed:', e.target.value);
              }}
              className="w-20"
            />
            <span className="text-xs">{Math.round(intensity * 100)}%</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-sm">Radius:</label>
            <input
              type="range"
              min="10"
              max="200"
              step="10"
              value={radius}
              onChange={(e) => {
                // This would need to be passed up to parent component
                console.log('Radius changed:', e.target.value);
              }}
              className="w-20"
            />
            <span className="text-xs">{radius}px</span>
          </div>
        </div>
      </div>

      {/* Heatmap legend */}
      <div className="absolute top-4 right-4 bg-black/50 text-white p-3 rounded-lg">
        <div className="text-sm font-semibold mb-2">Heat Intensity</div>
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span className="text-xs">High</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span className="text-xs">Medium</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span className="text-xs">Low</span>
          </div>
        </div>
      </div>
    </div>
  );
});

// Performance monitoring wrapper
export const PerformanceMonitoredHeatmapLayer = memo<HeatmapLayerProps>((props) => {
  const renderStartRef = useRef(0);
  const renderCountRef = useRef(0);

  useEffect(() => {
    renderStartRef.current = performance.now();
    renderCountRef.current++;
  });

  useEffect(() => {
    const renderTime = performance.now() - renderStartRef.current;
    
    if (renderTime > 16) { // Log slow renders (>16ms)
      console.warn(`Slow heatmap render: ${renderTime.toFixed(2)}ms`, {
        outbreakCount: props.outbreaks.length,
        renderCount: renderCountRef.current
      });
    }
  });

  return <HeatmapLayer {...props} />;
});

export default HeatmapLayer;
