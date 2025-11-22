# SymptoMap MVP - Real-time Disease Surveillance Platform

![SymptoMap Logo](https://img.shields.io/badge/SymptoMap-MVP-blue?style=for-the-badge&logo=health)

A comprehensive real-time disease surveillance and outbreak prediction platform built with modern web technologies. SymptoMap provides interactive mapping, AI-powered predictions, and collaborative intelligence for public health professionals.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Docker & Docker Compose
- PostgreSQL 15+ with PostGIS
- Redis 7+
- Mapbox API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Rajkaran-122/Symptomap.git
   cd Symptomap
   ```

2. **Install dependencies**
   ```bash
   npm run setup
   ```

3. **Configure environment**
   ```bash
   cp env.example .env
   # Edit .env with your API keys and configuration
   ```

4. **Start development environment**
   ```bash
   docker-compose up -d postgres redis
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8787
   - API Docs: http://localhost:8787/api/v1/docs

## 🏗️ Architecture

### Tech Stack

**Frontend**
- React 18 + TypeScript + Vite
- Zustand (state management)
- Mapbox GL JS (mapping)
- Recharts (visualizations)
- Tailwind CSS (styling)
- Socket.io (real-time)

**Backend**
- Node.js + Express + TypeScript
- PostgreSQL + PostGIS + TimescaleDB
- Redis (caching)
- Socket.io (WebSocket)

**Infrastructure**
- Docker containers
- Nginx reverse proxy
- Prometheus + Grafana monitoring

### System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Frontend│    │   Express API    │    │   PostgreSQL    │
│   (Port 3000)   │◄──►│   (Port 8787)    │◄──►│   + PostGIS     │
│                 │    │                  │    │   + TimescaleDB │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Mapbox GL JS  │    │   Socket.io      │    │   Redis Cache   │
│   (Mapping)     │    │   (Real-time)    │    │   (Sessions)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 📊 Features

### Core Features (MVP)

- **🗺️ Real-time Interactive Map**
  - Mapbox GL JS integration
  - Live outbreak visualization
  - Severity-based color coding
  - Cluster detection and rendering

- **⏰ Time-lapse System**
  - 30-day historical playback
  - Animated disease progression
  - Play/pause/scrub controls
  - Speed adjustment (0.5x - 8x)

- **🤖 ML Predictions**
  - 7-day outbreak forecasts
  - Confidence intervals
  - Risk level assessment
  - Model performance metrics

- **🔍 Advanced Filtering**
  - Disease type filtering
  - Severity level selection
  - Geographic bounds
  - Time window controls

- **📡 Real-time Updates**
  - WebSocket connections
  - Live data streaming
  - Collaborative annotations
  - System notifications

### Performance Targets

- **API Response**: <200ms P95
- **Map Rendering**: <50ms initial load
- **WebSocket Latency**: <100ms
- **Concurrent Users**: 1000+
- **Data Points**: 100K+ with smooth interaction

## 🛠️ Development

### Project Structure

```
SymptoMap/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── services/        # API clients
│   │   ├── store/          # Zustand store
│   │   └── types/          # TypeScript types
│   └── package.json
├── backend/                 # Express API server
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Express middleware
│   │   ├── database/       # DB connection
│   │   └── websocket/      # WebSocket handlers
│   └── package.json
├── monitoring/             # Prometheus/Grafana config
├── docker-compose.yml     # Development environment
└── README.md
```

### Available Scripts

```bash
# Development
npm run dev              # Start both frontend and backend
npm run dev:frontend     # Start frontend only
npm run dev:backend      # Start backend only

# Building
npm run build           # Build both applications
npm run build:frontend  # Build frontend
npm run build:backend   # Build backend

# Testing
npm run test            # Run all tests
npm run test:frontend   # Frontend tests
npm run test:backend    # Backend tests
npm run test:e2e        # End-to-end tests

# Database
npm run db:migrate      # Run database migrations
npm run db:seed         # Seed with sample data
npm run db:reset        # Reset database

# Deployment
npm run deploy:staging  # Deploy to staging
npm run deploy:production # Deploy to production
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/symptomap
REDIS_URL=redis://localhost:6379

# API Configuration
NODE_ENV=development
PORT=8787
CORS_ORIGIN=http://localhost:3000

# External Services
MAPBOX_ACCESS_TOKEN=your-mapbox-token
OPENAI_API_KEY=your-openai-key

# Security
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
```

## 📡 API Documentation

### Core Endpoints

#### Outbreaks
```http
GET /api/v1/outbreaks?lat_min=40.0&lat_max=41.0&lng_min=-74.0&lng_max=-73.0&days=30
POST /api/v1/outbreaks
GET /api/v1/outbreaks/:id
PUT /api/v1/outbreaks/:id
DELETE /api/v1/outbreaks/:id
```

#### Predictions
```http
POST /api/v1/predictions
GET /api/v1/predictions/:id
GET /api/v1/predictions/models/list
```

#### Health & Metrics
```http
GET /api/v1/health
GET /api/v1/health/ready
GET /api/v1/health/live
GET /api/v1/metrics
```

### WebSocket Events

```javascript
// Connect to WebSocket
const socket = io('ws://localhost:8787');

// Subscribe to map region
socket.emit('map:subscribe', {
  north: 41.0, south: 40.0,
  east: -73.0, west: -74.0
});

// Listen for updates
socket.on('outbreak:created', (outbreak) => {
  console.log('New outbreak:', outbreak);
});

socket.on('prediction:ready', (prediction) => {
  console.log('Prediction ready:', prediction);
});
```

## 🚀 Deployment

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Scale services
docker-compose up -d --scale backend=3
```

### Production Deployment

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes Deployment

```bash
# Apply Kubernetes manifests
kubectl apply -f kubernetes/

# Check deployment status
kubectl get pods -n symptomap

# Access services
kubectl port-forward svc/symptomap-frontend 3000:80
```

## 📈 Monitoring

### Prometheus Metrics

- **API Performance**: Response times, request rates
- **Database Metrics**: Connection pools, query performance
- **WebSocket Metrics**: Active connections, message rates
- **System Metrics**: CPU, memory, disk usage

### Grafana Dashboards

- **System Overview**: High-level system health
- **API Performance**: Request rates, response times
- **Database Performance**: Query performance, connections
- **Real-time Metrics**: WebSocket connections, active users

Access Grafana at http://localhost:3001 (admin/admin)

## 🔒 Security

### Implemented Security Measures

- **Input Validation**: Zod schema validation
- **Rate Limiting**: Express rate limiting
- **CORS Protection**: Configured CORS policies
- **Security Headers**: Helmet.js security headers
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Input sanitization

### Compliance

- **GDPR Ready**: Data protection measures
- **HIPAA Compatible**: Audit logging and encryption
- **Security Monitoring**: Comprehensive audit trails

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write comprehensive tests
- Document API changes
- Follow conventional commit messages
- Ensure all CI checks pass

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs.symptomap.com](https://docs.symptomap.com)
- **Issues**: [GitHub Issues](https://github.com/Rajkaran-122/Symptomap/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Rajkaran-122/Symptomap/discussions)
- **Email**: support@symptomap.com

## 🙏 Acknowledgments

- Mapbox for mapping services
- TimescaleDB for time-series optimization
- The open-source community for amazing tools
- Public health professionals for domain expertise

---

**Built with ❤️ for public health professionals worldwide**"# Symptomap_2" 
