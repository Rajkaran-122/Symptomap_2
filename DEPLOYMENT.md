# SymptoMap MVP Deployment Guide

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- PostgreSQL 15+ with PostGIS
- Redis 7+
- Mapbox API key

### 1. Development Setup

```bash
# Clone and setup
git clone https://github.com/Rajkaran-122/Symptomap.git
cd Symptomap
npm run setup

# Configure environment
cp env.example .env
# Edit .env with your API keys

# Start development environment
./scripts/setup-dev.sh
```

### 2. Production Deployment

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy with environment variables
POSTGRES_PASSWORD=your-secure-password \
JWT_SECRET=your-jwt-secret \
MAPBOX_ACCESS_TOKEN=your-mapbox-token \
docker-compose -f docker-compose.prod.yml up -d
```

### 3. Kubernetes Deployment

```bash
# Apply Kubernetes manifests
kubectl apply -f kubernetes/

# Check deployment status
kubectl get pods -n symptomap

# Access services
kubectl port-forward svc/symptomap-frontend 3000:80
kubectl port-forward svc/symptomap-backend 8787:8787
```

## 📊 Monitoring

### Access Points
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8787
- **API Docs**: http://localhost:8787/api/v1/docs
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)

### Key Metrics
- API response times <200ms P95
- Map rendering <50ms initial load
- WebSocket latency <100ms
- Concurrent users: 1000+
- Data points: 100K+ with smooth interaction

## 🔧 Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/symptomap
REDIS_URL=redis://localhost:6379

# API Configuration
NODE_ENV=production
PORT=8787
CORS_ORIGIN=https://symptomap.com

# External Services
MAPBOX_ACCESS_TOKEN=your-mapbox-token
OPENAI_API_KEY=your-openai-key

# Security
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
```

### Performance Tuning

```bash
# Database optimization
POSTGRES_SHARED_BUFFERS=256MB
POSTGRES_EFFECTIVE_CACHE_SIZE=1GB
POSTGRES_WORK_MEM=4MB

# Redis optimization
REDIS_MAXMEMORY=512mb
REDIS_MAXMEMORY_POLICY=allkeys-lru

# Node.js optimization
NODE_OPTIONS="--max-old-space-size=512"
```

## 🛠️ Maintenance

### Database Maintenance

```bash
# Run migrations
npm run db:migrate

# Seed sample data
npm run db:seed

# Reset database
npm run db:reset

# Backup database
pg_dump symptomap > backup.sql

# Restore database
psql symptomap < backup.sql
```

### Monitoring Maintenance

```bash
# View logs
docker-compose logs -f

# Check system metrics
curl http://localhost:8787/metrics

# View Grafana dashboards
open http://localhost:3001

# Check Prometheus targets
open http://localhost:9090/targets
```

### Scaling

```bash
# Scale backend services
docker-compose up -d --scale backend=3

# Scale frontend services
docker-compose up -d --scale frontend=2

# Kubernetes scaling
kubectl scale deployment symptomap-backend --replicas=5
kubectl scale deployment symptomap-frontend --replicas=3
```

## 🔒 Security

### SSL/TLS Configuration

```bash
# Generate SSL certificates
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Update nginx configuration
cp nginx.prod.conf nginx.conf
# Edit nginx.conf with SSL settings
```

### Security Headers

```bash
# Verify security headers
curl -I https://symptomap.com

# Expected headers:
# X-Frame-Options: SAMEORIGIN
# X-Content-Type-Options: nosniff
# X-XSS-Protection: 1; mode=block
# Referrer-Policy: strict-origin-when-cross-origin
```

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check PostgreSQL status
   docker-compose ps postgres
   
   # Check logs
   docker-compose logs postgres
   
   # Restart database
   docker-compose restart postgres
   ```

2. **Redis Connection Failed**
   ```bash
   # Check Redis status
   docker-compose ps redis
   
   # Check logs
   docker-compose logs redis
   
   # Restart Redis
   docker-compose restart redis
   ```

3. **Map Not Loading**
   ```bash
   # Check Mapbox token
   echo $MAPBOX_ACCESS_TOKEN
   
   # Verify token in browser console
   # Check network requests for 401 errors
   ```

4. **WebSocket Connection Failed**
   ```bash
   # Check WebSocket endpoint
   curl -I http://localhost:8787/socket.io/
   
   # Check firewall settings
   # Verify CORS configuration
   ```

### Performance Issues

1. **Slow API Responses**
   ```bash
   # Check database performance
   docker-compose exec postgres psql -U symptomap -d symptomap -c "SELECT * FROM pg_stat_activity;"
   
   # Check Redis performance
   docker-compose exec redis redis-cli info stats
   
   # Monitor API metrics
   curl http://localhost:8787/metrics
   ```

2. **High Memory Usage**
   ```bash
   # Check container memory usage
   docker stats
   
   # Check Node.js memory usage
   docker-compose exec backend node -e "console.log(process.memoryUsage())"
   
   # Restart services
   docker-compose restart backend frontend
   ```

## 📈 Performance Optimization

### Database Optimization

```sql
-- Create indexes for common queries
CREATE INDEX CONCURRENTLY idx_outbreak_reports_location ON outbreak_reports 
USING GIST (ST_Point(longitude, latitude));

CREATE INDEX CONCURRENTLY idx_outbreak_reports_disease_severity ON outbreak_reports 
(disease_type, severity_level, created_at DESC);

-- Analyze tables for better query planning
ANALYZE outbreak_reports;
```

### Application Optimization

```bash
# Enable Node.js clustering
NODE_CLUSTER_MODE=true

# Optimize Vite build
VITE_BUILD_OPTIMIZE=true

# Enable Redis clustering
REDIS_CLUSTER_MODE=true
```

## 🔄 Backup & Recovery

### Automated Backups

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump symptomap > "backup_${DATE}.sql"
aws s3 cp "backup_${DATE}.sql" s3://symptomap-backups/
rm "backup_${DATE}.sql"
EOF

chmod +x backup.sh

# Schedule with cron
echo "0 2 * * * /path/to/backup.sh" | crontab -
```

### Disaster Recovery

```bash
# Restore from backup
psql symptomap < backup_20240101_020000.sql

# Restore Redis data
redis-cli --rdb dump.rdb

# Restart services
docker-compose restart
```

## 📞 Support

- **Documentation**: [README.md](README.md)
- **Issues**: [GitHub Issues](https://github.com/Rajkaran-122/Symptomap/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Rajkaran-122/Symptomap/discussions)

---

**SymptoMap MVP - Built for public health professionals worldwide** 🏥
