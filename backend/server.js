import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Pool } from 'pg';
import { z } from 'zod';
import { createClient as createRedis } from 'redis';
import OpenAI from 'openai';

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false
});

const redis = process.env.REDIS_URL ? createRedis({ url: process.env.REDIS_URL }) : null;
if (redis) redis.connect().catch((e) => console.error('Redis connect error', e));

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const ReportSchema = z.object({
  symptomDescription: z.string().min(1).max(4000),
  location: z.object({ city: z.string().min(1).max(128), country: z.string().min(1).max(128) }),
  severity: z.number().int().min(1).max(10).optional()
});

app.post('/api/reports', async (req, res) => {
  try {
    const parsed = ReportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

    const { symptomDescription, location, severity = 5 } = parsed.data;
    const now = new Date();

    const insert = await pool.query(
      'insert into symptom_reports (symptom_description, location_city, location_country, severity, created_at, gpt4_response, symptoms) values ($1,$2,$3,$4,$5,$6,$7) returning id, created_at',
      [symptomDescription, location.city, location.country, severity, now.toISOString(), {}, []]
    );

    return res.status(201).json({ id: insert.rows[0].id, timestamp: insert.rows[0].created_at, location: `${location.city}, ${location.country}`, symptoms: [] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/reports', async (_req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const q = await pool.query('select id, location_city, location_country, severity, symptoms, created_at from symptom_reports where created_at >= $1 order by created_at desc limit 1000', [since]);
    return res.json(q.rows.map(r => ({
      id: r.id,
      location: { city: r.location_city, country: r.location_country },
      severity: r.severity,
      symptoms: r.symptoms || [],
      timestamp: r.created_at
    })));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/outbreaks', async (_req, res) => {
  try {
    return res.json({ type: 'FeatureCollection', features: [] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Simple verified remedies knowledge base
const REMEDIES = [
  { key: 'sore throat', text: 'For a mild sore throat: warm saltwater gargles, honey with tea, hydration, and rest. Avoid giving honey to children under 1 year old.' },
  { key: 'fever', text: 'For a low-grade fever: stay hydrated and rest. Over-the-counter medications may help, but consult a healthcare professional for guidance, especially for children.' },
  { key: 'cough', text: 'For a mild cough: warm fluids, humidified air, and rest can help. Seek medical care for persistent or severe symptoms.' },
];

const ChatbotSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().optional(),
  language: z.string().optional(),
  imageDataUrl: z.string().url().optional()
});

app.post('/api/chatbot', async (req, res) => {
  try {
    if (!openai) return res.status(500).json({ error: 'OpenAI not configured' });
    const parsed = ChatbotSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

    const { message, conversationId, language, imageDataUrl } = parsed.data;
    const convId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Load conversation history
    let history = [];
    const redisKey = `chat:${convId}`;
    if (redis) {
      const raw = await redis.get(redisKey);
      if (raw) history = JSON.parse(raw);
    }

    // Safety: emergency triage
    const emergencySignals = /(chest pain|severe bleeding|difficulty breathing|trouble breathing|fainting|unconscious|stroke)/i;
    if (emergencySignals.test(message)) {
      const reply = language && language.toLowerCase().startsWith('es')
        ? 'Esto puede ser una emergencia. Llame a servicios de emergencia inmediatamente.'
        : 'This may be an emergency. Please call emergency services immediately.';
      if (redis) await redis.set(redisKey, JSON.stringify([...history, { role: 'user', content: message }, { role: 'assistant', content: reply }]), { EX: 60 * 60 * 24 });
      return res.json({ conversationId: convId, text: reply });
    }

    // Remedy retrieval
    const remedy = REMEDIES.find(r => message.toLowerCase().includes(r.key));
    const remedyContext = remedy ? `\n\nVerified home remedy guidance relevant to the user: ${remedy.text}` : '';

    // Historical symptom context (last 5 reports)
    let symptomContext = '';
    try {
      const q = await pool.query('select symptom_description, created_at from symptom_reports order by created_at desc limit 5');
      if (q.rows.length) {
        const lines = q.rows.map(r => `- ${new Date(r.created_at).toLocaleDateString()}: ${r.symptom_description}`).join('\n');
        symptomContext = `\n\nRecent user symptom history (for personalization):\n${lines}`;
      }
    } catch {}

    const sysLang = language ? `Respond in ${language}.` : '';
    const systemPrompt = `You are a highly-trained, empathetic, and medically cautious AI assistant. You provide general health information and explain basic home remedies. You are NOT a doctor and cannot provide a diagnosis. Always recommend consulting a healthcare professional for a final diagnosis.\n\nSafety rules:\n- If the user mentions emergency symptoms (chest pain, severe bleeding, difficulty breathing), immediately tell them to call emergency services. Do not provide other advice.\n- If asked for a diagnosis or prescription, say: "I am an AI and cannot provide a diagnosis. Please consult a licensed medical professional."\n- If the query is outside general health info, politely decline.\n${sysLang}`;

    const followupInstruction = `After your response, suggest 1-3 brief follow-up questions relevant to intake (e.g., severity trend, presence of fever, medications). Return them in a JSON field named "followUps" as an array of strings in your final message.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      imageDataUrl ? { role: 'user', content: [
        { type: 'text', text: `User message: ${message}${remedyContext}${symptomContext}\n\n${followupInstruction}` },
        { type: 'image_url', image_url: { url: imageDataUrl } }
      ] } : { role: 'user', content: `User message: ${message}${remedyContext}${symptomContext}\n\n${followupInstruction}` }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.3,
      max_tokens: 500
    });

    const text = completion.choices?.[0]?.message?.content?.trim() || 'Sorry, I could not generate a response.';

    const newHistory = [...history, { role: 'user', content: message }, { role: 'assistant', content: text }];
    if (redis) await redis.set(redisKey, JSON.stringify(newHistory), { EX: 60 * 60 * 24 });

    return res.json({ conversationId: convId, text });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`Backend listening on :${port}`));
