# SymptoMap

A real-time global disease surveillance platform. Live map visualizes symptom clusters, AI analyzes reports, and a conversational assistant helps users with safe, multilingual guidance.

## Features

- Live Mapbox map with clusters, heatmap, time-lapse slider, spread lines
- Symptom reporting with voice input, severity slider, demographics
- Backend API (Express + Postgres) for reports and outbreaks
- AI analysis via OpenAI (chatbot with safety, remedies, multilingual, vision)
- Annotations (shared via Supabase or local), CSV export, printable reports
- Officials dashboard with metrics, alerts, and annotation tools
- In-app clinics panel (OSM Overpass) and “Find a clinic near me” flow

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind, shadcn-ui, Framer Motion, Mapbox GL
- State: Zustand, Supabase client (for optional shared annotations)
- Backend: Node.js, Express, PostgreSQL, OpenAI API, Redis (optional)

## Monorepo Layout

- `src/` — React app
- `backend/` — Express server and migrations
- `supabase/functions/` — Optional edge functions (if you use Supabase path)

## Prerequisites

- Node.js 18+
- npm
- Mapbox access token (for map)
- PostgreSQL 14+ (Docker example below)
- OpenAI API key (for chatbot and analysis)
- Redis (optional) for chatbot conversation state

## Quick Start (Frontend)

```bash
# In project root
npm install
npm run dev
```

Enter your Mapbox token in the UI prompt on first load.

## Quick Start (Backend)

```bash
# Start Postgres via Docker (example)
docker run --name symptomap-db -e POSTGRES_PASSWORD=hackathon \
  -e POSTGRES_USER=postgres -e POSTGRES_DB=symptomap \
  -p 5432:5432 -d postgres:15

# Backend
cd backend
npm install
# .env
# DATABASE_URL=postgres://postgres:hackathon@localhost:5432/symptomap
# OPENAI_API_KEY=sk-...
# optional: REDIS_URL=redis://localhost:6379
node scripts/migrate.js
npm run dev
```

The frontend is configured to proxy `/api/*` to `http://localhost:8787`.

## Environment Variables

- Frontend: none required; Mapbox token is stored locally in the app
- Backend:
  - `DATABASE_URL` — Postgres connection URL
  - `OPENAI_API_KEY` — OpenAI API Key
  - `REDIS_URL` — optional for chatbot session state
  - `PORT` — optional (default 8787)

## API

- POST `/api/reports` — create symptom report
- GET `/api/reports` — list last 7 days of reports
- GET `/api/outbreaks` — GeoJSON of outbreaks (placeholder; replace with clustering)
- POST `/api/chatbot` — conversational assistant (message, conversationId, language, optional imageDataUrl)

## Security & Safety

- Chatbot has strict safety rules and emergency detection
- Input validation with zod on the server
- Role-gated Officials Panel (via Supabase user metadata) on frontend

## Development Tasks

- Replace placeholder outbreaks logic with DBSCAN + risk score
- Add RLS-protected shared annotations if using Supabase
- Improve PDF export (headless renderer) if required

## Scripts

- Frontend: `npm run dev`, `npm run build`, `npm run preview`
- Backend: `npm run dev`, `npm run migrate`, `npm start`

## License

MIT License. See `LICENSE`. 
