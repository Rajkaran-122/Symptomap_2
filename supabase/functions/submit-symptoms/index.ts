import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SymptomSubmission {
  location: {
    lat: number;
    lng: number;
    city: string;
    country: string;
  };
  symptoms: string[];
  description: string;
  severity: number;
  ageRange?: string;
  hasRecentTravel?: boolean;
  demographicInfo?: { ageRange?: string; hasRecentTravel?: boolean };
  aiAnalysis?: {
    medicalTerms: string[];
    icd10Codes: string[];
    clusterProbability: number;
    riskScore: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const submission: SymptomSubmission = await req.json();

    // Validate required fields
    if (!submission.location || !submission.description || typeof submission.severity !== 'number') {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: location, description, severity' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate location data
    const { lat, lng, city, country } = submission.location;
    if (typeof lat !== 'number' || typeof lng !== 'number' || !city || !country) {
      return new Response(JSON.stringify({ 
        error: 'Invalid location data' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clamp severity range
    if (submission.severity < 1 || submission.severity > 10) {
      return new Response(JSON.stringify({ 
        error: 'Severity must be between 1 and 10' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sanitize fields
    const description = submission.description.toString().slice(0, 2000).trim();
    const symptoms = Array.isArray(submission.symptoms) ? submission.symptoms.slice(0, 20).map(s => s.toString().slice(0, 64)) : [];
    const severity = Math.max(1, Math.min(10, Math.floor(submission.severity)));
    const ageRange = submission.ageRange ?? submission.demographicInfo?.ageRange ?? null;
    const hasRecentTravel = submission.hasRecentTravel ?? submission.demographicInfo?.hasRecentTravel ?? false;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Insert symptom report into database
    const { data, error } = await supabase
      .from('symptom_reports')
      .insert({
        location_lat: lat,
        location_lng: lng,
        location_city: city,
        location_country: country,
        symptoms,
        description,
        severity,
        age_range: ageRange,
        has_recent_travel: hasRecentTravel
      })
      .select()
      .single();

    if (error) {
      console.error('Database insert error:', error);
      throw new Error(`Failed to save symptom report: ${error.message}`);
    }

    console.log('Successfully inserted symptom report:', data.id);

    // Trigger outbreak detection after submission
    try {
      await supabase.functions.invoke('detect-outbreaks', {
        body: { triggerReason: 'new_report', reportId: data.id }
      });
    } catch (detectionError) {
      console.error('Failed to trigger outbreak detection:', detectionError);
      // Don't fail the submission if detection fails
    }

    return new Response(JSON.stringify({ 
      success: true,
      reportId: data.id,
      message: 'Symptom report submitted successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in submit-symptoms function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});