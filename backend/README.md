# SymptoMap Backend

## Setup

1. Install dependencies

```
npm install
```

2. Configure environment

- Copy `.env.example` to `.env` and fill `DATABASE_URL`

3. Run migrations

```
npm run migrate
```

4. Start server

```
npm run dev
```

The server listens on `PORT` (default 8787) and exposes:

- POST `/api/reports` — create a symptom report
- GET `/api/reports` — list recent reports (7 days)
- GET `/api/outbreaks` — placeholder GeoJSON (to be implemented)
