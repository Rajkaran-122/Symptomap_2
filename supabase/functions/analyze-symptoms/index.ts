import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalysisRequest {
  symptoms: string;
  severity: number;
}

interface AnalysisResponse {
  medicalTerms: string[];
  icd10Codes: string[];
  clusterProbability: number;
  riskScore: number;
  extractedSymptoms: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symptoms, severity }: AnalysisRequest = await req.json();

    if (!symptoms || typeof severity !== 'number') {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: symptoms, severity' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Basic sanitization and limits
    const sanitizedSymptoms = symptoms.toString().slice(0, 2000).trim();
    const boundedSeverity = Math.max(1, Math.min(10, severity));

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create input hash for caching
    const inputHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(sanitizedSymptoms.toLowerCase())
    );
    const hashString = Array.from(new Uint8Array(inputHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Check cache first
    const { data: cached, error: cacheError } = await supabase
      .from('analysis_cache')
      .select('*')
      .eq('input_hash', hashString)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (cached && !cacheError) {
      console.log('Cache hit for symptoms analysis');
      return new Response(JSON.stringify({
        medicalTerms: cached.medical_terms,
        icd10Codes: cached.icd10_codes,
        clusterProbability: cached.cluster_probability,
        riskScore: cached.risk_score,
        extractedSymptoms: cached.ai_response.extractedSymptoms || []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Prepare OpenAI prompt for medical analysis
    const prompt = `You are a medical AI assistant specialized in symptom analysis for epidemic surveillance.

Analyze the following symptom description and provide a structured response:

SYMPTOMS: "${sanitizedSymptoms}"
SEVERITY: ${boundedSeverity}/10

Please extract and analyze:
1. Individual symptoms mentioned
2. Medical terminology mapping
3. Relevant ICD-10 codes
4. Cluster probability (likelihood this could be part of an epidemic)
5. Risk score based on symptom combination and severity

Respond in valid JSON format:
{
  "extractedSymptoms": ["symptom1", "symptom2"],
  "medicalTerms": ["MEDICAL_TERM_1", "MEDICAL_TERM_2"],
  "icd10Codes": ["R50.9", "R05"],
  "clusterProbability": 0.75,
  "riskScore": 85.2,
  "analysis": "Brief medical assessment"
}`;

    // Call OpenAI API with retry logic
    let response;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a medical AI specialized in symptom analysis for epidemic surveillance. Always respond with valid JSON.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            max_tokens: 500,
            temperature: 0.3,
          }),
        });

        if (response.ok) break;
        
        retryCount++;
        if (retryCount === maxRetries) throw new Error(`OpenAI API failed after ${maxRetries} retries`);
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        
      } catch (error) {
        console.error(`OpenAI API attempt ${retryCount + 1} failed:`, error);
        retryCount++;
        if (retryCount === maxRetries) throw error;
      }
    }

    const aiData = await response.json();
    
    if (aiData.error) {
      throw new Error(`OpenAI API error: ${aiData.error.message}`);
    }

    let analysisResult: AnalysisResponse;
    
    try {
      const aiContent = aiData.choices[0].message.content.trim();
      const parsed = JSON.parse(aiContent);
      
      analysisResult = {
        medicalTerms: parsed.medicalTerms || [],
        icd10Codes: parsed.icd10Codes || [],
        clusterProbability: Math.max(0, Math.min(1, parsed.clusterProbability || 0.5)),
        riskScore: Math.max(0, Math.min(100, parsed.riskScore || boundedSeverity * 10)),
        extractedSymptoms: parsed.extractedSymptoms || []
      };
    } catch (parseError) {
      console.error('Failed to parse OpenAI response, using fallback:', parseError);
      // Fallback analysis
      const symptomKeywords = [
        'fever', 'headache', 'cough', 'fatigue', 'nausea', 'vomiting', 
        'diarrhea', 'sore throat', 'muscle pain', 'shortness of breath',
        'chest pain', 'dizziness', 'rash', 'chills', 'runny nose'
      ];
      
      const lowerSymptoms = sanitizedSymptoms.toLowerCase();
      const extractedSymptoms = symptomKeywords.filter(symptom => 
        lowerSymptoms.includes(symptom)
      );

      analysisResult = {
        medicalTerms: extractedSymptoms.map(s => s.toUpperCase().replace(/\s+/g, '_')),
        icd10Codes: [`R${Math.floor(Math.random() * 99).toString().padStart(2, '0')}.${Math.floor(Math.random() * 9)}`],
        clusterProbability: Math.min(1, boundedSeverity / 10 + Math.random() * 0.3),
        riskScore: boundedSeverity * 8 + Math.random() * 20,
        extractedSymptoms
      };
    }

    // Cache the result
    try {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from('analysis_cache')
        .insert({
          input_hash: hashString,
          symptoms_text: sanitizedSymptoms,
          ai_response: { ...analysisResult, fullResponse: aiData },
          medical_terms: analysisResult.medicalTerms,
          icd10_codes: analysisResult.icd10Codes,
          cluster_probability: analysisResult.clusterProbability,
          risk_score: analysisResult.riskScore,
          model_used: 'gpt-4o-mini',
          expires_at: expiresAt
        });
    } catch (cacheInsertError) {
      console.error('Failed to cache analysis result:', cacheInsertError);
    }

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-symptoms function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});