# SymptoMap API Documentation

## Overview

The SymptoMap API provides real-time disease surveillance and outbreak prediction capabilities. This RESTful API supports authentication, real-time data streaming, and advanced analytics.

## Base URL

- **Production**: `https://api.symptomap.com`
- **Staging**: `https://staging-api.symptomap.com`
- **Development**: `http://localhost:8787`

## Authentication

All API endpoints (except public health data) require authentication using JWT tokens.

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password",
  "rememberMe": false
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "analyst"
  },
  "expiresIn": 3600
}
```

### Using Tokens

Include the access token in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

## Core Endpoints

### Outbreak Reports

#### Get Outbreaks
```http
GET /api/v1/outbreaks?lat_min=40.0&lat_max=41.0&lng_min=-74.0&lng_max=-73.0&days_back=30
```

**Parameters:**
- `lat_min`, `lat_max`, `lng_min`, `lng_max`: Geographic bounds
- `days_back`: Number of days to look back (default: 30)
- `disease_type`: Filter by disease type
- `severity_min`: Minimum severity level (1-5)

**Response:**
```json
{
  "data": [
    {
      "id": "outbreak-uuid",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "diseaseType": "covid-19",
      "caseCount": 150,
      "severity": "high",
      "confidence": 0.85,
      "lastUpdated": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "total": 1,
    "bounds": {...},
    "generatedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### Create Outbreak Report
```http
POST /api/v1/outbreaks
Content-Type: application/json

{
  "diseaseId": "disease-uuid",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "caseCount": 5,
  "severityLevel": 3,
  "symptoms": ["fever", "cough"],
  "onsetDate": "2024-01-10",
  "notes": "Cluster in downtown area"
}
```

### Predictions

#### Get ML Predictions
```http
POST /api/v1/predictions
Content-Type: application/json

{
  "diseaseId": "disease-uuid",
  "boundsNorth": 41.0,
  "boundsSouth": 40.0,
  "boundsEast": -73.0,
  "boundsWest": -74.0,
  "horizonDays": 7
}
```

**Response:**
```json
{
  "data": {
    "id": "prediction-uuid",
    "modelVersion": "1.2.0",
    "predictedCases": [
      {
        "date": "2024-01-16",
        "predictedCases": 25,
        "confidenceInterval": {
          "lower": 20,
          "upper": 30
        },
        "riskLevel": "medium"
      }
    ],
    "confidenceScore": 0.82
  }
}
```

### Anomaly Detection

#### Detect Anomalies
```http
POST /api/v1/anomalies/detect
Content-Type: application/json

{
  "boundsNorth": 41.0,
  "boundsSouth": 40.0,
  "boundsEast": -73.0,
  "boundsWest": -74.0
}
```

**Response:**
```json
{
  "data": {
    "anomalies": [
      {
        "id": "anomaly-uuid",
        "type": "spatial",
        "severity": "high",
        "description": "Unusual cluster density detected",
        "location": {
          "latitude": 40.7128,
          "longitude": -74.0060
        },
        "confidence": 0.91,
        "recommendations": [
          "Increase surveillance in affected area",
          "Deploy rapid response team"
        ]
      }
    ]
  }
}
```

## WebSocket API

Connect to real-time updates via WebSocket:

```javascript
const socket = io('wss://api.symptomap.com', {
  auth: {
    token: 'your-jwt-token'
  }
});

// Subscribe to outbreak updates
socket.emit('map:subscribe', {
  north: 41.0,
  south: 40.0,
  east: -73.0,
  west: -74.0
});

// Listen for updates
socket.on('outbreak:created', (outbreak) => {
  console.log('New outbreak:', outbreak);
});

socket.on('outbreak:updated', (outbreak) => {
  console.log('Updated outbreak:', outbreak);
});
```

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Validation Error",
  "message": "Invalid latitude value",
  "field": "latitude",
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_123456"
}
```

### Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Rate Limiting

- **Authenticated users**: 1000 requests per 15 minutes
- **Anonymous users**: 100 requests per 15 minutes
- **ML predictions**: 50 requests per hour

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642248600
```

## Data Models

### Outbreak Report
```typescript
interface OutbreakReport {
  id: string;
  diseaseId: string;
  latitude: number;
  longitude: number;
  locationName?: string;
  caseCount: number;
  severityLevel: 1 | 2 | 3 | 4 | 5;
  symptoms: string[];
  onsetDate: string;
  reportDate: string;
  confidence: number;
  dataSource: string;
  createdAt: string;
}
```

### ML Prediction
```typescript
interface MLPrediction {
  id: string;
  modelVersion: string;
  diseaseId: string;
  predictionDate: string;
  horizonDays: number;
  predictedCases: Array<{
    date: string;
    predictedCases: number;
    confidenceInterval: {
      lower: number;
      upper: number;
    };
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }>;
  confidenceScore: number;
  mape?: number;
  rmse?: number;
}
```

## SDKs and Libraries

### JavaScript/TypeScript
```bash
npm install @symptomap/api-client
```

```typescript
import { SymptoMapClient } from '@symptomap/api-client';

const client = new SymptoMapClient({
  baseURL: 'https://api.symptomap.com',
  apiKey: 'your-api-key'
});

const outbreaks = await client.outbreaks.list({
  bounds: { north: 41, south: 40, east: -73, west: -74 }
});
```

### Python
```bash
pip install symptomap-client
```

```python
from symptomap import SymptoMapClient

client = SymptoMapClient(
    base_url='https://api.symptomap.com',
    api_key='your-api-key'
)

outbreaks = client.outbreaks.list(
    bounds={'north': 41, 'south': 40, 'east': -73, 'west': -74}
)
```

## Webhooks

Register webhooks to receive notifications about critical events:

```http
POST /api/v1/webhooks
Content-Type: application/json

{
  "url": "https://your-app.com/webhooks/symptomap",
  "events": ["outbreak:critical", "anomaly:detected"],
  "secret": "your-webhook-secret"
}
```

Webhook payload example:
```json
{
  "event": "outbreak:critical",
  "data": {
    "id": "outbreak-uuid",
    "severity": "critical",
    "location": {...}
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Support

- **Documentation**: https://docs.symptomap.com
- **API Status**: https://status.symptomap.com
- **Support Email**: api-support@symptomap.com
- **Discord**: https://discord.gg/symptomap
