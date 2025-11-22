import React, { memo, useMemo, useCallback, useRef, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import { motion, AnimatePresence } from 'framer-motion';
import { OutbreakCluster } from '../../types/symptomap';

interface VirtualizedClusterLayerProps {
  clusters: OutbreakCluster[];
  onClusterClick: (cluster: OutbreakCluster) => void;
  viewport: {
    width: number;
    height: number;
    zoom: number;
  };
  className?: string;
}

interface ClusterItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    clusters: OutbreakCluster[];
    onClusterClick: (cluster: OutbreakCluster) => void;
    viewport: {
      width: number;
      height: number;
      zoom: number;
    };
  };
}

// Memoized cluster item component
const ClusterItem = memo<ClusterItemProps>(({ index, style, data }) => {
  const { clusters, onClusterClick, viewport } = data;
  const cluster = clusters[index];

  const handleClick = useCallback(() => {
    onClusterClick(cluster);
  }, [cluster, onClusterClick]);

  const markerStyle = useMemo(() => {
    const baseSize = Math.max(20, Math.min(60, cluster.caseCount / 10 + 20));
    const zoomFactor = Math.pow(2, viewport.zoom - 10); // Scale with zoom
    const size = baseSize * zoomFactor;

    return {
      width: size,
      height: size,
      backgroundColor: getSeverityColor(cluster.severity),
      opacity: cluster.confidence || 1,
      borderRadius: '50%',
      border: '2px solid white',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontSize: Math.max(10, size * 0.3),
      fontWeight: 'bold'
    };
  }, [cluster, viewport.zoom]);

  return (
    <motion.div
      style={style}
      className="flex items-center justify-center"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Outbreak cluster: ${cluster.caseCount} cases, severity ${cluster.severity}`}
    >
      <div style={markerStyle}>
        {cluster.caseCount > 100 ? `${Math.floor(cluster.caseCount / 100)}k` : cluster.caseCount}
      </div>
    </motion.div>
  );
});

// Main virtualized cluster layer component
const VirtualizedClusterLayer = memo<VirtualizedClusterLayerProps>(({
  clusters,
  onClusterClick,
  viewport,
  className = ''
}) => {
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Memoize list data to prevent unnecessary re-renders
  const listData = useMemo(() => ({
    clusters,
    onClusterClick,
    viewport
  }), [clusters, onClusterClick, viewport]);

  // Calculate item height based on zoom level
  const itemHeight = useMemo(() => {
    const baseHeight = 80;
    const zoomFactor = Math.pow(2, Math.max(0, viewport.zoom - 8));
    return Math.max(40, baseHeight / zoomFactor);
  }, [viewport.zoom]);

  // Handle scroll to keep clusters in view
  const handleScroll = useCallback((scrollOffset: number) => {
    // This could be used to update map viewport based on scroll
    // For now, we'll just log for debugging
    console.debug('Cluster list scrolled:', scrollOffset);
  }, []);

  // Auto-scroll to top when clusters change significantly
  useEffect(() => {
    if (listRef.current && clusters.length > 0) {
      listRef.current.scrollToItem(0, 'start');
    }
  }, [clusters.length]);

  // Performance optimization: only render if we have clusters
  if (clusters.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <List
            ref={listRef}
            height={Math.min(400, viewport.height * 0.6)}
            width={viewport.width}
            itemCount={clusters.length}
            itemSize={itemHeight}
            itemData={listData}
            onScroll={handleScroll}
            overscanCount={5} // Render 5 extra items for smooth scrolling
            className="outbreak-cluster-list"
          >
            {ClusterItem}
          </List>
        </motion.div>
      </AnimatePresence>

      {/* Performance indicator */}
      <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
        {clusters.length} clusters
      </div>
    </div>
  );
});

// Helper function to get severity color
function getSeverityColor(severity: string): string {
  const colors = {
    low: '#10B981',
    medium: '#F59E0B', 
    high: '#EF4444',
    critical: '#7C2D12'
  };
  return colors[severity as keyof typeof colors] || colors.low;
}

// Performance monitoring wrapper
export const PerformanceMonitoredClusterLayer = memo<VirtualizedClusterLayerProps>((props) => {
  const renderStartRef = useRef(0);
  const renderCountRef = useRef(0);

  useEffect(() => {
    renderStartRef.current = performance.now();
    renderCountRef.current++;
  });

  useEffect(() => {
    const renderTime = performance.now() - renderStartRef.current;
    
    if (renderTime > 16) { // Log slow renders (>16ms)
      console.warn(`Slow cluster layer render: ${renderTime.toFixed(2)}ms`, {
        clusterCount: props.clusters.length,
        renderCount: renderCountRef.current
      });
    }
  });

  return <VirtualizedClusterLayer {...props} />;
});

export default VirtualizedClusterLayer;
