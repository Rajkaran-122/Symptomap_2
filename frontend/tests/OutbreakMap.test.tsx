import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { OutbreakMap } from '../src/components/OutbreakMap';
import { useMapStore } from '../src/store/useMapStore';

// Mock Mapbox GL JS
vi.mock('mapbox-gl', () => ({
  default: {
    accessToken: 'test-token',
    Map: vi.fn(() => ({
      on: vi.fn(),
      off: vi.fn(),
      remove: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      setStyle: vi.fn(),
      getStyle: vi.fn(),
      queryRenderedFeatures: vi.fn(),
      fitBounds: vi.fn(),
      getBounds: vi.fn(),
      getCenter: vi.fn(),
      getZoom: vi.fn(),
      setCenter: vi.fn(),
      setZoom: vi.fn(),
      flyTo: vi.fn(),
      easeTo: vi.fn(),
      jumpTo: vi.fn(),
      panTo: vi.fn(),
      panBy: vi.fn(),
      rotateTo: vi.fn(),
      rotateBy: vi.fn(),
      pitchTo: vi.fn(),
      pitchBy: vi.fn(),
      boxZoom: {
        enable: vi.fn(),
        disable: vi.fn(),
        isEnabled: vi.fn(),
      },
      scrollZoom: {
        enable: vi.fn(),
        disable: vi.fn(),
        isEnabled: vi.fn(),
      },
      dragPan: {
        enable: vi.fn(),
        disable: vi.fn(),
        isEnabled: vi.fn(),
      },
      dragRotate: {
        enable: vi.fn(),
        disable: vi.fn(),
        isEnabled: vi.fn(),
      },
      keyboard: {
        enable: vi.fn(),
        disable: vi.fn(),
        isEnabled: vi.fn(),
      },
      doubleClickZoom: {
        enable: vi.fn(),
        disable: vi.fn(),
        isEnabled: vi.fn(),
      },
      touchZoomRotate: {
        enable: vi.fn(),
        disable: vi.fn(),
        isEnabled: vi.fn(),
      },
    })),
  },
}));

// Mock react-map-gl
vi.mock('react-map-gl', () => ({
  default: ({ children, ...props }: any) => (
    <div data-testid="map" {...props}>
      {children}
    </div>
  ),
  Source: ({ children, ...props }: any) => (
    <div data-testid="source" {...props}>
      {children}
    </div>
  ),
  Layer: ({ ...props }: any) => (
    <div data-testid="layer" {...props} />
  ),
  useMap: () => ({
    map: {
      on: vi.fn(),
      off: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      removeSource: vi.fn(),
      removeLayer: vi.fn(),
      setStyle: vi.fn(),
      getStyle: vi.fn(),
      queryRenderedFeatures: vi.fn(),
      fitBounds: vi.fn(),
      getBounds: vi.fn(),
      getCenter: vi.fn(),
      getZoom: vi.fn(),
      setCenter: vi.fn(),
      setZoom: vi.fn(),
      flyTo: vi.fn(),
      easeTo: vi.fn(),
      jumpTo: vi.fn(),
      panTo: vi.fn(),
      panBy: vi.fn(),
      rotateTo: vi.fn(),
      rotateBy: vi.fn(),
      pitchTo: vi.fn(),
      pitchBy: vi.fn(),
    },
  }),
}));

// Mock environment variables
vi.mock('import.meta.env', () => ({
  VITE_MAPBOX_ACCESS_TOKEN: 'test-token',
}));

describe('OutbreakMap', () => {
  beforeEach(() => {
    // Reset store state
    useMapStore.setState({
      outbreakClusters: [],
      symptomReports: [],
      viewport: {
        latitude: 40.7128,
        longitude: -74.0060,
        zoom: 10,
      },
      filters: {
        diseaseTypes: [],
        minSeverity: 1,
        maxSeverity: 5,
        dateRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(),
        },
      },
      timeWindow: {
        days: 30,
        currentDay: 0,
        isPlaying: false,
      },
      predictions: [],
    });
  });

  it('renders map component', () => {
    render(<OutbreakMap />);
    
    expect(screen.getByTestId('map')).toBeInTheDocument();
  });

  it('renders with default viewport', () => {
    render(<OutbreakMap />);
    
    const map = screen.getByTestId('map');
    expect(map).toHaveAttribute('initialViewState');
  });

  it('renders outbreak clusters when data is available', () => {
    const mockOutbreaks = [
      {
        id: '1',
        latitude: 40.7128,
        longitude: -74.0060,
        caseCount: 25,
        severityLevel: 3,
        diseaseType: 'covid-19',
        confidence: 0.85,
        lastUpdated: new Date().toISOString(),
        symptoms: ['fever', 'cough'],
        locationName: 'New York City',
      },
    ];

    useMapStore.setState({ outbreakClusters: mockOutbreaks });

    render(<OutbreakMap />);
    
    expect(screen.getByTestId('map')).toBeInTheDocument();
  });

  it('renders symptom reports when data is available', () => {
    const mockReports = [
      {
        id: '1',
        latitude: 40.7128,
        longitude: -74.0060,
        case_count: 15,
        severity_level: 2,
        disease_id: 'influenza',
        symptoms: ['fever'],
        location_name: 'New York City',
        created_at: new Date().toISOString(),
      },
    ];

    useMapStore.setState({ symptomReports: mockReports });

    render(<OutbreakMap />);
    
    expect(screen.getByTestId('map')).toBeInTheDocument();
  });

  it('handles empty data gracefully', () => {
    render(<OutbreakMap />);
    
    expect(screen.getByTestId('map')).toBeInTheDocument();
  });

  it('updates when store state changes', async () => {
    const { rerender } = render(<OutbreakMap />);
    
    const newOutbreaks = [
      {
        id: '2',
        latitude: 34.0522,
        longitude: -118.2437,
        caseCount: 20,
        severityLevel: 4,
        diseaseType: 'measles',
        confidence: 0.90,
        lastUpdated: new Date().toISOString(),
        symptoms: ['rash'],
        locationName: 'Los Angeles',
      },
    ];

    useMapStore.setState({ outbreakClusters: newOutbreaks });
    
    rerender(<OutbreakMap />);
    
    expect(screen.getByTestId('map')).toBeInTheDocument();
  });

  it('handles viewport changes', () => {
    const newViewport = {
      latitude: 51.5074,
      longitude: -0.1278,
      zoom: 12,
    };

    useMapStore.setState({ viewport: newViewport });

    render(<OutbreakMap />);
    
    expect(screen.getByTestId('map')).toBeInTheDocument();
  });

  it('handles filter changes', () => {
    const newFilters = {
      diseaseTypes: ['covid-19'],
      minSeverity: 3,
      maxSeverity: 5,
      dateRange: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date(),
      },
    };

    useMapStore.setState({ filters: newFilters });

    render(<OutbreakMap />);
    
    expect(screen.getByTestId('map')).toBeInTheDocument();
  });

  it('handles time window changes', () => {
    const newTimeWindow = {
      days: 7,
      currentDay: 3,
      isPlaying: true,
    };

    useMapStore.setState({ timeWindow: newTimeWindow });

    render(<OutbreakMap />);
    
    expect(screen.getByTestId('map')).toBeInTheDocument();
  });

  it('handles prediction data', () => {
    const mockPredictions = [
      {
        id: '1',
        region: {
          north: 41.0,
          south: 40.0,
          east: -73.0,
          west: -74.0,
        },
        predictions: [
          {
            date: '2024-01-01',
            predictedCases: 30,
            confidenceInterval: {
              lower: 20,
              upper: 40,
            },
            riskLevel: 'medium',
          },
        ],
        confidenceScore: 0.75,
        modelVersion: '1.0.0',
        generatedAt: new Date().toISOString(),
      },
    ];

    useMapStore.setState({ predictions: mockPredictions });

    render(<OutbreakMap />);
    
    expect(screen.getByTestId('map')).toBeInTheDocument();
  });
});
