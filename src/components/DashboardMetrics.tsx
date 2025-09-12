import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSymptoStore } from '@/store/symptoStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  icon: React.ReactNode;
  color?: 'primary' | 'success' | 'warning' | 'danger';
  delay?: number;
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  subtitle, 
  trend, 
  trendValue, 
  icon, 
  color = 'primary',
  delay = 0 
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const targetValue = typeof value === 'number' ? value : parseInt(value.toString().replace(/[^\d]/g, ''));

  useEffect(() => {
    const timer = setTimeout(() => {
      const increment = targetValue / 50;
      let current = 0;
      const interval = setInterval(() => {
        current += increment;
        if (current >= targetValue) {
          current = targetValue;
          clearInterval(interval);
        }
        setDisplayValue(Math.floor(current));
      }, 20);
      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(timer);
  }, [targetValue, delay]);

  const getColorClasses = () => {
    switch (color) {
      case 'success':
        return 'border-green-500/20 bg-green-500/5';
      case 'warning':
        return 'border-yellow-500/20 bg-yellow-500/5';
      case 'danger':
        return 'border-red-500/20 bg-red-500/5';
      default:
        return 'border-primary/20 bg-primary/5';
    }
  };

  const getTrendIcon = () => {
    if (trend === 'up') return <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>;
    if (trend === 'down') return <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>;
    return <svg className="w-3 h-3 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.5 }}
    >
      <Card className={`${getColorClasses()} border-2 hover:shadow-lg transition-all duration-300`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <div className="text-primary">
            {icon}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-foreground">
              {typeof value === 'number' ? displayValue.toLocaleString() : value}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground">
                {subtitle}
              </p>
            )}
            {trend && trendValue && (
              <div className="flex items-center gap-1 text-xs">
                {getTrendIcon()}
                <span className={`font-medium ${
                  trend === 'up' ? 'text-green-600' : 
                  trend === 'down' ? 'text-red-600' : 
                  'text-muted-foreground'
                }`}>
                  {trendValue}
                </span>
                <span className="text-muted-foreground">vs last week</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const DashboardMetrics = () => {
  const { reports, outbreakClusters, globalMetrics } = useSymptoStore();

  const criticalClusters = outbreakClusters.filter(c => c.severity === 'critical').length;
  const concerningClusters = outbreakClusters.filter(c => c.severity === 'concerning').length;
  const recentReports = reports.filter(r => Date.now() - r.timestamp < 24 * 60 * 60 * 1000).length;

  const metrics = [
    {
      title: "Total Reports Analyzed",
      value: globalMetrics.totalReports,
      subtitle: "Global symptom submissions",
      trend: 'up' as const,
      trendValue: "+12.3%",
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
      delay: 0
    },
    {
      title: "Active Outbreak Clusters",
      value: outbreakClusters.length,
      subtitle: "Detected patterns requiring monitoring",
      trend: 'up' as const,
      trendValue: "+3",
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /></svg>,
      color: 'warning' as const,
      delay: 200
    },
    {
      title: "Critical Risk Zones",
      value: criticalClusters,
      subtitle: "Immediate attention required",
      trend: criticalClusters > 0 ? 'up' as const : 'stable' as const,
      trendValue: criticalClusters > 0 ? `+${criticalClusters}` : "Stable",
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>,
      color: 'danger' as const,
      delay: 400
    },
    {
      title: "Reports Today",
      value: recentReports,
      subtitle: "Last 24 hours",
      trend: 'up' as const,
      trendValue: "+18",
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      delay: 600
    },
    {
      title: "Average Detection Speed",
      value: `${globalMetrics.detectionSpeedDays} days`,
      subtitle: "Faster than traditional surveillance",
      trend: 'down' as const,
      trendValue: "-2.1 days",
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
      color: 'success' as const,
      delay: 800
    },
    {
      title: "Lives Projected Saved",
      value: "2.3M",
      subtitle: "Based on early detection modeling",
      trend: 'up' as const,
      trendValue: "+15%",
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
      color: 'success' as const,
      delay: 1000
    }
  ];

  return (
    <div className="space-y-6">
      {/* Hero Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric, index) => (
          <MetricCard
            key={metric.title}
            {...metric}
          />
        ))}
      </div>

      {/* Real-time Activity Feed */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.5 }}
      >
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Live Activity Feed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-32 overflow-y-auto">
              {reports.slice(0, 5).map((report, index) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.4 + index * 0.1 }}
                  className="flex items-center gap-3 text-sm border-l-2 border-primary/30 pl-3 py-1"
                >
                  <div className="text-muted-foreground">
                    {new Date(report.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="flex-1">
                    New report from <span className="font-medium">{report.location.city}</span>: 
                    <span className="text-primary ml-1">{report.symptoms.slice(0, 2).join(', ')}</span>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    report.severity >= 8 ? 'bg-red-500/20 text-red-600' :
                    report.severity >= 6 ? 'bg-orange-500/20 text-orange-600' :
                    report.severity >= 4 ? 'bg-yellow-500/20 text-yellow-600' :
                    'bg-green-500/20 text-green-600'
                  }`}>
                    {report.severity}/10
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default DashboardMetrics;