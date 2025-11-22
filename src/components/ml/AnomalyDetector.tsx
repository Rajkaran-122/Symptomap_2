import React, { memo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, MapPin, Clock, TrendingUp, Activity, Shield } from 'lucide-react';
import { mlService } from '../../services/mlService';

interface Anomaly {
  id: string;
  type: 'spatial' | 'temporal' | 'severity' | 'pattern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: {
    latitude: number;
    longitude: number;
  };
  detectedAt: string;
  confidence: number;
  recommendations: string[];
}

interface AnomalyDetectorProps {
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  onAnomalyClick?: (anomaly: Anomaly) => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const AnomalyDetector = memo<AnomalyDetectorProps>(({
  bounds,
  onAnomalyClick,
  autoRefresh = true,
  refreshInterval = 60000 // 1 minute
}) => {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  // Fetch anomalies
  const fetchAnomalies = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await mlService.detectAnomalies(bounds);
      setAnomalies(result.data.anomalies);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect anomalies');
    } finally {
      setLoading(false);
    }
  }, [bounds]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    fetchAnomalies();
    const interval = setInterval(fetchAnomalies, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchAnomalies]);

  // Filter anomalies
  const filteredAnomalies = anomalies.filter(anomaly => {
    if (selectedType !== 'all' && anomaly.type !== selectedType) return false;
    if (selectedSeverity !== 'all' && anomaly.severity !== selectedSeverity) return false;
    return true;
  });

  // Get anomaly type icon
  const getAnomalyIcon = (type: string) => {
    switch (type) {
      case 'spatial':
        return <MapPin className="w-5 h-5" />;
      case 'temporal':
        return <Clock className="w-5 h-5" />;
      case 'severity':
        return <TrendingUp className="w-5 h-5" />;
      case 'pattern':
        return <Activity className="w-5 h-5" />;
      default:
        return <AlertTriangle className="w-5 h-5" />;
    }
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    const colors = {
      low: 'text-green-600 bg-green-100',
      medium: 'text-yellow-600 bg-yellow-100',
      high: 'text-orange-600 bg-orange-100',
      critical: 'text-red-600 bg-red-100'
    };
    return colors[severity as keyof typeof colors] || colors.low;
  };

  // Get type color
  const getTypeColor = (type: string) => {
    const colors = {
      spatial: 'text-blue-600 bg-blue-100',
      temporal: 'text-purple-600 bg-purple-100',
      severity: 'text-red-600 bg-red-100',
      pattern: 'text-indigo-600 bg-indigo-100'
    };
    return colors[type as keyof typeof colors] || colors.spatial;
  };

  // Format confidence percentage
  const formatConfidence = (confidence: number) => {
    return Math.round(confidence * 100);
  };

  // Format detection time
  const formatDetectionTime = (detectedAt: string) => {
    const date = new Date(detectedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Anomaly Detection</h3>
            {loading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            )}
          </div>
          <button
            onClick={fetchAnomalies}
            disabled={loading}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex space-x-4">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-1"
          >
            <option value="all">All Types</option>
            <option value="spatial">Spatial</option>
            <option value="temporal">Temporal</option>
            <option value="severity">Severity</option>
            <option value="pattern">Pattern</option>
          </select>

          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-1"
          >
            <option value="all">All Severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          </div>
        )}

        {filteredAnomalies.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No anomalies detected in this region</p>
          </div>
        )}

        <div className="space-y-3">
          <AnimatePresence>
            {filteredAnomalies.map((anomaly) => (
              <motion.div
                key={anomaly.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onAnomalyClick?.(anomaly)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg ${getTypeColor(anomaly.type)}`}>
                      {getAnomalyIcon(anomaly.type)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(anomaly.severity)}`}>
                          {anomaly.severity.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatConfidence(anomaly.confidence)}% confidence
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-900 mb-2">{anomaly.description}</p>
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-3 h-3" />
                          <span>
                            {anomaly.location.latitude.toFixed(4)}, {anomaly.location.longitude.toFixed(4)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDetectionTime(anomaly.detectedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xs text-gray-500 mb-1">Type</div>
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {anomaly.type}
                    </span>
                  </div>
                </div>

                {/* Recommendations */}
                {anomaly.recommendations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs font-medium text-gray-700 mb-2">Recommendations:</div>
                    <ul className="space-y-1">
                      {anomaly.recommendations.slice(0, 2).map((rec, index) => (
                        <li key={index} className="text-xs text-gray-600 flex items-start">
                          <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                          {rec}
                        </li>
                      ))}
                      {anomaly.recommendations.length > 2 && (
                        <li className="text-xs text-gray-500">
                          +{anomaly.recommendations.length - 2} more recommendations
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Summary */}
      {anomalies.length > 0 && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Showing {filteredAnomalies.length} of {anomalies.length} anomalies
            </span>
            <div className="flex space-x-4">
              {['critical', 'high', 'medium', 'low'].map(severity => {
                const count = anomalies.filter(a => a.severity === severity).length;
                if (count === 0) return null;
                return (
                  <span key={severity} className={`px-2 py-1 rounded text-xs ${getSeverityColor(severity)}`}>
                    {count} {severity}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

AnomalyDetector.displayName = 'AnomalyDetector';

export default AnomalyDetector;
