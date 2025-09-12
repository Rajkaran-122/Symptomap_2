import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { windowDays = 7 } = await req.json().catch(() => ({ windowDays: 7 }));

    const since = new Date();
    since.setDate(since.getDate() - Math.max(1, Math.min(30, windowDays)));

    const { data: reports } = await supabase
      .from('symptom_reports')
      .select('*')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(1000);

    const rows = (reports || []).slice(0, 500).map((r: any) => `
      <tr>
        <td>${r.location_city}</td>
        <td>${r.location_country}</td>
        <td>${r.severity}</td>
        <td>${(r.symptoms || []).join(', ')}</td>
        <td>${new Date(r.created_at).toLocaleString()}</td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>SymptoMap Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { margin: 0 0 4px 0; }
            p { margin: 0 0 16px 0; color: #374151; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; }
            th { background: #f3f4f6; text-align: left; }
          </style>
        </head>
        <body>
          <h1>SymptoMap Outbreak Report</h1>
          <p>Generated: ${new Date().toLocaleString()}</p>
          <p>Window: last ${windowDays} days</p>
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
        </body>
      </html>`;

    return new Response(html, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('Error in export-report function:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});


