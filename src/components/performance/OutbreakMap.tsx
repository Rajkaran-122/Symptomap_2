import React, { memo, useMemo, useCallback, startTransition, useRef, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import { debounce } from 'lodash';
import MapboxGL from 'mapbox-gl';
import { motion, AnimatePresence } from 'framer-motion';

interface OutbreakCluster {
  id: string;
  latitude: number;
  longitude: number;
  radius: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  diseaseType: string;
  caseCount: number;
  lastUpdated: Date;
  confidence: number;
  predictions?: {
    sevenDay: number;
    fourteenDay: number;
    confidence: number;
  };
}

interface ViewportState {
  latitude: number;
  longitude: number;
  zoom: number;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

interface FilterState {
  diseaseTypes: string[];
  severityLevels: number[];
  minSeverity: number;
  daysBack: number;
}

interface OutbreakMapProps {
  outbreaks: OutbreakCluster[];
  viewport: ViewportState;
  onClusterClick: (cluster: OutbreakCluster) => void;
  filters: FilterState;
  isLoading?: boolean;
}

// Memoized map component to prevent unnecessary re-renders
const OutbreakMap = memo<OutbreakMapProps>(({
  outbreaks,
  viewport,
  onClusterClick,
  filters,
  isLoading = false
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapboxGL.Map | null>(null);
  const markersRef = useRef<Map<string, MapboxGL.Marker>>(new Map());

  // Memoize expensive calculations
  const filteredOutbreaks = useMemo(() => {
    return outbreaks
      .filter(outbreak => {
        if (filters.diseaseTypes.length > 0 && 
            !filters.diseaseTypes.includes(outbreak.diseaseType)) {
          return false;
        }
        
        const severityMap = { low: 1, medium: 2, high: 3, critical: 4 };
        if (severityMap[outbreak.severity] < filters.minSeverity) {
          return false;
        }
        
        // Geographic bounds check
        return outbreak.latitude >= viewport.bounds.south &&
               outbreak.latitude <= viewport.bounds.north &&
               outbreak.longitude >= viewport.bounds.west &&
               outbreak.longitude <= viewport.bounds.east;
      })
      .sort((a, b) => {
        const severityMap = { low: 1, medium: 2, high: 3, critical: 4 };
        return severityMap[b.severity] - severityMap[a.severity];
      });
  }, [outbreaks, filters, viewport.bounds]);

  // Virtualization for large datasets
  const clusteredOutbreaks = useMemo(() => {
    if (viewport.zoom < 10) {
      // Cluster nearby outbreaks at low zoom levels
      return clusterOutbreaks(filteredOutbreaks, viewport.zoom);
    }
    return filteredOutbreaks;
  }, [filteredOutbreaks, viewport.zoom]);

  // Debounced click handler to prevent rapid clicks
  const debouncedClick = useCallback(
    debounce((cluster: OutbreakCluster) => {
      startTransition(() => {
        onClusterClick(cluster);
      });
    }, 100),
    [onClusterClick]
  );

  // Render only visible clusters based on viewport
  const visibleClusters = useMemo(() => {
    const buffer = 0.1; // 10% buffer around viewport
    return clusteredOutbreaks.filter(cluster => {
      const lat = cluster.latitude;
      const lng = cluster.longitude;
      
      return lat >= (viewport.bounds.south - buffer) &&
             lat <= (viewport.bounds.north + buffer) &&
             lng >= (viewport.bounds.west - buffer) &&
             lng <= (viewport.bounds.east + buffer);
    });
  }, [clusteredOutbreaks, viewport.bounds]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN || '';

    const map = new MapboxGL.Map({
      container: mapRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [viewport.longitude, viewport.latitude],
      zoom: viewport.zoom,
      antialias: true,
      pixelRatio: window.devicePixelRatio || 1
    });

    mapInstanceRef.current = map;

    // Add navigation controls
    map.addControl(new MapboxGL.NavigationControl(), 'top-right');
    map.addControl(new MapboxGL.FullscreenControl(), 'top-right');

    // Add geolocate control
    const geolocate = new MapboxGL.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true,
      showUserHeading: true
    });
    map.addControl(geolocate, 'top-right');

    // Add scale control
    map.addControl(new MapboxGL.ScaleControl({
      maxWidth: 100,
      unit: 'metric'
    }), 'bottom-left');

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update map viewport
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    mapInstanceRef.current.setCenter([viewport.longitude, viewport.latitude]);
    mapInstanceRef.current.setZoom(viewport.zoom);
  }, [viewport.longitude, viewport.latitude, viewport.zoom]);

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    // Add new markers
    visibleClusters.forEach(cluster => {
      const marker = createClusterMarker(cluster, debouncedClick);
      marker.addTo(mapInstanceRef.current!);
      markersRef.current.set(cluster.id, marker);
    });
  }, [visibleClusters, debouncedClick]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
      
      {/* Loading overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10"
          >
            <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-gray-700">Loading outbreak data...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Performance metrics (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white text-xs p-2 rounded">
          <div>Clusters: {visibleClusters.length}</div>
          <div>Filtered: {filteredOutbreaks.length}</div>
          <div>Total: {outbreaks.length}</div>
        </div>
      )}
    </div>
  );
});

// Optimized cluster marker component
const ClusterMarker = memo<{
  cluster: OutbreakCluster;
  onClick: () => void;
}>(({ cluster, onClick }) => {
  const markerStyle = useMemo(() => ({
    width: Math.min(cluster.caseCount / 10 + 20, 60),
    height: Math.min(cluster.caseCount / 10 + 20, 60),
    backgroundColor: getSeverityColor(cluster.severity),
    opacity: cluster.confidence || 1
  }), [cluster.caseCount, cluster.severity, cluster.confidence]);

  return (
    <motion.div
      className="absolute transform -translate-x-1/2 -translate-y-1/2 
                 rounded-full border-2 border-white shadow-lg cursor-pointer
                 transition-transform hover:scale-110 active:scale-95"
      style={markerStyle}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Outbreak cluster: ${cluster.caseCount} cases, severity ${cluster.severity}`}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    >
      {/* Pulse animation for critical outbreaks */}
      {cluster.severity === 'critical' && (
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-red-500"
          animate={{ scale: [1, 1.5], opacity: [0.7, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
});

// Virtualized cluster list for very large datasets
const VirtualizedClusterLayer = memo<{
  clusters: OutbreakCluster[];
  onClusterClick: (cluster: OutbreakCluster) => void;
}>(({ clusters, onClusterClick }) => {
  const itemHeight = 60;
  const containerHeight = 400;

  const Row = memo(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const cluster = clusters[index];
    return (
      <div style={style}>
        <ClusterMarker
          cluster={cluster}
          onClick={() => onClusterClick(cluster)}
        />
      </div>
    );
  });

  return (
    <List
      height={containerHeight}
      itemCount={clusters.length}
      itemSize={itemHeight}
      width="100%"
    >
      {Row}
    </List>
  );
});

// Heatmap layer component
const HeatmapLayer = memo<{ outbreaks: OutbreakCluster[] }>(({ outbreaks }) => {
  const heatmapData = useMemo(() => {
    return outbreaks.map(outbreak => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [outbreak.longitude, outbreak.latitude]
      },
      properties: {
        weight: outbreak.caseCount,
        severity: outbreak.severity
      }
    }));
  }, [outbreaks]);

  // This would integrate with Mapbox GL JS heatmap layer
  // Implementation would depend on specific Mapbox setup
  return null;
});

// Utility functions
function clusterOutbreaks(outbreaks: OutbreakCluster[], zoomLevel: number): OutbreakCluster[] {
  if (outbreaks.length === 0) return [];

  const clusters: OutbreakCluster[] = [];
  const processed = new Set<string>();

  for (const outbreak of outbreaks) {
    if (processed.has(outbreak.id)) continue;

    const cluster = {
      ...outbreak,
      radius: 1000 // 1km default radius
    };

    // Find nearby outbreaks to add to cluster
    const nearbyOutbreaks = outbreaks.filter(other => 
      !processed.has(other.id) &&
      other.id !== outbreak.id &&
      calculateDistance(outbreak, other) < 5000 // 5km
    );

    if (nearbyOutbreaks.length > 0) {
      // Calculate cluster center and total cases
      const allOutbreaks = [outbreak, ...nearbyOutbreaks];
      const totalCases = allOutbreaks.reduce((sum, o) => sum + o.caseCount, 0);
      const avgLat = allOutbreaks.reduce((sum, o) => sum + o.latitude, 0) / allOutbreaks.length;
      const avgLng = allOutbreaks.reduce((sum, o) => sum + o.longitude, 0) / allOutbreaks.length;
      const maxSeverity = allOutbreaks.reduce((max, o) => 
        ['low', 'medium', 'high', 'critical'].indexOf(o.severity) > 
        ['low', 'medium', 'high', 'critical'].indexOf(max) ? o.severity : max
      , 'low' as const);

      cluster.latitude = avgLat;
      cluster.longitude = avgLng;
      cluster.caseCount = totalCases;
      cluster.severity = maxSeverity;
      cluster.radius = Math.min(1000 + (nearbyOutbreaks.length * 200), 5000);

      // Mark all outbreaks in cluster as processed
      allOutbreaks.forEach(o => processed.add(o.id));
    } else {
      processed.add(outbreak.id);
    }

    clusters.push(cluster);
  }

  return clusters;
}

function calculateDistance(point1: OutbreakCluster, point2: OutbreakCluster): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = point1.latitude * Math.PI / 180;
  const φ2 = point2.latitude * Math.PI / 180;
  const Δφ = (point2.latitude - point1.latitude) * Math.PI / 180;
  const Δλ = (point2.longitude - point1.longitude) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

function getSeverityColor(severity: string): string {
  const colors = {
    low: '#10B981',      // green
    medium: '#F59E0B',   // yellow
    high: '#EF4444',     // red
    critical: '#DC2626'  // dark red
  };
  return colors[severity as keyof typeof colors] || colors.low;
}

function createClusterMarker(cluster: OutbreakCluster, onClick: (cluster: OutbreakCluster) => void): MapboxGL.Marker {
  const el = document.createElement('div');
  el.className = 'cluster-marker';
  el.style.width = `${Math.min(cluster.caseCount / 10 + 20, 60)}px`;
  el.style.height = `${Math.min(cluster.caseCount / 10 + 20, 60)}px`;
  el.style.backgroundColor = getSeverityColor(cluster.severity);
  el.style.borderRadius = '50%';
  el.style.border = '2px solid white';
  el.style.cursor = 'pointer';
  el.style.opacity = cluster.confidence || 1;

  el.addEventListener('click', () => onClick(cluster));

  return new MapboxGL.Marker(el)
    .setLngLat([cluster.longitude, cluster.latitude]);
}

export default OutbreakMap;