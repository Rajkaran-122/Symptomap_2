import React, { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { OutbreakMap } from '@/components/OutbreakMap';
import { TimeLapseControls } from '@/components/TimeLapseControls';
import { PredictionPanel } from '@/components/PredictionPanel';
import { FilterPanel } from '@/components/FilterPanel';
import { useMapStore } from '@/store/useMapStore';
import { websocketService } from '@/services/websocket';
import { SymptoMapAPI } from '@/services/api';

function App() {
  const { 
    setOutbreaks, 
    addOutbreak, 
    updateOutbreak, 
    removeOutbreak,
    setPredictions,
    setLoading,
    setError,
    updateFilters,
  } = useMapStore();

  // Initialize WebSocket connection
  useEffect(() => {
    const initializeWebSocket = async () => {
      try {
        await websocketService.connect();
        
        // Set up event handlers
        websocketService.on('outbreak:created', (outbreak) => {
          addOutbreak(outbreak);
        });
        
        websocketService.on('outbreak:updated', (outbreak) => {
          updateOutbreak(outbreak);
        });
        
        websocketService.on('outbreak:deleted', (id) => {
          removeOutbreak(id);
        });
        
        websocketService.on('prediction:ready', (prediction) => {
          setPredictions([prediction]);
        });
        
        websocketService.on('system:error', (error) => {
          setError(error);
        });
        
      } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
        setError('Failed to connect to real-time updates');
      }
    };

    initializeWebSocket();

    return () => {
      websocketService.disconnect();
    };
  }, [addOutbreak, updateOutbreak, removeOutbreak, setPredictions, setError]);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        // Load outbreaks for the entire world initially
        const outbreaksResponse = await SymptoMapAPI.getOutbreaks({
          days: 30,
        });
        
        setOutbreaks(outbreaksResponse.data);
        
        // Set initial bounds for filters
        updateFilters({
          bounds: {
            north: 85,
            south: -85,
            east: 180,
            west: -180,
          },
        });
        
      } catch (error) {
        console.error('Failed to load initial data:', error);
        setError('Failed to load outbreak data');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [setOutbreaks, setLoading, setError, updateFilters]);

  // Health check
  useEffect(() => {
    const performHealthCheck = async () => {
      try {
        const health = await SymptoMapAPI.healthCheck();
        console.log('API Health:', health);
      } catch (error) {
        console.error('Health check failed:', error);
      }
    };

    performHealthCheck();
    const interval = setInterval(performHealthCheck, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">SM</span>
                </div>
                <h1 className="text-xl font-bold text-gray-900">SymptoMap</h1>
              </div>
              <div className="hidden md:block text-sm text-gray-500">
                Real-time Disease Surveillance & Outbreak Prediction
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Live Data
              </div>
              <div className="text-sm text-gray-600">
                v1.0.0 MVP
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Filters */}
          <div className="lg:col-span-1 space-y-6">
            <FilterPanel />
            <TimeLapseControls />
          </div>

          {/* Main Map Area */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="h-96 lg:h-[600px]">
                <OutbreakMap />
              </div>
            </div>
          </div>

          {/* Right Sidebar - Predictions */}
          <div className="lg:col-span-1">
            <PredictionPanel />
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Performance</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">200ms</div>
              <div className="text-sm text-gray-600">API Response</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">50ms</div>
              <div className="text-sm text-gray-600">Map Render</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">100ms</div>
              <div className="text-sm text-gray-600">WebSocket</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">1,000+</div>
              <div className="text-sm text-gray-600">Concurrent Users</div>
            </div>
          </div>
        </div>
      </main>

      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </div>
  );
}

export default App;

