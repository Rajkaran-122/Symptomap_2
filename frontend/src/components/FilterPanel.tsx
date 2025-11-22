import React from 'react';
import { Filter, X } from 'lucide-react';
import { FilterState, DiseaseType } from '@/types';
import { useMapStore } from '@/store/useMapStore';

const DISEASE_TYPES: DiseaseType[] = [
  'covid-19',
  'influenza', 
  'measles',
  'tuberculosis',
  'malaria',
  'other'
];

const SEVERITY_LEVELS = [
  { value: 1, label: 'Low', color: '#10b981' },
  { value: 2, label: 'Medium-Low', color: '#84cc16' },
  { value: 3, label: 'Medium', color: '#f59e0b' },
  { value: 4, label: 'High', color: '#ef4444' },
  { value: 5, label: 'Critical', color: '#dc2626' },
];

export const FilterPanel: React.FC = () => {
  const { filters, updateFilters } = useMapStore();

  const handleDiseaseTypeChange = (diseaseType: DiseaseType, checked: boolean) => {
    const newDiseaseTypes = checked
      ? [...filters.diseaseTypes, diseaseType]
      : filters.diseaseTypes.filter(type => type !== diseaseType);
    
    updateFilters({ diseaseTypes: newDiseaseTypes });
  };

  const handleSeverityLevelChange = (severityLevel: number, checked: boolean) => {
    const newSeverityLevels = checked
      ? [...filters.severityLevels, severityLevel]
      : filters.severityLevels.filter(level => level !== severityLevel);
    
    updateFilters({ severityLevels: newSeverityLevels });
  };

  const clearAllFilters = () => {
    updateFilters({
      diseaseTypes: [],
      severityLevels: [],
    });
  };

  const hasActiveFilters = filters.diseaseTypes.length > 0 || filters.severityLevels.length > 0;

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        </div>
        
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {/* Disease Type Filters */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Disease Types</h4>
        <div className="space-y-2">
          {DISEASE_TYPES.map(diseaseType => (
            <label key={diseaseType} className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.diseaseTypes.includes(diseaseType)}
                onChange={(e) => handleDiseaseTypeChange(diseaseType, e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 capitalize">
                {diseaseType.replace('-', ' ')}
              </span>
              <span className="text-xs text-gray-500">
                ({filters.diseaseTypes.includes(diseaseType) ? 'Active' : 'All'})
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Severity Level Filters */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Severity Levels</h4>
        <div className="space-y-2">
          {SEVERITY_LEVELS.map(level => (
            <label key={level.value} className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.severityLevels.includes(level.value)}
                onChange={(e) => handleSeverityLevelChange(level.value, e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div 
                className="w-3 h-3 rounded-full border border-white shadow-sm"
                style={{ backgroundColor: level.color }}
              />
              <span className="text-sm text-gray-700">
                {level.label} ({level.value})
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Active Filters</h4>
          <div className="space-y-1">
            {filters.diseaseTypes.length > 0 && (
              <div className="text-xs text-gray-600">
                Disease Types: {filters.diseaseTypes.map(type => 
                  type.replace('-', ' ')
                ).join(', ')}
              </div>
            )}
            {filters.severityLevels.length > 0 && (
              <div className="text-xs text-gray-600">
                Severity Levels: {filters.severityLevels.join(', ')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Filter Presets */}
      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Filters</h4>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => updateFilters({ 
              diseaseTypes: ['covid-19'], 
              severityLevels: [4, 5] 
            })}
            className="px-3 py-2 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
          >
            High Risk COVID
          </button>
          <button
            onClick={() => updateFilters({ 
              diseaseTypes: ['influenza'], 
              severityLevels: [3, 4, 5] 
            })}
            className="px-3 py-2 text-xs bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors"
          >
            Flu Outbreaks
          </button>
          <button
            onClick={() => updateFilters({ 
              diseaseTypes: [], 
              severityLevels: [5] 
            })}
            className="px-3 py-2 text-xs bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
          >
            Critical Only
          </button>
          <button
            onClick={() => updateFilters({ 
              diseaseTypes: [], 
              severityLevels: [1, 2, 3] 
            })}
            className="px-3 py-2 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
          >
            Low-Medium Risk
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;

