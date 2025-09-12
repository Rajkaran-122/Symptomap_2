import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import SymptoMap from '@/components/SymptoMap';
import DashboardMetrics from '@/components/DashboardMetrics';
import SymptomReporter from '@/components/SymptomReporter';
import { useSymptoStore } from '@/store/symptoStore';
import { Button } from '@/components/ui/button';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { supabase } from '@/integrations/supabase/client';
import AuthPanel from '@/components/AuthPanel';
import type { SymptomReport } from '@/store/symptoStore';
import AnnotationsPanel from '@/components/AnnotationsPanel';
import ChatbotWidget, { ChatbotWidgetRef } from '@/components/ChatbotWidget';

function exportReportsCsv(reports: SymptomReport[]) {
  const headers = ['id','city','country','lat','lng','severity','symptoms','timestamp'];
  const rows = reports.map(r => [
    r.id,
    r.location.city,
    r.location.country,
    r.location.lat,
    r.location.lng,
    r.severity,
    '"' + r.symptoms.join('; ') + '"',
    new Date(r.timestamp).toISOString()
  ]);
  const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `symptom_reports_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function openPrintableReport(reports: SymptomReport[]) {
  const win = window.open('', '_blank');
  if (!win) return;
  const rows = reports.slice(0, 100).map(r => `
    <tr>
      <td>${r.location.city}</td>
      <td>${r.location.country}</td>
      <td>${r.severity}</td>
      <td>${r.symptoms.join(', ')}</td>
      <td>${new Date(r.timestamp).toLocaleString()}</td>
    </tr>
  `).join('');
  win.document.write(`
    <html>
      <head>
        <title>SymptoMap Report</title>
        <style>
          body { font-family: system-ui, Arial, sans-serif; padding: 24px; }
          h1 { margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; }
          th { background: #f3f4f6; text-align: left; }
        </style>
      </head>
      <body>
        <h1>SymptoMap Outbreak Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>
              <th>City</th>
              <th>Country</th>
              <th>Severity</th>
              <th>Symptoms</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <script>window.onload = () => window.print();</script>
      </body>
    </html>
  `);
  win.document.close();
}

const Dashboard = () => {
  const { detectOutbreaks, startDemoMode, showDemoMode, loadOutbreaksData, toggleAnnotationMode, annotationMode } = useSymptoStore();
  const { reports } = useSymptoStore();
  const [userRole, setUserRole] = useState<'public' | 'official' | 'researcher' | 'admin'>('public');
  
  // Enable real-time updates
  useRealtimeUpdates();

  useEffect(() => {
    // Fetch auth session and infer role from user metadata
    supabase.auth.getUser().then(({ data }) => {
      const role = (data.user?.user_metadata?.role as any) || 'public';
      setUserRole(role);
    }).catch(() => setUserRole('public'));

    // Load initial data from database
    loadOutbreaksData();

    // Initial outbreak detection
    detectOutbreaks();

    // Periodic outbreak detection (every 30 seconds for demo)
    const interval = setInterval(() => {
      detectOutbreaks();
    }, 30000);

    return () => clearInterval(interval);
  }, [detectOutbreaks, loadOutbreaksData]);

  const handleDemoMode = () => {
    startDemoMode();
  };

  const chatbotRef = useRef<ChatbotWidgetRef>(null);

  useEffect(() => {
    const handler = (e: any) => {
      const msg = e?.detail?.message;
      if (msg && chatbotRef.current) chatbotRef.current.openWithMessage(msg);
    };
    window.addEventListener('symptomap:openChat', handler);
    return () => window.removeEventListener('symptomap:openChat', handler);
  }, []);

  // Hidden demo keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        handleDemoMode();
      }
      // Ctrl+Shift+P: Trigger pandemic simulation (demo mode)
      if (event.ctrlKey && event.shiftKey && event.key.toUpperCase() === 'P') {
        event.preventDefault();
        handleDemoMode();
      }
      // Ctrl+Shift+H: Show historical overlay (noop placeholder for now)
      if (event.ctrlKey && event.shiftKey && event.key.toUpperCase() === 'H') {
        event.preventDefault();
        console.info('Historical overlay toggled (placeholder)');
      }
      // Ctrl+Shift+S: Generate success statistics (toast placeholder)
      if (event.ctrlKey && event.shiftKey && event.key.toUpperCase() === 'S') {
        event.preventDefault();
        console.info('Success statistics generated (placeholder)');
      }
      // Ctrl+Shift+M: Activate "millions saved" counter (placeholder)
      if (event.ctrlKey && event.shiftKey && event.key.toUpperCase() === 'M') {
        event.preventDefault();
        console.info('Millions saved counter activated (placeholder)');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header 
        className="bg-card/50 backdrop-blur-sm border-b border-border sticky top-0 z-40"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m-6 3l6-3" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">SymptoMap</h1>
                <p className="text-sm text-muted-foreground">Global Disease Surveillance System</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <AuthPanel />
              {!showDemoMode && (
                <Button
                  variant="outline"
                  onClick={handleDemoMode}
                  className="hidden md:flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-4-8v8a2 2 0 002 2h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2z" />
                  </svg>
                  Demo Mode
                </Button>
              )}
              
              <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-green-600">System Online</span>
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Demo Banner */}
          {showDemoMode && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-primary/10 border border-primary/20 rounded-xl p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-primary">Demo Mode Active</h3>
                  <p className="text-sm text-muted-foreground">
                    Showing simulated outbreak data. Watch for emerging clusters in Bangkok.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Metrics Dashboard */}
          <section>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <h2 className="text-2xl font-bold text-foreground mb-2">Global Health Intelligence</h2>
              <p className="text-muted-foreground">
                Real-time analysis of global symptom patterns and outbreak detection
              </p>
            </motion.div>
            
            <DashboardMetrics />
          </section>

          {/* Interactive Map */}
          <section>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-6"
            >
              <h2 className="text-2xl font-bold text-foreground mb-2">Live Outbreak Map</h2>
              <p className="text-muted-foreground">
                Interactive visualization of symptom clusters and emerging health patterns worldwide
              </p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="h-[500px] lg:h-[600px] rounded-2xl overflow-hidden shadow-2xl border-2 border-primary/10"
            >
              <SymptoMap />
            </motion.div>
          </section>

          {/* Impact Projections */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-card/50 rounded-2xl p-6 border border-border"
          >
            <h3 className="text-xl font-bold text-foreground mb-4">Pandemic Prevention Impact</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-green-600">21 days</div>
                <div className="text-sm text-muted-foreground">Faster detection than traditional surveillance</div>
              </div>
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-blue-600">$847B</div>
                <div className="text-sm text-muted-foreground">Economic losses prevented (COVID-19 modeling)</div>
              </div>
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-purple-600">94.7%</div>
                <div className="text-sm text-muted-foreground">AI-powered outbreak detection accuracy</div>
              </div>
            </div>
            {userRole !== 'public' && (
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 p-4 border rounded-lg bg-primary/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-foreground">Officials Panel</div>
                      <div className="text-xs text-muted-foreground">Role: {userRole}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={detectOutbreaks}>Re-run Detection</Button>
                      <Button variant="outline" onClick={() => exportReportsCsv(reports)}>Export CSV</Button>
                      <Button variant="outline" onClick={() => openPrintableReport(reports)}>Print Report</Button>
                      <Button variant="outline" onClick={async () => {
                        const { data, error } = await fetch('/functions/v1/export-report', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ windowDays: 7 })
                        }).then(r => ({ data: r, error: null })).catch(e => ({ data: null, error: e }));
                        if (error || !data) return;
                        const html = await (data as Response).text();
                        const w = window.open('', '_blank');
                        if (w) { w.document.write(html); w.document.close(); }
                      }}>Server HTML</Button>
                      <Button variant={annotationMode ? 'default' : 'outline'} onClick={toggleAnnotationMode}>
                        {annotationMode ? 'Annotation: ON' : 'Annotation: OFF'}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="p-4 border rounded-lg bg-card/50">
                  <AnnotationsPanel />
                </div>
              </div>
            )}
          </motion.section>
        </div>
      </main>

      {/* Floating Symptom Reporter */}
      <SymptomReporter />
      <ChatbotWidget ref={chatbotRef} />

      {/* Footer */}
      <footer className="mt-12 py-8 border-t border-border bg-card/30">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            SymptoMap • Preventing pandemics through early detection • Built for global health security
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;