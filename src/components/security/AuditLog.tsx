import React, { memo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  User, 
  Clock, 
  MapPin, 
  Eye, 
  Edit, 
  Trash2, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Download
} from 'lucide-react';

interface AuditEvent {
  id: string;
  eventType: string;
  eventCategory: string;
  eventAction: string;
  userId: string;
  userName: string;
  ipAddress: string;
  userAgent: string;
  resourceType: string;
  resourceId: string;
  requestMethod?: string;
  requestUrl?: string;
  requestHeaders?: Record<string, any>;
  requestBody?: any;
  responseStatus?: number;
  responseTimeMs?: number;
  outcome: 'success' | 'failure';
  errorMessage?: string;
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  timestamp: string;
  details?: Record<string, any>;
}

interface AuditLogProps {
  userId?: string;
  resourceType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  realTime?: boolean;
}

const AuditLog = memo<AuditLogProps>(({
  userId,
  resourceType,
  startDate,
  endDate,
  limit = 100,
  realTime = true
}) => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedOutcome, setSelectedOutcome] = useState<string>('all');
  const [selectedClassification, setSelectedClassification] = useState<string>('all');
  const [showDetails, setShowDetails] = useState<string | null>(null);

  // Mock data generator for development
  const generateMockEvents = useCallback((): AuditEvent[] => {
    const eventTypes = [
      'USER_LOGIN', 'USER_LOGOUT', 'DATA_ACCESS', 'DATA_MODIFY', 'DATA_DELETE',
      'USER_CREATE', 'USER_UPDATE', 'OUTBREAK_CREATE', 'OUTBREAK_UPDATE',
      'PREDICTION_REQUEST', 'EXPORT_CREATE', 'ANNOTATION_CREATE', 'ANNOTATION_UPDATE'
    ];
    
    const categories = ['authentication', 'data_access', 'data_modification', 'user_management', 'system'];
    const actions = ['read', 'write', 'delete', 'create', 'update', 'login', 'logout'];
    const outcomes = ['success', 'failure'];
    const classifications = ['public', 'internal', 'confidential', 'restricted'];
    const users = ['admin@example.com', 'analyst@example.com', 'viewer@example.com'];
    const resources = ['outbreak_reports', 'users', 'predictions', 'map_annotations'];

    return Array.from({ length: 50 }, (_, i) => {
      const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const category = categories[Math.floor(Math.random() * categories.length)];
      const action = actions[Math.floor(Math.random() * actions.length)];
      const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
      const classification = classifications[Math.floor(Math.random() * classifications.length)];
      const user = users[Math.floor(Math.random() * users.length)];
      const resource = resources[Math.floor(Math.random() * resources.length)];

      return {
        id: `audit_${i}`,
        eventType,
        eventCategory: category,
        eventAction: action,
        userId: `user_${Math.floor(Math.random() * 1000)}`,
        userName: user,
        ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        resourceType: resource,
        resourceId: `resource_${Math.floor(Math.random() * 1000)}`,
        requestMethod: ['GET', 'POST', 'PUT', 'DELETE'][Math.floor(Math.random() * 4)],
        requestUrl: `/api/v1/${resource}`,
        responseStatus: outcome === 'success' ? 200 : [400, 401, 403, 404, 500][Math.floor(Math.random() * 5)],
        responseTimeMs: Math.floor(Math.random() * 1000) + 50,
        outcome: outcome as 'success' | 'failure',
        errorMessage: outcome === 'failure' ? 'Access denied' : undefined,
        dataClassification: classification as 'public' | 'internal' | 'confidential' | 'restricted',
        timestamp: timestamp.toISOString(),
        details: {
          browser: 'Chrome',
          os: 'Windows 10',
          location: 'New York, US'
        }
      };
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, []);

  // Fetch audit events
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // In production, this would call the actual API
      const mockEvents = generateMockEvents();
      setEvents(mockEvents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit events');
    } finally {
      setLoading(false);
    }
  }, [generateMockEvents]);

  // Auto-refresh
  useEffect(() => {
    if (!realTime) return;

    fetchEvents();
    const interval = setInterval(fetchEvents, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [realTime, fetchEvents]);

  // Filter events
  const filteredEvents = events.filter(event => {
    if (searchTerm && !event.eventType.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !event.userName.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !event.resourceType.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (selectedCategory !== 'all' && event.eventCategory !== selectedCategory) return false;
    if (selectedOutcome !== 'all' && event.outcome !== selectedOutcome) return false;
    if (selectedClassification !== 'all' && event.dataClassification !== selectedClassification) return false;
    return true;
  });

  // Get event icon
  const getEventIcon = (eventType: string) => {
    if (eventType.includes('LOGIN') || eventType.includes('LOGOUT')) return User;
    if (eventType.includes('DATA')) return Eye;
    if (eventType.includes('CREATE')) return Edit;
    if (eventType.includes('DELETE')) return Trash2;
    return Shield;
  };

  // Get outcome color
  const getOutcomeColor = (outcome: string) => {
    return outcome === 'success' 
      ? 'text-green-600 bg-green-100' 
      : 'text-red-600 bg-red-100';
  };

  // Get classification color
  const getClassificationColor = (classification: string) => {
    const colors = {
      public: 'text-gray-600 bg-gray-100',
      internal: 'text-blue-600 bg-blue-100',
      confidential: 'text-orange-600 bg-orange-100',
      restricted: 'text-red-600 bg-red-100'
    };
    return colors[classification as keyof typeof colors] || colors.public;
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  // Export to CSV
  const exportToCSV = useCallback(() => {
    const csvContent = [
      ['Timestamp', 'Event Type', 'User', 'Action', 'Resource', 'Outcome', 'IP Address', 'Response Time'],
      ...filteredEvents.map(event => [
        new Date(event.timestamp).toLocaleString(),
        event.eventType,
        event.userName,
        event.eventAction,
        event.resourceType,
        event.outcome,
        event.ipAddress,
        event.responseTimeMs || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, [filteredEvents]);

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Audit Log</h3>
            {loading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={exportToCSV}
              className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            <button
              onClick={fetchEvents}
              disabled={loading}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="all">All Categories</option>
            <option value="authentication">Authentication</option>
            <option value="data_access">Data Access</option>
            <option value="data_modification">Data Modification</option>
            <option value="user_management">User Management</option>
            <option value="system">System</option>
          </select>

          <select
            value={selectedOutcome}
            onChange={(e) => setSelectedOutcome(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="all">All Outcomes</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>

          <select
            value={selectedClassification}
            onChange={(e) => setSelectedClassification(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="all">All Classifications</option>
            <option value="public">Public</option>
            <option value="internal">Internal</option>
            <option value="confidential">Confidential</option>
            <option value="restricted">Restricted</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <AnimatePresence>
            {filteredEvents.map((event) => {
              const EventIcon = getEventIcon(event.eventType);
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <EventIcon className="w-5 h-5 text-gray-600" />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium text-gray-900">{event.eventType}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getOutcomeColor(event.outcome)}`}>
                            {event.outcome.toUpperCase()}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getClassificationColor(event.dataClassification)}`}>
                            {event.dataClassification.toUpperCase()}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-2">
                          {event.userName} • {event.eventAction} • {event.resourceType}
                        </p>
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatTimestamp(event.timestamp)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-3 h-3" />
                            <span>{event.ipAddress}</span>
                          </div>
                          {event.responseTimeMs && (
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>{event.responseTimeMs}ms</span>
                            </div>
                          )}
                        </div>

                        {event.errorMessage && (
                          <div className="mt-2 text-sm text-red-600">
                            Error: {event.errorMessage}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setShowDetails(showDetails === event.id ? null : event.id)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {showDetails === event.id ? 'Hide' : 'Details'}
                    </button>
                  </div>

                  {/* Details Panel */}
                  <AnimatePresence>
                    {showDetails === event.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 pt-4 border-t border-gray-100"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">Request Details</h4>
                            <div className="space-y-1">
                              <div><span className="text-gray-600">Method:</span> {event.requestMethod}</div>
                              <div><span className="text-gray-600">URL:</span> {event.requestUrl}</div>
                              <div><span className="text-gray-600">Status:</span> {event.responseStatus}</div>
                              <div><span className="text-gray-600">User Agent:</span> {event.userAgent}</div>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">Additional Info</h4>
                            <div className="space-y-1">
                              <div><span className="text-gray-600">Resource ID:</span> {event.resourceId}</div>
                              <div><span className="text-gray-600">Category:</span> {event.eventCategory}</div>
                              <div><span className="text-gray-600">Classification:</span> {event.dataClassification}</div>
                              {event.details && (
                                <div><span className="text-gray-600">Location:</span> {event.details.location}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {filteredEvents.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No audit events found matching your criteria</p>
          </div>
        )}
      </div>
    </div>
  );
});

AuditLog.displayName = 'AuditLog';

export default AuditLog;
