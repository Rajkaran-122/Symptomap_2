import React, { memo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, Target } from 'lucide-react';
import { mlService } from '../../services/mlService';
import { usePerformance } from '../../hooks/usePerformance';

interface PredictionData {
  id: string;
  modelVersion: string;
  modelName: string;
  diseaseId: string;
  boundsNorth: number;
  boundsSouth: number;
  boundsEast: number;
  boundsWest: number;
  regionName?: string;
  predictionDate: string;
  horizonDays: number;
  predictedCases: Array<{
    date: string;
    predictedCases: number;
    confidenceInterval: {
      lower: number;
      upper: number;
    };
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }>;
  predictedSeverity?: {
    trend: string;
    confidence: number;
  };
  riskFactors?: {
    populationDensity: string;
    mobility: string;
    seasonality: string;
  };
  confidenceScore: number;
  mape?: number;
  rmse?: number;
  rSquared?: number;
  inputFeatures?: Record<string, any>;
  modelParameters?: Record<string, any>;
  trainingDataSize?: number;
  createdAt: string;
  expiresAt: string;
}

interface PredictionPanelProps {
  outbreakId: string;
  diseaseId: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  regionName?: string;
  onClose: () => void;
}

const PredictionPanel = memo<PredictionPanelProps>(({
  outbreakId,
  diseaseId,
  bounds,
  regionName,
  onClose
}) => {
  const [predictions, setPredictions] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedHorizon, setSelectedHorizon] = useState(7);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { measureAPICall } = usePerformance();

  // Fetch predictions
  const fetchPredictions = useCallback(async () => {
    if (!diseaseId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await measureAPICall(
        'predictions',
        () => mlService.getPredictions({
          diseaseId,
          boundsNorth: bounds.north,
          boundsSouth: bounds.south,
          boundsEast: bounds.east,
          boundsWest: bounds.west,
          horizonDays: selectedHorizon,
          regionName
        })
      );

      setPredictions(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch predictions');
    } finally {
      setLoading(false);
    }
  }, [diseaseId, bounds, selectedHorizon, regionName, measureAPICall]);

  // Auto-refresh predictions
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchPredictions, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, [autoRefresh, fetchPredictions]);

  // Initial fetch
  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  // Chart data preparation
  const chartData = predictions?.predictedCases.map((day, index) => ({
    date: new Date(day.date).toLocaleDateString(),
    predicted: day.predictedCases,
    lower: day.confidenceInterval.lower,
    upper: day.confidenceInterval.upper,
    riskLevel: day.riskLevel,
    day: index + 1
  })) || [];

  // Risk level colors
  const getRiskColor = (level: string) => {
    const colors = {
      low: '#10B981',
      medium: '#F59E0B',
      high: '#EF4444',
      critical: '#DC2626'
    };
    return colors[level as keyof typeof colors] || colors.low;
  };

  // Trend indicator
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'decreasing':
        return <TrendingDown className="w-4 h-4 text-green-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  // Confidence level indicator
  const getConfidenceLevel = (score: number) => {
    if (score >= 0.8) return { level: 'High', color: 'text-green-600', icon: CheckCircle };
    if (score >= 0.6) return { level: 'Medium', color: 'text-yellow-600', icon: AlertTriangle };
    return { level: 'Low', color: 'text-red-600', icon: AlertTriangle };
  };

  const confidenceInfo = predictions ? getConfidenceLevel(predictions.confidenceScore) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Outbreak Predictions</h2>
              <p className="text-blue-100 mt-1">
                {regionName || 'Selected Region'} • {predictions?.modelName || 'Loading...'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Generating predictions...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
                <span className="text-red-700">{error}</span>
              </div>
            </div>
          )}

          {predictions && (
            <div className="space-y-6">
              {/* Controls */}
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                <div className="flex items-center space-x-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Prediction Horizon</label>
                    <select
                      value={selectedHorizon}
                      onChange={(e) => setSelectedHorizon(Number(e.target.value))}
                      className="ml-2 border border-gray-300 rounded-md px-3 py-1 text-sm"
                    >
                      <option value={3}>3 Days</option>
                      <option value={7}>7 Days</option>
                      <option value={14}>14 Days</option>
                      <option value={30}>30 Days</option>
                    </select>
                  </div>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Auto-refresh (5min)</span>
                  </label>
                </div>

                <button
                  onClick={fetchPredictions}
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <Target className="w-8 h-8 text-blue-500 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Peak Prediction</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {Math.max(...chartData.map(d => d.predicted))}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center">
                    {confidenceInfo?.icon && <confidenceInfo.icon className={`w-8 h-8 ${confidenceInfo.color} mr-3`} />}
                    <div>
                      <p className="text-sm text-gray-600">Confidence</p>
                      <p className={`text-2xl font-bold ${confidenceInfo?.color}`}>
                        {Math.round((predictions.confidenceScore || 0) * 100)}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center">
                    {predictions.predictedSeverity && getTrendIcon(predictions.predictedSeverity.trend)}
                    <div className="ml-3">
                      <p className="text-sm text-gray-600">Trend</p>
                      <p className="text-2xl font-bold text-gray-900 capitalize">
                        {predictions.predictedSeverity?.trend || 'stable'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <Clock className="w-8 h-8 text-gray-500 mr-3" />
                    <div>
                      <p className="text-sm text-gray-600">Model Version</p>
                      <p className="text-lg font-bold text-gray-900">
                        {predictions.modelVersion}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Prediction Chart */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Predicted Case Progression</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                                <p className="font-semibold">{label}</p>
                                <p className="text-blue-600">
                                  Predicted: {data.predicted} cases
                                </p>
                                <p className="text-gray-500 text-sm">
                                  Range: {data.lower} - {data.upper}
                                </p>
                                <p className="text-sm" style={{ color: getRiskColor(data.riskLevel) }}>
                                  Risk: {data.riskLevel}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="upper"
                        stackId="1"
                        stroke="none"
                        fill="#E5E7EB"
                        fillOpacity={0.3}
                      />
                      <Area
                        type="monotone"
                        dataKey="lower"
                        stackId="1"
                        stroke="none"
                        fill="#E5E7EB"
                        fillOpacity={0.3}
                      />
                      <Line
                        type="monotone"
                        dataKey="predicted"
                        stroke="#3B82F6"
                        strokeWidth={3}
                        dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Risk Factors */}
              {predictions.riskFactors && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Factors</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 capitalize">
                        {predictions.riskFactors.populationDensity}
                      </div>
                      <div className="text-sm text-gray-600">Population Density</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 capitalize">
                        {predictions.riskFactors.mobility}
                      </div>
                      <div className="text-sm text-gray-600">Mobility</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 capitalize">
                        {predictions.riskFactors.seasonality}
                      </div>
                      <div className="text-sm text-gray-600">Seasonality</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Model Performance */}
              {(predictions.mape || predictions.rmse || predictions.rSquared) && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Model Performance</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {predictions.mape && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">
                          {predictions.mape.toFixed(1)}%
                        </div>
                        <div className="text-sm text-gray-600">MAPE</div>
                      </div>
                    )}
                    {predictions.rmse && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">
                          {predictions.rmse.toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-600">RMSE</div>
                      </div>
                    )}
                    {predictions.rSquared && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">
                          {(predictions.rSquared * 100).toFixed(1)}%
                        </div>
                        <div className="text-sm text-gray-600">R²</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
});

PredictionPanel.displayName = 'PredictionPanel';

export default PredictionPanel;
