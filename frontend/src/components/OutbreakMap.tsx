import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { OutbreakCluster, GeographicBounds, SEVERITY_COLORS } from '@/types';
import { useMapStore } from '@/store/useMapStore';
import { websocketService } from '@/services/websocket';

// Set Mapbox access token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

interface OutbreakMapProps {
  className?: string;
}

export const OutbreakMap: React.FC<OutbreakMapProps> = ({ className = '' }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  
  const {
    outbreaks,
    selectedCluster,
    filters,
    timeWindow,
    isPlaying,
    selectCluster,
    setLoading,
    setError,
  } = useMapStore();

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [0, 20], // Center on world map
      zoom: 2,
      maxZoom: 18,
      minZoom: 1,
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add geolocate control
    map.current.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: true,
        showUserHeading: true,
      }),
      'top-right'
    );

    // Handle map load
    map.current.on('load', () => {
      setLoading(false);
    });

    // Handle map errors
    map.current.on('error', (e) => {
      console.error('Map error:', e);
      setError('Failed to load map');
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [setLoading, setError]);

  // Filter outbreaks based on current filters and time window
  const filteredOutbreaks = useMemo(() => {
    return outbreaks.filter(outbreak => {
      // Filter by disease type
      if (filters.diseaseTypes.length > 0 && !filters.diseaseTypes.includes(outbreak.diseaseType)) {
        return false;
      }
      
      // Filter by severity level
      if (filters.severityLevels.length > 0 && !filters.severityLevels.includes(outbreak.severityLevel)) {
        return false;
      }
      
      // Filter by time window
      const outbreakDate = new Date(outbreak.lastUpdated);
      if (outbreakDate < timeWindow.start || outbreakDate > timeWindow.end) {
        return false;
      }
      
      return true;
    });
  }, [outbreaks, filters, timeWindow]);

  // Create cluster markers
  const createClusterMarker = useCallback((outbreak: OutbreakCluster) => {
    if (!map.current) return null;

    const color = SEVERITY_COLORS[outbreak.severityLevel];
    const size = Math.max(8, Math.min(24, outbreak.caseCount / 10));

    // Create marker element
    const el = document.createElement('div');
    el.className = 'outbreak-marker';
    el.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      background-color: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    // Add pulse animation for high severity
    if (outbreak.severityLevel >= 4) {
      el.style.animation = 'pulse-slow 2s infinite';
    }

    // Create marker
    const marker = new mapboxgl.Marker(el)
      .setLngLat([outbreak.longitude, outbreak.latitude])
      .addTo(map.current!);

    // Add click handler
    el.addEventListener('click', () => {
      selectCluster(outbreak);
      
      // Fly to marker
      map.current?.flyTo({
        center: [outbreak.longitude, outbreak.latitude],
        zoom: Math.max(map.current.getZoom(), 10),
        duration: 1000,
      });
    });

    // Add hover effects
    el.addEventListener('mouseenter', () => {
      el.style.transform = 'scale(1.2)';
      el.style.zIndex = '1000';
    });

    el.addEventListener('mouseleave', () => {
      el.style.transform = 'scale(1)';
      el.style.zIndex = 'auto';
    });

    return marker;
  }, [selectCluster]);

  // Update markers when outbreaks change
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current.clear();

    // Add new markers
    filteredOutbreaks.forEach(outbreak => {
      const marker = createClusterMarker(outbreak);
      if (marker) {
        markers.current.set(outbreak.id, marker);
      }
    });
  }, [filteredOutbreaks, createClusterMarker]);

  // Handle map bounds changes for WebSocket subscription
  useEffect(() => {
    if (!map.current) return;

    const handleMoveEnd = () => {
      const bounds = map.current!.getBounds();
      const geographicBounds: GeographicBounds = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      };
      
      websocketService.subscribeToMap(geographicBounds);
    };

    map.current.on('moveend', handleMoveEnd);
    map.current.on('zoomend', handleMoveEnd);

    // Initial subscription
    handleMoveEnd();

    return () => {
      if (map.current) {
        map.current.off('moveend', handleMoveEnd);
        map.current.off('zoomend', handleMoveEnd);
      }
      websocketService.unsubscribeFromMap();
    };
  }, []);

  // Handle selected cluster
  useEffect(() => {
    if (!map.current || !selectedCluster) return;

    // Fly to selected cluster
    map.current.flyTo({
      center: [selectedCluster.longitude, selectedCluster.latitude],
      zoom: Math.max(map.current.getZoom(), 12),
      duration: 1000,
    });
  }, [selectedCluster]);

  // Performance monitoring
  useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const renderTime = performance.now() - startTime;
      if (renderTime > 50) { // Performance target: 50ms
        console.warn(`Map render time exceeded target: ${renderTime.toFixed(2)}ms`);
      }
    };
  });

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div ref={mapContainer} className="w-full h-full rounded-lg" />
      
      {/* Map overlay with outbreak count */}
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
        <div className="text-sm font-medium text-gray-700">
          Active Outbreaks
        </div>
        <div className="text-2xl font-bold text-gray-900">
          {filteredOutbreaks.length}
        </div>
        <div className="text-xs text-gray-500">
          {outbreaks.length} total
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
        <div className="text-sm font-medium text-gray-700 mb-2">Severity Levels</div>
        <div className="space-y-1">
          {Object.entries(SEVERITY_COLORS).map(([level, color]) => (
            <div key={level} className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full border border-white shadow-sm"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-gray-600">Level {level}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Performance indicator */}
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
        <div className="text-xs text-gray-500">
          Render: {filteredOutbreaks.length} markers
        </div>
      </div>
    </div>
  );
};

export default OutbreakMap;

