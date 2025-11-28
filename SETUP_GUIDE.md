# SymptoMap Application - Setup & Operation Guide

## ✅ Current Status: FULLY OPERATIONAL

All services are running and connected successfully:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8787  
- PostgreSQL Database: localhost:5432
- Redis Cache: localhost:6379

## Recent Fixes & Improvements

### Redis Client Initialization (FIXED)
- Separated PostgreSQL and Redis initialization into independent processes
- Added promise-based initialization tracking to prevent race conditions
- Redis client now properly initializes on startup with reconnection strategy
- **Result**: ✅ No more "Redis client not initialized" warnings

### Deprecation Warning (SUPPRESSED)
- Added `NODE_OPTIONS='--no-deprecation'` environment variable
- Suppresses util._extend deprecation warning from socket.io dependency
- **Result**: ✅ Clean console output without deprecation warnings

### Connection Verification
All connections now verified as working:
- ✅ PostgreSQL connected
- ✅ Redis connected and ready
- ✅ WebSocket active
- ✅ Database triggers set up for real-time updates

## Database Configuration

### Connection Details
- **Database**: symptomap
- **User**: symptomap
- **Password**: password
- **Host**: localhost
- **Port**: 5432

### Tables Created
- organizations
- users
- disease_profiles
- outbreak_reports
- ml_predictions
- disease_tracking
- system_metrics
- websocket_connections
- collaboration_sessions
- audit_logs

## Services Running

### Frontend (Vite Dev Server)
- **URL**: http://localhost:3000
- **Port**: 3000
- **Status**: Running
- **Build Tool**: Vite v4.5.14

### Backend (Node.js/Express)
- **URL**: http://localhost:8787
- **Port**: 8787
- **Status**: Running
- **Health Check**: http://localhost:8787/health
- **WebSocket**: ws://localhost:8787

### PostgreSQL Database
- **Port**: 5432
- **Status**: Running
- **Service**: postgresql-x64-18
- **Extensions Enabled**: PostGIS, TimescaleDB, UUID

### Redis Cache
- **Port**: 6379
- **Status**: Running
- **Executable**: C:\Redis\redis-server.exe

## How to Access the Application

### From Browser
1. Open http://localhost:3000
2. The application will automatically connect to the backend API
3. WebSocket connections enable real-time updates

### API Endpoints
- Health Check: GET http://localhost:8787/health
- Main API: http://localhost:8787/api/v1/*
- WebSocket: ws://localhost:8787

## Development Files

### Key Configuration Files
- `env.dev` - Development environment variables
- `backend/.env` - Backend configuration
- `frontend/.env` - Frontend configuration
- `backend/schema/complete-schema.sql` - Database schema

### Database Setup Scripts
- `setup-db.ps1` - PowerShell script to initialize PostgreSQL
- `backend/schema/complete-schema.sql` - Complete database schema

## Running the Application

### Start All Services (Recommended)
```bash
cd c:\Users\digital metro\Documents\sympto-pulse-map-main
$env:NODE_OPTIONS='--no-deprecation'
npm run dev
```

The `NODE_OPTIONS` setting suppresses deprecation warnings from dependencies for cleaner output.

### Start Individual Services
**Backend only:**
```bash
cd backend
npm run dev
```

**Frontend only:**
```bash
cd frontend
npm run dev
```

### Stop All Services
Press `Ctrl+C` in the terminal running `npm run dev`

### Restart Services
1. Kill any existing Node processes:
   ```powershell
   Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
   ```
2. Run `npm run dev` again with NODE_OPTIONS

## Database Operations

### Connect to Database
```powershell
$env:PGPASSWORD='password'
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U symptomap -d symptomap
```

### Reset Database
```powershell
& '.\setup-db.ps1'
```

This will:
1. Drop existing database and user
2. Create fresh symptomap database
3. Create new symptomap user
4. Set all required permissions
5. Verify connection

## Monitoring & Health Checks

### Check Backend Health
```bash
curl http://localhost:8787/health
```

### Check Redis
```cmd
C:\Redis\redis-cli.exe ping
```
Expected response: `PONG`

### Check PostgreSQL
```powershell
$env:PGPASSWORD='password'
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U symptomap -d symptomap -c 'SELECT NOW();'
```

## Troubleshooting

### Port Already in Use

If you see `EADDRINUSE` error:

```powershell
# Kill Node processes
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force

# Wait a few seconds
Start-Sleep -Seconds 3

# Start again
npm run dev
```

### Redis Not Connecting

```powershell
# Start Redis
Start-Process -FilePath 'C:\Redis\redis-server.exe' -WindowStyle Minimized

# Verify
& 'C:\Redis\redis-cli.exe' ping
```

### PostgreSQL Connection Errors

1. Verify PostgreSQL service is running:
   ```powershell
   Get-Service -Name postgresql*
   ```

2. Test connection:
   ```powershell
   $env:PGPASSWORD='password'
   & 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U symptomap -d symptomap -c 'SELECT 1'
   ```

## Performance Notes

- Database connections: 20 max
- Redis cache: Enabled for real-time updates
- WebSocket connections: Tracked and managed
- Real-time broadcasting: Disease tracking updates via WebSocket

## Next Steps

1. Access the frontend at http://localhost:3000
2. Explore the disease tracking interface
3. Create outbreak reports
4. Monitor real-time updates via WebSocket
5. Use the health check endpoint to verify backend status

## Default Disease Profiles

The following diseases are pre-populated:
- COVID-19 (severity: 4/5)
- Influenza (severity: 3/5)
- Malaria (severity: 4/5)
- Dengue (severity: 3/5)
- Measles (severity: 4/5)

## Support

For issues or questions:
1. Check logs in the terminal running `npm run dev`
2. Review the troubleshooting section above
3. Verify all services are running
4. Check database connectivity
