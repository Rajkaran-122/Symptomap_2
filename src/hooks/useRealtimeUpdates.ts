import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSymptoStore } from '@/store/symptoStore';

export const useRealtimeUpdates = () => {
  const { loadOutbreaksData } = useSymptoStore();

  useEffect(() => {
    console.log('Setting up real-time subscriptions...');

    // Subscribe to new symptom reports
    const reportsChannel = supabase
      .channel('symptom_reports_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'symptom_reports'
        },
        (payload) => {
          console.log('New symptom report received:', payload);
          // Refresh data when new reports come in
          loadOutbreaksData();
        }
      )
      .subscribe();

    // Subscribe to outbreak cluster changes
    const clustersChannel = supabase
      .channel('outbreak_clusters_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'outbreak_clusters'
        },
        (payload) => {
          console.log('Outbreak cluster updated:', payload);
          // Refresh data when clusters change
          loadOutbreaksData();
        }
      )
      .subscribe();

    // Subscribe to health alerts
    const alertsChannel = supabase
      .channel('health_alerts_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'health_alerts'
        },
        (payload) => {
          console.log('New health alert:', payload);
          // Could show toast notification for new alerts
          loadOutbreaksData();
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      console.log('Cleaning up real-time subscriptions...');
      supabase.removeChannel(reportsChannel);
      supabase.removeChannel(clustersChannel);
      supabase.removeChannel(alertsChannel);
    };
  }, [loadOutbreaksData]);
};

export default useRealtimeUpdates;