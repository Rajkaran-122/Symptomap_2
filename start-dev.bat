@echo off
REM SymptoMap Development Environment Startup Script
REM This script starts the full dev environment with proper configuration

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          SymptoMap Application - Dev Environment           ║
echo ║              Starting Backend ^& Frontend...                 ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Set NODE_OPTIONS to suppress deprecation warnings
set NODE_OPTIONS=--no-deprecation

REM Check if Redis is running
echo Checking Redis status...
"C:\Redis\redis-cli.exe" ping >nul 2>&1
if errorlevel 1 (
    echo WARNING: Redis is not running. Starting Redis...
    start "Redis Server" /MIN "C:\Redis\redis-server.exe"
    timeout /t 2 /nobreak
) else (
    echo OK: Redis is running
)

REM Check if PostgreSQL is running
echo Checking PostgreSQL status...
netstat -ano | findstr ":5432" >nul
if errorlevel 1 (
    echo WARNING: PostgreSQL is not running. Please start PostgreSQL service.
    pause
    exit /b 1
) else (
    echo OK: PostgreSQL is running
)

REM Start the development environment
echo.
echo Starting development servers...
echo.
cd "%~dp0"
npm run dev

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
