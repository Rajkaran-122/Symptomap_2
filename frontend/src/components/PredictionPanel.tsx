import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { MLPrediction, GeographicBounds, RISK_COLORS } from '@/types';
import { useMapStore } from '@/store/useMapStore';
import { SymptoMapAPI } from '@/services/api';

export const PredictionPanel: React.FC = () => {
  const { predictions, filters, setPredictions, setLoading, setError } = useMapStore();
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState<MLPrediction | null>(null);

  // Load predictions when filters change
  useEffect(() => {
    const loadPredictions = async () => {
      if (!filters.bounds) return;

      setIsLoadingPredictions(true);
      try {
        const newPredictions = await SymptoMapAPI.getPredictions(filters.bounds);
        setPredictions(newPredictions);
        
        if (newPredictions.length > 0) {
          setSelectedPrediction(newPredictions[0]);
        }
      } catch (error) {
        console.error('Failed to load predictions:', error);
        setError('Failed to load predictions');
      } finally {
        setIsLoadingPredictions(false);
      }
    };

    loadPredictions();
  }, [filters.bounds, setPredictions, setError]);

  // Format data for charts
  const formatChartData = (prediction: MLPrediction) => {
    return prediction.predictions.map(point => ({
      date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      predictedCases: point.predictedCases,
      confidenceLower: point.confidenceInterval.lower,
      confidenceUpper: point.confidenceInterval.upper,
      riskLevel: point.riskLevel,
    }));
  };

  // Calculate risk summary
  const getRiskSummary = (prediction: MLPrediction) => {
    const highRiskDays = prediction.predictions.filter(p => p.riskLevel === 'high' || p.riskLevel === 'critical').length;
    const totalDays = prediction.predictions.length;
    const riskPercentage = (highRiskDays / totalDays) * 100;

    if (riskPercentage > 50) {
      return { level: 'high', color: 'text-red-600', icon: AlertTriangle };
    } else if (riskPercentage > 25) {
      return { level: 'medium', color: 'text-yellow-600', icon: TrendingUp };
    } else {
      return { level: 'low', color: 'text-green-600', icon: CheckCircle };
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoadingPredictions) {
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">Loading predictions...</span>
        </div>
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-lg p-6 shadow-lg">
        <div className="text-center">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Predictions Available</h3>
          <p className="text-gray-600">
            Predictions will appear here when you zoom into a specific region.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-lg p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">7-Day Outbreak Predictions</h3>
        <div className="flex space-x-2">
          {predictions.map((prediction, index) => (
            <button
              key={prediction.id}
              onClick={() => setSelectedPrediction(prediction)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                selectedPrediction?.id === prediction.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Region {index + 1}
            </button>
          ))}
        </div>
      </div>

      {selectedPrediction && (
        <>
          {/* Prediction Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {selectedPrediction.predictions.reduce((sum, p) => sum + p.predictedCases, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Predicted Cases</div>
            </div>
            
            <div className="text-center">
              <div className={`text-2xl font-bold ${getConfidenceColor(selectedPrediction.confidenceScore)}`}>
                {Math.round(selectedPrediction.confidenceScore * 100)}%
              </div>
              <div className="text-sm text-gray-600">Confidence Score</div>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1">
                {(() => {
                  const riskSummary = getRiskSummary(selectedPrediction);
                  const Icon = riskSummary.icon;
                  return (
                    <>
                      <Icon className={`w-6 h-6 ${riskSummary.color}`} />
                      <span className={`text-lg font-semibold ${riskSummary.color}`}>
                        {riskSummary.level.toUpperCase()}
                      </span>
                    </>
                  );
                })()}
              </div>
              <div className="text-sm text-gray-600">Risk Level</div>
            </div>
          </div>

          {/* Prediction Chart */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-3">Case Prediction Trend</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formatChartData(selectedPrediction)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#666"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="#666"
                    fontSize={12}
                    label={{ value: 'Cases', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                    formatter={(value: number, name: string) => [
                      value,
                      name === 'predictedCases' ? 'Predicted Cases' : 
                      name === 'confidenceLower' ? 'Lower Bound' : 'Upper Bound'
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="confidenceUpper"
                    stackId="1"
                    stroke="none"
                    fill="#e5e7eb"
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey="confidenceLower"
                    stackId="1"
                    stroke="none"
                    fill="white"
                  />
                  <Line
                    type="monotone"
                    dataKey="predictedCases"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Daily Risk Breakdown */}
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">Daily Risk Assessment</h4>
            <div className="space-y-2">
              {selectedPrediction.predictions.map((point, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="text-sm font-medium text-gray-900">
                      {new Date(point.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                    <div className="text-sm text-gray-600">
                      {point.predictedCases} cases
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: RISK_COLORS[point.riskLevel] }}
                    />
                    <span className="text-sm font-medium capitalize text-gray-700">
                      {point.riskLevel} risk
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Model Information */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Model: {selectedPrediction.modelVersion}</span>
              <span>Generated: {new Date(selectedPrediction.generatedAt).toLocaleString()}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PredictionPanel;

