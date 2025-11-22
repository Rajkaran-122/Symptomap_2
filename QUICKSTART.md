# SymptoMap MVP - Quick Start Guide

## 🚀 Quick Setup (Windows)

### Prerequisites
- Node.js 18+ installed
- Docker Desktop installed and running
- Git installed

### 1. Fix Current Issues
```bash
# Run the fix script
fix-issues.bat
```

### 2. Start Development Environment
```bash
# Option 1: Use the startup script
start-dev.bat

# Option 2: Manual start
npm run dev
```

### 3. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8787
- **API Health**: http://localhost:8787/health
- **API Docs**: http://localhost:8787/api/v1/docs

## 🔧 Configuration

### Update Environment Variables
1. Edit `.env` file in the root directory
2. Edit `frontend/.env` file
3. Update the following values:
   - `MAPBOX_ACCESS_TOKEN` - Get from https://mapbox.com
   - `OPENAI_API_KEY` - Get from https://openai.com (optional)
   - `JWT_SECRET` - Change for production
   - `JWT_REFRESH_SECRET` - Change for production

### Example .env file:
```bash
# Database
POSTGRES_PASSWORD=password
DATABASE_URL=postgresql://symptomap:password@localhost:5432/symptomap
REDIS_URL=redis://localhost:6379

# API Configuration
NODE_ENV=development
PORT=8787
CORS_ORIGIN=http://localhost:3000

# External Services
MAPBOX_ACCESS_TOKEN=pk.your-mapbox-token-here
OPENAI_API_KEY=sk-your-openai-key-here

# Security
JWT_SECRET=dev-jwt-secret-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production
```

## 🐳 Docker Commands

### Development
```bash
# Start database services
docker-compose up -d postgres redis

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production
```bash
# Start production environment
start-prod.bat

# Or manually
docker-compose -f docker-compose.prod.yml up -d
```

## 🧪 Testing

### Run Tests
```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

### Database Operations
```bash
# Run migrations
npm run db:migrate

# Seed sample data
npm run db:seed

# Reset database
npm run db:reset
```

## 📊 Monitoring

### Access Monitoring Tools
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)

### View Metrics
```bash
# API metrics
curl http://localhost:8787/metrics

# Health check
curl http://localhost:8787/health
```

## 🚨 Troubleshooting

### Common Issues

1. **Docker not running**
   ```bash
   # Start Docker Desktop
   # Wait for it to be ready
   docker version
   ```

2. **Port conflicts**
   ```bash
   # Check if ports are in use
   netstat -an | findstr :3000
   netstat -an | findstr :8787
   ```

3. **Database connection failed**
   ```bash
   # Check Docker services
   docker-compose ps
   
   # Restart database
   docker-compose restart postgres redis
   ```

4. **Frontend not loading**
   ```bash
   # Check if backend is running
   curl http://localhost:8787/health
   
   # Check frontend logs
   cd frontend && npm run dev
   ```

### Reset Everything
```bash
# Stop all services
docker-compose down

# Remove volumes
docker-compose down -v

# Reinstall dependencies
npm install

# Start fresh
start-dev.bat
```

## 📞 Support

- **Documentation**: [README.md](README.md)
- **Deployment Guide**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Issues**: [GitHub Issues](https://github.com/Rajkaran-122/Symptomap/issues)

---

**SymptoMap MVP - Built for public health professionals worldwide** 🏥
