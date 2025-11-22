@echo off
echo Starting SymptoMap MVP Development Environment...

REM Check if Docker is running
docker version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Start PostgreSQL and Redis
echo Starting database services...
docker-compose up -d postgres redis

REM Wait for services to be ready
echo Waiting for services to be ready...
timeout /t 10 /nobreak >nul

REM Run database migrations
echo Running database migrations...
cd backend
npm run db:migrate
cd ..

REM Start backend in background
echo Starting backend API server...
start "Backend API" cmd /k "cd backend && npm run dev"

REM Wait a moment for backend to start
timeout /t 5 /nobreak >nul

REM Start frontend
echo Starting frontend development server...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo 🎉 SymptoMap MVP Development Environment is ready!
echo.
echo 📍 Access points:
echo    Frontend: http://localhost:3000
echo    Backend API: http://localhost:8787
echo    API Health: http://localhost:8787/health
echo    API Docs: http://localhost:8787/api/v1/docs
echo.
echo 🛠️  Development tools:
echo    Prometheus: http://localhost:9090
echo    Grafana: http://localhost:3001
echo.
echo 📊 Monitoring:
echo    View logs: docker-compose logs -f
echo    Stop services: docker-compose down
echo.
echo ⚠️  Remember to:
echo    1. Update your Mapbox token in .env files
echo    2. Update JWT secrets for production
echo    3. Configure OpenAI API key if using AI features
echo.
pause
