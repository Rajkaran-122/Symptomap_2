import React, { memo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Server, 
  Database, 
  Cpu, 
  MemoryStick, 
  Wifi, 
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface MetricData {
  timestamp: string;
  value: number;
  label: string;
}

interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    load: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
  database: {
    connections: number;
    queries: number;
    responseTime: number;
  };
  api: {
    requests: number;
    errors: number;
    responseTime: number;
    uptime: number;
  };
}

interface SystemMetricsProps {
  realTime?: boolean;
  refreshInterval?: number;
  showCharts?: boolean;
}

const SystemMetrics = memo<SystemMetricsProps>(({
  realTime = true,
  refreshInterval = 5000,
  showCharts = true
}) => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [historicalData, setHistoricalData] = useState<{
    cpu: MetricData[];
    memory: MetricData[];
    network: MetricData[];
    api: MetricData[];
  }>({
    cpu: [],
    memory: [],
    network: [],
    api: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string>('cpu');

  // Mock data generator for development
  const generateMockMetrics = useCallback((): SystemMetrics => {
    const now = Date.now();
    return {
      cpu: {
        usage: Math.random() * 100,
        cores: 8,
        load: [Math.random() * 2, Math.random() * 2, Math.random() * 2]
      },
      memory: {
        used: Math.random() * 16,
        total: 16,
        percentage: Math.random() * 100
      },
      disk: {
        used: Math.random() * 500,
        total: 1000,
        percentage: Math.random() * 100
      },
      network: {
        bytesIn: Math.random() * 1000000,
        bytesOut: Math.random() * 1000000,
        packetsIn: Math.floor(Math.random() * 1000),
        packetsOut: Math.floor(Math.random() * 1000)
      },
      database: {
        connections: Math.floor(Math.random() * 50) + 10,
        queries: Math.floor(Math.random() * 1000) + 100,
        responseTime: Math.random() * 100
      },
      api: {
        requests: Math.floor(Math.random() * 1000) + 500,
        errors: Math.floor(Math.random() * 10),
        responseTime: Math.random() * 200 + 50,
        uptime: Math.floor((now - (now - 86400000)) / 1000) // 24 hours
      }
    };
  }, []);

  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // In production, this would call the actual API
      const mockMetrics = generateMockMetrics();
      setMetrics(mockMetrics);

      // Update historical data
      const timestamp = new Date().toISOString();
      setHistoricalData(prev => ({
        cpu: [...prev.cpu.slice(-19), { timestamp, value: mockMetrics.cpu.usage, label: 'CPU Usage %' }],
        memory: [...prev.memory.slice(-19), { timestamp, value: mockMetrics.memory.percentage, label: 'Memory Usage %' }],
        network: [...prev.network.slice(-19), { timestamp, value: mockMetrics.network.bytesIn / 1024 / 1024, label: 'Network In (MB/s)' }],
        api: [...prev.api.slice(-19), { timestamp, value: mockMetrics.api.responseTime, label: 'API Response Time (ms)' }]
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  }, [generateMockMetrics]);

  // Auto-refresh
  useEffect(() => {
    if (!realTime) return;

    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [realTime, refreshInterval, fetchMetrics]);

  // Get status color
  const getStatusColor = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return 'text-red-600 bg-red-100';
    if (value >= thresholds.warning) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  // Format bytes
  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Format uptime
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  if (!metrics) {
    return (
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading system metrics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">System Metrics</h3>
            {loading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
              metrics.api.uptime > 86400 ? 'text-green-600 bg-green-100' : 'text-yellow-600 bg-yellow-100'
            }`}>
              {metrics.api.uptime > 86400 ? 'Healthy' : 'Warning'}
            </div>
            <button
              onClick={fetchMetrics}
              disabled={loading}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {/* CPU Usage */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Cpu className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">CPU Usage</span>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(metrics.cpu.usage, { warning: 70, critical: 90 })}`}>
                {metrics.cpu.usage.toFixed(1)}%
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {metrics.cpu.usage.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500">
              {metrics.cpu.cores} cores • Load: {metrics.cpu.load.map(l => l.toFixed(2)).join(', ')}
            </div>
            <div className="mt-2 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${metrics.cpu.usage}%` }}
              />
            </div>
          </div>

          {/* Memory Usage */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <MemoryStick className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-gray-700">Memory</span>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(metrics.memory.percentage, { warning: 80, critical: 95 })}`}>
                {metrics.memory.percentage.toFixed(1)}%
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {formatBytes(metrics.memory.used * 1024 * 1024 * 1024)}
            </div>
            <div className="text-xs text-gray-500">
              of {formatBytes(metrics.memory.total * 1024 * 1024 * 1024)}
            </div>
            <div className="mt-2 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${metrics.memory.percentage}%` }}
              />
            </div>
          </div>

          {/* Database */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Database className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium text-gray-700">Database</span>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(metrics.database.responseTime, { warning: 100, critical: 500 })}`}>
                {metrics.database.responseTime.toFixed(0)}ms
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {metrics.database.connections}
            </div>
            <div className="text-xs text-gray-500">
              connections • {metrics.database.queries} queries/min
            </div>
          </div>

          {/* API Performance */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Server className="w-5 h-5 text-orange-600" />
                <span className="text-sm font-medium text-gray-700">API</span>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(metrics.api.responseTime, { warning: 200, critical: 500 })}`}>
                {metrics.api.responseTime.toFixed(0)}ms
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {metrics.api.requests}
            </div>
            <div className="text-xs text-gray-500">
              requests/min • {metrics.api.errors} errors • {formatUptime(metrics.api.uptime)} uptime
            </div>
          </div>
        </div>

        {/* Charts */}
        {showCharts && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-gray-900">Performance Trends</h4>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1"
              >
                <option value="cpu">CPU Usage</option>
                <option value="memory">Memory Usage</option>
                <option value="network">Network</option>
                <option value="api">API Response Time</option>
              </select>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historicalData[selectedMetric as keyof typeof historicalData]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                            <p className="font-semibold">{new Date(label).toLocaleString()}</p>
                            <p className="text-blue-600">
                              {payload[0].dataKey}: {payload[0].value?.toFixed(2)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#3B82F6"
                    fill="#3B82F6"
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

SystemMetrics.displayName = 'SystemMetrics';

export default SystemMetrics;
