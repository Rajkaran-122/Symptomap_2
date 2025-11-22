import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { OutbreakCluster, MLPrediction, FilterState, TimeWindow, GeographicBounds } from '@/types';

interface MapState {
  // Data
  outbreaks: OutbreakCluster[];
  predictions: MLPrediction[];
  
  // UI State
  filters: FilterState;
  timeWindow: TimeWindow;
  isLoading: boolean;
  error: string | null;
  selectedCluster: OutbreakCluster | null;
  
  // Time-lapse
  isPlaying: boolean;
  playbackSpeed: number;
  currentTime: Date;
  
  // Performance
  lastUpdate: number;
  updateCount: number;
}

interface MapActions {
  // Data Management
  setOutbreaks: (outbreaks: OutbreakCluster[]) => void;
  addOutbreak: (outbreak: OutbreakCluster) => void;
  updateOutbreak: (outbreak: OutbreakCluster) => void;
  removeOutbreak: (id: string) => void;
  
  setPredictions: (predictions: MLPrediction[]) => void;
  
  // Filter Management
  setFilters: (filters: FilterState) => void;
  updateFilters: (updates: Partial<FilterState>) => void;
  
  // Time Management
  setTimeWindow: (timeWindow: TimeWindow) => void;
  setCurrentTime: (time: Date) => void;
  
  // Playback Controls
  play: () => void;
  pause: () => void;
  setPlaybackSpeed: (speed: number) => void;
  
  // Selection
  selectCluster: (cluster: OutbreakCluster | null) => void;
  
  // State Management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Performance Tracking
  incrementUpdateCount: () => void;
}

const initialTimeWindow: TimeWindow = {
  start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
  end: new Date(),
  days: 30,
};

const initialFilters: FilterState = {
  diseaseTypes: [],
  severityLevels: [],
  timeWindow: initialTimeWindow,
};

export const useMapStore = create<MapState & MapActions>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    outbreaks: [],
    predictions: [],
    filters: initialFilters,
    timeWindow: initialTimeWindow,
    isLoading: false,
    error: null,
    selectedCluster: null,
    isPlaying: false,
    playbackSpeed: 1,
    currentTime: new Date(),
    lastUpdate: Date.now(),
    updateCount: 0,

    // Actions
    setOutbreaks: (outbreaks) => set({ outbreaks }),
    
    addOutbreak: (outbreak) => set((state) => ({
      outbreaks: [...state.outbreaks, outbreak],
      updateCount: state.updateCount + 1,
      lastUpdate: Date.now(),
    })),
    
    updateOutbreak: (outbreak) => set((state) => ({
      outbreaks: state.outbreaks.map(o => o.id === outbreak.id ? outbreak : o),
      updateCount: state.updateCount + 1,
      lastUpdate: Date.now(),
    })),
    
    removeOutbreak: (id) => set((state) => ({
      outbreaks: state.outbreaks.filter(o => o.id !== id),
      updateCount: state.updateCount + 1,
      lastUpdate: Date.now(),
    })),
    
    setPredictions: (predictions) => set({ predictions }),
    
    setFilters: (filters) => set({ filters }),
    
    updateFilters: (updates) => set((state) => ({
      filters: { ...state.filters, ...updates },
    })),
    
    setTimeWindow: (timeWindow) => set({ timeWindow }),
    
    setCurrentTime: (currentTime) => set({ currentTime }),
    
    play: () => set({ isPlaying: true }),
    
    pause: () => set({ isPlaying: false }),
    
    setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
    
    selectCluster: (selectedCluster) => set({ selectedCluster }),
    
    setLoading: (isLoading) => set({ isLoading }),
    
    setError: (error) => set({ error }),
    
    incrementUpdateCount: () => set((state) => ({
      updateCount: state.updateCount + 1,
      lastUpdate: Date.now(),
    })),
  }))
);

// Selectors for performance optimization
export const useOutbreaks = () => useMapStore((state) => state.outbreaks);
export const usePredictions = () => useMapStore((state) => state.predictions);
export const useFilters = () => useMapStore((state) => state.filters);
export const useTimeWindow = () => useMapStore((state) => state.timeWindow);
export const useIsPlaying = () => useMapStore((state) => state.isPlaying);
export const useSelectedCluster = () => useMapStore((state) => state.selectedCluster);
export const useIsLoading = () => useMapStore((state) => state.isLoading);
export const useError = () => useMapStore((state) => state.error);

// Action selectors
export const useMapActions = () => useMapStore((state) => ({
  setOutbreaks: state.setOutbreaks,
  addOutbreak: state.addOutbreak,
  updateOutbreak: state.updateOutbreak,
  removeOutbreak: state.removeOutbreak,
  setPredictions: state.setPredictions,
  setFilters: state.setFilters,
  updateFilters: state.updateFilters,
  setTimeWindow: state.setTimeWindow,
  setCurrentTime: state.setCurrentTime,
  play: state.play,
  pause: state.pause,
  setPlaybackSpeed: state.setPlaybackSpeed,
  selectCluster: state.selectCluster,
  setLoading: state.setLoading,
  setError: state.setError,
}));

// Computed selectors
export const useFilteredOutbreaks = () => useMapStore((state) => {
  const { outbreaks, filters } = state;
  
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
    if (outbreakDate < filters.timeWindow.start || outbreakDate > filters.timeWindow.end) {
      return false;
    }
    
    return true;
  });
});

export const usePerformanceMetrics = () => useMapStore((state) => ({
  updateCount: state.updateCount,
  lastUpdate: state.lastUpdate,
  outbreakCount: state.outbreaks.length,
  predictionCount: state.predictions.length,
}));

