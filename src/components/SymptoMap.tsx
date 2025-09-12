import React, { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { motion } from 'framer-motion';
import { useSymptoStore } from '@/store/symptoStore';

const SymptoMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState('');
  const [needsToken, setNeedsToken] = useState(true);
  
  const { reports, outbreakClusters, selectedCluster, setSelectedCluster, loadOutbreaksData, annotationMode, annotations, addAnnotation, removeAnnotation } = useSymptoStore() as any;
  const [daysWindow, setDaysWindow] = useState(30);
  const [isPlaying, setIsPlaying] = useState(false);
  const playRef = useRef<number | null>(null);
  const annotationModeRef = useRef<boolean>(false);
  useEffect(() => { annotationModeRef.current = annotationMode; }, [annotationMode]);

  const topSymptoms = useMemo(() => {
    const counts: Record<string, number> = {};
    reports.forEach(r => r.symptoms.forEach(s => { counts[s] = (counts[s] || 0) + 1; }));
    return Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 4);
  }, [reports]);

  const avgRiskScore = useMemo(() => {
    if (outbreakClusters.length === 0) return 0;
    const sum = outbreakClusters.reduce((acc, c) => acc + (c.riskScore || 0), 0);
    return sum / outbreakClusters.length;
  }, [outbreakClusters]);

  // For demo purposes, we'll use a token input field
  useEffect(() => {
    const savedToken = localStorage.getItem('mapboxToken');
    if (savedToken) {
      setMapboxToken(savedToken);
      setNeedsToken(false);
    }
  }, []);

  const handleTokenSubmit = () => {
    if (mapboxToken) {
      localStorage.setItem('mapboxToken', mapboxToken);
      setNeedsToken(false);
    }
  };

  useEffect(() => {
    if (!mapContainer.current || needsToken) return;

    // Initialize map
    mapboxgl.accessToken = mapboxToken;
    
    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        projection: 'globe' as any,
        zoom: 2,
        center: [20, 20],
        pitch: 30,
      });

      // Add navigation controls
      map.current.addControl(
        new mapboxgl.NavigationControl({
          visualizePitch: true,
        }),
        'top-right'
      );

      // Add atmosphere and fog effects
      map.current.on('style.load', () => {
        map.current?.setFog({
          color: 'rgb(30, 30, 40)',
          'high-color': 'rgb(50, 50, 70)',
          'horizon-blend': 0.3,
        });
      });

      // Add outbreak clusters when map loads
      map.current.on('load', () => {
        // Add outbreak clusters source
        map.current?.addSource('outbreaks', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [],
          },
        });

        // Add cluster circles layer (severity-colored)
        map.current?.addLayer({
          id: 'outbreak-heat',
          type: 'circle',
          source: 'outbreaks',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'radius'], 0, 10, 2, 50],
            'circle-color': [
              'case',
              ['==', ['get', 'severity'], 'critical'], '#ef4444',
              ['==', ['get', 'severity'], 'concerning'], '#f97316',
              ['==', ['get', 'severity'], 'unusual'], '#eab308',
              '#22c55e'
            ],
            'circle-opacity': 0.6,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-opacity': 0.8,
          },
        });

        // Add pulse layer
        map.current?.addLayer({
          id: 'outbreak-pulse',
          type: 'circle',
          source: 'outbreaks',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'radius'], 0, 15, 2, 80],
            'circle-color': [
              'case',
              ['==', ['get', 'severity'], 'critical'], '#ef4444',
              ['==', ['get', 'severity'], 'concerning'], '#f97316',
              ['==', ['get', 'severity'], 'unusual'], '#eab308',
              '#22c55e'
            ],
            'circle-opacity': 0.2,
          },
        });

        // Reports source (raw reports) for heatmap + points
        map.current?.addSource('reports', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [],
          },
        });

        // Heatmap layer from individual reports
        map.current?.addLayer({
          id: 'reports-heatmap',
          type: 'heatmap',
          source: 'reports',
          maxzoom: 9,
          paint: {
            'heatmap-weight': ['interpolate', ['linear'], ['get', 'severity'], 1, 0.2, 10, 1],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.8, 9, 2],
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(33, 250, 93,0)',
              0.2, 'rgba(34,197,94,0.6)',
              0.4, 'rgba(234,179,8,0.7)',
              0.6, 'rgba(249,115,22,0.8)',
              0.8, 'rgba(239,68,68,0.9)'
            ],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 9, 20],
            'heatmap-opacity': 0.7,
          },
        });

        // Report points as fallback on higher zoom
        map.current?.addLayer({
          id: 'reports-points',
          type: 'circle',
          source: 'reports',
          minzoom: 5,
          paint: {
            'circle-radius': 3,
            'circle-color': [
              'interpolate', ['linear'], ['get', 'severity'],
              1, '#22c55e',
              4, '#eab308',
              7, '#f97316',
              9, '#ef4444'
            ],
            'circle-opacity': 0.7,
          },
        });

        // Spread lines between high-risk clusters
        map.current?.addSource('spread-lines', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.current?.addLayer({
          id: 'spread-lines-layer',
          type: 'line',
          source: 'spread-lines',
          paint: {
            'line-width': 2,
            'line-color': '#60a5fa',
            'line-opacity': 0.3,
          },
        });

        // Add click handler
        map.current?.on('click', 'outbreak-heat', (e) => {
          const feature = e.features?.[0];
          if (feature) {
            const cluster = outbreakClusters.find(c => c.id === feature.properties?.id);
            if (cluster) {
              setSelectedCluster(cluster);
            }
          }
        });

        // General map click for annotations
        map.current?.on('click', (e) => {
          if (!annotationModeRef.current) return;
          const { lng, lat } = e.lngLat;
          const text = prompt('Add annotation note:');
          if (text && text.trim()) {
            addAnnotation({ lat, lng, text: text.trim() });
          }
        });
      });

    } catch (error) {
      console.error('Mapbox initialization error:', error);
      setNeedsToken(true);
    }

    // Cleanup
    return () => {
      map.current?.remove();
    };
  }, [needsToken, mapboxToken]);

  // Update outbreak data when clusters change
  useEffect(() => {
    if (!map.current || needsToken) return;

    const geojsonData = {
      type: 'FeatureCollection' as const,
      features: outbreakClusters.map(cluster => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [cluster.center.lng, cluster.center.lat],
        },
        properties: {
          id: cluster.id,
          severity: cluster.severity,
          radius: cluster.radius,
          reportCount: cluster.reportCount,
          riskScore: cluster.riskScore,
          location: cluster.location,
          symptoms: cluster.dominantSymptoms.join(', '),
        },
      })),
    };

    const source = map.current.getSource('outbreaks') as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData(geojsonData);
    }

    // Update spread lines connecting top risky clusters
    const topCritical = outbreakClusters
      .filter(c => c.severity === 'critical' || c.severity === 'concerning')
      .slice(0, 6);
    const lineFeatures = [] as any[];
    for (let i = 0; i < topCritical.length; i++) {
      for (let j = i + 1; j < topCritical.length; j++) {
        const a = topCritical[i];
        const b = topCritical[j];
        lineFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [a.center.lng, a.center.lat],
              [b.center.lng, b.center.lat],
            ],
          },
          properties: {},
        });
      }
    }
    const spreadSrc = map.current.getSource('spread-lines') as mapboxgl.GeoJSONSource;
    if (spreadSrc) {
      spreadSrc.setData({ type: 'FeatureCollection', features: lineFeatures });
    }
  }, [outbreakClusters, needsToken]);

  // Update reports data when window or reports change
  useEffect(() => {
    if (!map.current || needsToken) return;
    const features = reports.map(r => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [r.location.lng, r.location.lat] },
      properties: {
        severity: r.severity,
        timestamp: r.timestamp,
      },
    }));
    const reportsSrc = map.current.getSource('reports') as mapboxgl.GeoJSONSource;
    if (reportsSrc) {
      reportsSrc.setData({ type: 'FeatureCollection', features } as any);
    }
  }, [reports, needsToken]);

  // Debounced server-windowed data fetch when slider changes
  useEffect(() => {
    const handle = setTimeout(() => {
      loadOutbreaksData(Math.round(daysWindow));
    }, 300);
    return () => clearTimeout(handle);
  }, [daysWindow, loadOutbreaksData]);

  // Timelapse play/pause
  useEffect(() => {
    if (!isPlaying) {
      if (playRef.current) cancelAnimationFrame(playRef.current);
      return;
    }
    const step = () => {
      setDaysWindow(prev => {
        if (prev <= 1) return 30; // loop
        return prev - 0.25;
      });
      playRef.current = requestAnimationFrame(step);
    };
    playRef.current = requestAnimationFrame(step);
    return () => {
      if (playRef.current) cancelAnimationFrame(playRef.current);
    };
  }, [isPlaying]);

  // Render annotations as a separate layer of markers
  useEffect(() => {
    if (!map.current || needsToken) return;
    const sourceId = 'annotations';
    const layerId = 'annotations-layer';
    const data = {
      type: 'FeatureCollection' as const,
      features: annotations.map((a: any) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [a.lng, a.lat] },
        properties: { id: a.id, text: a.text }
      }))
    } as any;

    const src = map.current.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
    if (!src) {
      map.current.addSource(sourceId, { type: 'geojson', data });
      map.current.addLayer({
        id: layerId,
        type: 'symbol',
        source: sourceId,
        layout: {
          'icon-image': 'marker-15',
          'text-field': ['get', 'text'],
          'text-size': 10,
          'text-offset': [0, 1.2],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#e5e7eb'
        }
      });
      map.current.on('click', layerId, (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const id = feature.properties?.id as string;
        if (confirm('Delete this annotation?')) removeAnnotation(id);
      });
    } else {
      src.setData(data);
    }
  }, [annotations, needsToken]);

  if (needsToken) {
    return (
      <div className="relative w-full h-full bg-card rounded-xl border flex items-center justify-center">
        <div className="max-w-md mx-auto p-6 text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m-6 3l6-3" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground">Mapbox Token Required</h3>
          <p className="text-sm text-muted-foreground">
            To display the interactive outbreak map, please enter your Mapbox public token. 
            Get yours at <a href="https://mapbox.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">mapbox.com</a>
          </p>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="pk.eyJ1IjoieW91ciIsImEiOiJhY2NvdW50In0..."
              value={mapboxToken}
              onChange={(e) => setMapboxToken(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
            />
            <button
              onClick={handleTokenSubmit}
              className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              disabled={!mapboxToken.trim()}
            >
              Initialize Map
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border shadow-lg">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Floating Control Panel */}
      <motion.div 
        className="absolute top-4 left-4 bg-card/95 backdrop-blur-sm rounded-lg p-4 shadow-lg border"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-foreground">Global Health Monitor</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <div className="text-muted-foreground">Active Reports</div>
              <div className="font-mono text-primary font-semibold">{reports.length.toLocaleString()}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Outbreak Clusters</div>
              <div className="font-mono text-orange-500 font-semibold">{outbreakClusters.length}</div>
            </div>
          </div>
          
          {/* Severity Legend */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Risk Levels</div>
            <div className="space-y-1">
              {[
                { color: 'bg-green-500', label: 'Normal', count: outbreakClusters.filter(c => c.severity === 'normal').length },
                { color: 'bg-yellow-500', label: 'Unusual', count: outbreakClusters.filter(c => c.severity === 'unusual').length },
                { color: 'bg-orange-500', label: 'Concerning', count: outbreakClusters.filter(c => c.severity === 'concerning').length },
                { color: 'bg-red-500', label: 'Critical', count: outbreakClusters.filter(c => c.severity === 'critical').length },
              ].map(({ color, label, count }) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <div className={`w-3 h-3 rounded-full ${color}`} />
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono text-foreground ml-auto">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trending + Risk */}
          <div className="pt-2 border-t border-border/70">
            <div className="text-xs font-medium text-muted-foreground mb-1">Trending Symptoms</div>
            <div className="flex flex-wrap gap-1">
              {topSymptoms.map(([sym, count]) => (
                <span key={sym} className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary border border-primary/20">{sym} · {count}</span>
              ))}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">Avg Risk Score</div>
            <div className="font-mono text-sm text-orange-500">{avgRiskScore.toFixed(1)}</div>
          </div>

          {/* Time-lapse slider */}
          <div className="pt-3 border-t border-border/70">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Past {Math.round(daysWindow)} days</span>
              <button onClick={() => setIsPlaying(p => !p)} className="px-2 py-1 rounded-md border hover:bg-accent">
                {isPlaying ? 'Pause' : 'Play'}
              </button>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              step={1}
              value={daysWindow}
              onChange={(e) => setDaysWindow(parseInt(e.target.value))}
              className="w-full mt-2"
            />
          </div>
        </div>
      </motion.div>

      {/* Selected Cluster Info */}
      {selectedCluster && (
        <motion.div 
          className="absolute top-4 right-4 bg-card/95 backdrop-blur-sm rounded-lg p-4 shadow-lg border max-w-sm"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="flex items-start justify-between mb-3">
            <h3 className="font-semibold text-foreground">Outbreak Cluster</h3>
            <button 
              onClick={() => setSelectedCluster(null)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-muted-foreground">Location</div>
              <div className="font-medium">{selectedCluster.location}</div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-muted-foreground">Reports</div>
                <div className="font-mono text-primary">{selectedCluster.reportCount}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Risk Score</div>
                <div className="font-mono text-orange-500">{selectedCluster.riskScore.toFixed(1)}</div>
              </div>
            </div>
            
            <div>
              <div className="text-muted-foreground">Dominant Symptoms</div>
              <div className="font-medium">{selectedCluster.dominantSymptoms.join(', ')}</div>
            </div>
            
            <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
              selectedCluster.severity === 'critical' ? 'bg-red-500/20 text-red-600' :
              selectedCluster.severity === 'concerning' ? 'bg-orange-500/20 text-orange-600' :
              selectedCluster.severity === 'unusual' ? 'bg-yellow-500/20 text-yellow-600' :
              'bg-green-500/20 text-green-600'
            }`}>
              {selectedCluster.severity.toUpperCase()}
            </div>
          </div>
        </motion.div>
      )}

      {/* Pulsing Animation Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {outbreakClusters.filter(c => c.severity === 'critical').map((cluster) => (
          <motion.div
            key={cluster.id}
            className="absolute w-4 h-4 bg-red-500/30 rounded-full"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
            animate={{
              scale: [1, 2, 1],
              opacity: [0.6, 0.2, 0.6],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default SymptoMap;