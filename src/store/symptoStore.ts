import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export interface SymptomReport {
  id: string;
  location: {
    lat: number;
    lng: number;
    city: string;
    country: string;
  };
  symptoms: string[];
  description: string;
  severity: number;
  timestamp: number;
  demographicInfo?: {
    ageRange: string;
    hasRecentTravel: boolean;
  };
  aiAnalysis?: {
    medicalTerms: string[];
    icd10Codes: string[];
    clusterProbability: number;
    riskScore: number;
  };
}

export interface OutbreakCluster {
  id: string;
  center: { lat: number; lng: number };
  radius: number;
  reportCount: number;
  dominantSymptoms: string[];
  severity: 'normal' | 'unusual' | 'concerning' | 'critical';
  riskScore: number;
  firstDetected: number;
  growthRate: number;
  location: string;
}

export interface GlobalMetrics {
  totalReports: number;
  activeOutbreaks: number;
  riskyRegions: number;
  trendsAnalyzed: number;
  livesProjectedSaved: number;
  detectionSpeedDays: number;
}

export interface MapAnnotation {
  id: string;
  lat: number;
  lng: number;
  text: string;
  createdAt: number;
}

interface SymptoState {
  // Data
  reports: SymptomReport[];
  outbreakClusters: OutbreakCluster[];
  globalMetrics: GlobalMetrics;
  
  // UI State
  selectedReport: SymptomReport | null;
  selectedCluster: OutbreakCluster | null;
  isSubmittingReport: boolean;
  showDemoMode: boolean;
  annotationMode: boolean;
  annotations: MapAnnotation[];
  
  // Actions
  addReport: (report: Omit<SymptomReport, 'id' | 'timestamp'>) => Promise<void>;
  updateGlobalMetrics: () => void;
  detectOutbreaks: () => Promise<void>;
  loadOutbreaksData: (windowDays?: number) => Promise<void>;
  analyzeSymptoms: (symptoms: string, severity: number) => Promise<any>;
  setSelectedReport: (report: SymptomReport | null) => void;
  setSelectedCluster: (cluster: OutbreakCluster | null) => void;
  setSubmittingReport: (isSubmitting: boolean) => void;
  startDemoMode: () => void;
  generateDemoData: () => void;
  toggleAnnotationMode: () => void;
  addAnnotation: (annotation: Omit<MapAnnotation, 'id' | 'createdAt'> & { id?: string }) => void;
  removeAnnotation: (id: string) => void;
  syncAnnotations: () => Promise<void>;
}

// Mock demo data generator
const generateMockReports = (): SymptomReport[] => {
  const cities = [
    { lat: 40.7128, lng: -74.0060, city: "New York", country: "USA" },
    { lat: 51.5074, lng: -0.1278, city: "London", country: "UK" },
    { lat: 35.6762, lng: 139.6503, city: "Tokyo", country: "Japan" },
    { lat: 13.7563, lng: 100.5018, city: "Bangkok", country: "Thailand" },
    { lat: -33.8688, lng: 151.2093, city: "Sydney", country: "Australia" },
    { lat: 55.7558, lng: 37.6176, city: "Moscow", country: "Russia" },
    { lat: -23.5505, lng: -46.6333, city: "São Paulo", country: "Brazil" },
    { lat: 28.6139, lng: 77.2090, city: "New Delhi", country: "India" },
  ];

  const symptoms = [
    ["fever", "cough", "fatigue"],
    ["headache", "muscle pain", "nausea"],
    ["sore throat", "runny nose", "sneezing"],
    ["shortness of breath", "chest pain"],
    ["diarrhea", "vomiting", "stomach pain"],
    ["rash", "itching", "swelling"],
  ];

  return Array.from({ length: 150 }, (_, i) => {
    const location = cities[Math.floor(Math.random() * cities.length)];
    const symptomSet = symptoms[Math.floor(Math.random() * symptoms.length)];
    
    return {
      id: `report-${i}`,
      location: {
        ...location,
        lat: location.lat + (Math.random() - 0.5) * 2,
        lng: location.lng + (Math.random() - 0.5) * 2,
      },
      symptoms: symptomSet,
      description: `Experiencing ${symptomSet.join(', ')} for the past ${Math.floor(Math.random() * 7) + 1} days`,
      severity: Math.floor(Math.random() * 10) + 1,
      timestamp: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
      demographicInfo: {
        ageRange: ['18-25', '26-35', '36-45', '46-55', '55+'][Math.floor(Math.random() * 5)],
        hasRecentTravel: Math.random() > 0.7,
      },
      aiAnalysis: {
        medicalTerms: symptomSet.map(s => s.replace(/\s+/g, '_').toUpperCase()),
        icd10Codes: [`R${Math.floor(Math.random() * 99).toString().padStart(2, '0')}.${Math.floor(Math.random() * 9)}`],
        clusterProbability: Math.random(),
        riskScore: Math.random() * 100,
      },
    };
  });
};

export const useSymptoStore = create<SymptoState>((set, get) => ({
  // Initial data - will be loaded from database
  reports: [],
  outbreakClusters: [],
  globalMetrics: {
    totalReports: 0,
    activeOutbreaks: 0,
    riskyRegions: 0,
    trendsAnalyzed: 0,
    livesProjectedSaved: 0,
    detectionSpeedDays: 3.2,
  },
  
  // UI State
  selectedReport: null,
  selectedCluster: null,
  isSubmittingReport: false,
  showDemoMode: false,
  annotationMode: false,
  annotations: (() => {
    try {
      const raw = localStorage.getItem('symptomap_annotations');
      return raw ? JSON.parse(raw) as MapAnnotation[] : [];
    } catch {
      return [];
    }
  })(),
  
  // Actions
  addReport: async (reportData) => {
    set({ isSubmittingReport: true });
    
    try {
      // First analyze symptoms with AI
      const aiAnalysis = await get().analyzeSymptoms(reportData.description, reportData.severity);
      
      // Submit to database via edge function
      const { data, error } = await supabase.functions.invoke('submit-symptoms', {
        body: {
          ...reportData,
          aiAnalysis
        }
      });

      if (error) throw error;

      // Refresh data from database
      await get().loadOutbreaksData();
      
      set({ 
        isSubmittingReport: false,
        globalMetrics: {
          ...get().globalMetrics,
          totalReports: get().globalMetrics.totalReports + 1
        }
      });
    } catch (error) {
      console.error('Failed to submit report:', error);
      set({ isSubmittingReport: false });
      throw error;
    }
  },

  analyzeSymptoms: async (symptoms: string, severity: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('analyze-symptoms', {
        body: { symptoms, severity }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to analyze symptoms:', error);
      // Return fallback analysis
      return {
        medicalTerms: [],
        icd10Codes: [],
        clusterProbability: 0.5,
        riskScore: severity * 10,
        extractedSymptoms: []
      };
    }
  },
  
  updateGlobalMetrics: () => {
    set((state) => ({
      globalMetrics: {
        ...state.globalMetrics,
        totalReports: state.reports.length,
      }
    }));
  },
  
  detectOutbreaks: async () => {
    try {
      const { data, error } = await supabase.functions.invoke('detect-outbreaks');
      
      if (error) {
        console.error('Outbreak detection failed:', error);
        return;
      }
      
      console.log('Outbreak detection completed:', data);
      // Refresh data after detection
      await get().loadOutbreaksData();
    } catch (error) {
      console.error('Failed to detect outbreaks:', error);
    }
  },

  loadOutbreaksData: async (windowDays = 7) => {
    try {
      const { data, error } = await supabase.functions.invoke('get-outbreaks', {
        body: { windowDays }
      });
      
      if (error) throw error;
      
      set({
        outbreakClusters: data.outbreakClusters || [],
        reports: data.reports || [],
        globalMetrics: data.globalMetrics || get().globalMetrics
      });
    } catch (error) {
      console.error('Failed to load outbreaks data:', error);
    }
  },
  
  setSelectedReport: (report) => set({ selectedReport: report }),
  setSelectedCluster: (cluster) => set({ selectedCluster: cluster }),
  setSubmittingReport: (isSubmitting) => set({ isSubmittingReport: isSubmitting }),
  
  startDemoMode: () => {
    set({ showDemoMode: true });
    get().generateDemoData();
  },
  
  generateDemoData: () => {
    // Add some dramatic demo clusters for presentation
    const demoReports: SymptomReport[] = [
      // Bangkok cluster - Novel flu emergence
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `demo-bangkok-${i}`,
        location: {
          lat: 13.7563 + (Math.random() - 0.5) * 0.1,
          lng: 100.5018 + (Math.random() - 0.5) * 0.1,
          city: "Bangkok",
          country: "Thailand"
        },
        symptoms: ["high fever", "unusual cough", "severe fatigue", "loss of taste"],
        description: "Experiencing novel flu-like symptoms with unusual presentation",
        severity: 7 + Math.floor(Math.random() * 3),
        timestamp: Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000,
        aiAnalysis: {
          medicalTerms: ["PYREXIA", "COUGH_NOVEL", "FATIGUE_SEVERE"],
          icd10Codes: ["R50.9", "R05", "R53"],
          clusterProbability: 0.87,
          riskScore: 85,
        }
      }))
    ];
    
    set((state) => ({
      reports: [...demoReports, ...state.reports],
    }));
    
    setTimeout(() => get().detectOutbreaks(), 500);
  },

  toggleAnnotationMode: () => set((s) => ({ annotationMode: !s.annotationMode })),
  addAnnotation: (annotation) => set((s) => {
    const newAnnotation: MapAnnotation = {
      id: annotation.id || `ann_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      lat: annotation.lat,
      lng: annotation.lng,
      text: annotation.text.slice(0, 280),
      createdAt: Date.now(),
    };
    const next = [...s.annotations, newAnnotation];
    try { localStorage.setItem('symptomap_annotations', JSON.stringify(next)); } catch {}
    return { annotations: next } as any;
  }),
  removeAnnotation: (id) => set((s) => {
    const next = s.annotations.filter(a => a.id !== id);
    try { localStorage.setItem('symptomap_annotations', JSON.stringify(next)); } catch {}
    return { annotations: next } as any;
  }),
  syncAnnotations: async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      const { data, error } = await supabase.from('map_annotations').select('*').order('created_at', { ascending: false }).limit(500);
      if (!error && data) {
        const synced = data.map((row: any) => ({
          id: row.id,
          lat: row.lat,
          lng: row.lng,
          text: row.text,
          createdAt: new Date(row.created_at).getTime(),
        }));
        set({ annotations: synced });
      }
      // subscribe to realtime changes
      supabase.channel('map_annotations_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'map_annotations' }, (payload) => {
          const current = get().annotations;
          if (payload.eventType === 'INSERT') {
            const row: any = payload.new;
            const next = [{ id: row.id, lat: row.lat, lng: row.lng, text: row.text, createdAt: new Date(row.created_at).getTime() }, ...current];
            set({ annotations: next });
          } else if (payload.eventType === 'DELETE') {
            const row: any = payload.old;
            set({ annotations: current.filter(a => a.id !== row.id) });
          } else if (payload.eventType === 'UPDATE') {
            const row: any = payload.new;
            set({ annotations: current.map(a => a.id === row.id ? { id: row.id, lat: row.lat, lng: row.lng, text: row.text, createdAt: new Date(row.created_at).getTime() } : a) });
          }
        })
        .subscribe();
    } catch (e) {
      console.error('Failed to sync annotations', e);
    }
  },
}));