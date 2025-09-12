import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClusterData {
  id: string;
  centerLat: number;
  centerLng: number;
  radius: number;
  reportCount: number;
  dominantSymptoms: string[];
  severity: 'normal' | 'unusual' | 'concerning' | 'critical';
  riskScore: number;
  growthRate: number;
  locationName: string;
  reports: any[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting outbreak detection analysis...');

    // Get recent reports (last 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data: recentReports, error: reportsError } = await supabase
      .from('symptom_reports')
      .select('*')
      .gte('created_at', fourteenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (reportsError) {
      throw new Error(`Failed to fetch reports: ${reportsError.message}`);
    }

    console.log(`Analyzing ${recentReports?.length || 0} recent reports...`);

    if (!recentReports || recentReports.length < 3) {
      console.log('Insufficient reports for outbreak detection');
      return new Response(JSON.stringify({ 
        message: 'Insufficient reports for outbreak detection',
        clustersFound: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Simple spatial clustering algorithm
    const clusters: ClusterData[] = [];
    const processedReports = new Set<string>();
    const clusterRadius = 0.5; // degrees (~55km)

    for (const report of recentReports) {
      if (processedReports.has(report.id)) continue;

      // Find nearby reports
      const nearbyReports = recentReports.filter(otherReport => {
        if (processedReports.has(otherReport.id) || otherReport.id === report.id) {
          return false;
        }

        const distance = calculateDistance(
          report.location_lat,
          report.location_lng,
          otherReport.location_lat,
          otherReport.location_lng
        );

        return distance <= clusterRadius;
      });

      // Include the original report
      const clusterReports = [report, ...nearbyReports];

      // Only create cluster if we have 3+ reports
      if (clusterReports.length >= 3) {
        // Mark all reports as processed
        clusterReports.forEach(r => processedReports.add(r.id));

        // Calculate cluster properties
        const avgLat = clusterReports.reduce((sum, r) => sum + parseFloat(r.location_lat), 0) / clusterReports.length;
        const avgLng = clusterReports.reduce((sum, r) => sum + parseFloat(r.location_lng), 0) / clusterReports.length;
        const avgSeverity = clusterReports.reduce((sum, r) => sum + r.severity, 0) / clusterReports.length;

        // Calculate risk score based on multiple factors
        const severityFactor = avgSeverity / 10;
        const densityFactor = Math.log(clusterReports.length) / Math.log(10);
        const recentnessFactor = calculateRecentnessFactor(clusterReports);
        const riskScore = Math.min(100, (severityFactor * 40 + densityFactor * 35 + recentnessFactor * 25));

        // Determine severity level
        let severity: 'normal' | 'unusual' | 'concerning' | 'critical' = 'normal';
        if (riskScore > 80) severity = 'critical';
        else if (riskScore > 65) severity = 'concerning';
        else if (riskScore > 45) severity = 'unusual';

        // Extract dominant symptoms
        const symptomCounts = new Map<string, number>();
        clusterReports.forEach(r => {
          r.symptoms.forEach((symptom: string) => {
            symptomCounts.set(symptom, (symptomCounts.get(symptom) || 0) + 1);
          });
        });

        const dominantSymptoms = Array.from(symptomCounts.entries())
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([symptom,]) => symptom);

        // Calculate growth rate (reports per day)
        const oldestReport = Math.min(...clusterReports.map(r => new Date(r.created_at).getTime()));
        const daysSinceFirst = (Date.now() - oldestReport) / (1000 * 60 * 60 * 24);
        const growthRate = clusterReports.length / Math.max(1, daysSinceFirst);

        const cluster: ClusterData = {
          id: `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          centerLat: avgLat,
          centerLng: avgLng,
          radius: Math.max(0.1, Math.sqrt(clusterReports.length) * 0.2),
          reportCount: clusterReports.length,
          dominantSymptoms,
          severity,
          riskScore: Math.round(riskScore * 100) / 100,
          growthRate: Math.round(growthRate * 100) / 100,
          locationName: report.location_city,
          reports: clusterReports
        };

        clusters.push(cluster);
      }
    }

    console.log(`Detected ${clusters.length} potential outbreak clusters`);

    // Clear existing active clusters and insert new ones
    await supabase
      .from('outbreak_clusters')
      .update({ is_active: false })
      .eq('is_active', true);

    if (clusters.length > 0) {
      const { error: insertError } = await supabase
        .from('outbreak_clusters')
        .insert(
          clusters.map(cluster => ({
            center_lat: cluster.centerLat,
            center_lng: cluster.centerLng,
            radius: cluster.radius,
            report_count: cluster.reportCount,
            dominant_symptoms: cluster.dominantSymptoms,
            severity: cluster.severity,
            risk_score: cluster.riskScore,
            growth_rate: cluster.growthRate,
            location_name: cluster.locationName,
            is_active: true
          }))
        );

      if (insertError) {
        console.error('Failed to insert clusters:', insertError);
        throw new Error(`Failed to save clusters: ${insertError.message}`);
      }

      // Generate health alerts for critical clusters
      const criticalClusters = clusters.filter(c => c.severity === 'critical' || c.riskScore > 75);
      
      if (criticalClusters.length > 0) {
        const alerts = criticalClusters.map(cluster => ({
          alert_level: cluster.severity === 'critical' ? 'critical' : 'high',
          title: `Potential Disease Cluster Detected in ${cluster.locationName}`,
          description: `AI surveillance has detected ${cluster.reportCount} similar symptom reports in ${cluster.locationName}. Dominant symptoms: ${cluster.dominantSymptoms.join(', ')}. Risk Score: ${cluster.riskScore}/100.`,
          affected_regions: [cluster.locationName],
          estimated_impact: `${cluster.reportCount} reported cases, growth rate: ${cluster.growthRate} cases/day`,
          recommended_actions: [
            'Deploy field investigation team',
            'Increase local surveillance',
            'Prepare containment measures',
            'Alert regional health authorities'
          ]
        }));

        await supabase
          .from('health_alerts')
          .insert(alerts);

        console.log(`Generated ${alerts.length} health alerts for critical clusters`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      clustersFound: clusters.length,
      criticalClusters: clusters.filter(c => c.severity === 'critical').length,
      concerningClusters: clusters.filter(c => c.severity === 'concerning').length,
      clusters: clusters.map(c => ({
        id: c.id,
        location: c.locationName,
        reportCount: c.reportCount,
        riskScore: c.riskScore,
        severity: c.severity,
        dominantSymptoms: c.dominantSymptoms
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in detect-outbreaks function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper functions
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c / 111; // Convert to approximate degrees
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function calculateRecentnessFactor(reports: any[]): number {
  const now = Date.now();
  const avgAge = reports.reduce((sum, report) => {
    const age = (now - new Date(report.created_at).getTime()) / (1000 * 60 * 60 * 24); // days
    return sum + age;
  }, 0) / reports.length;
  
  // More recent reports get higher score (max 1.0 for reports within 1 day)
  return Math.max(0, Math.min(1, 1 - (avgAge / 14)));
}