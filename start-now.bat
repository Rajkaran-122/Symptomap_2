@echo off
echo Starting SymptoMap MVP...

REM Check if Docker is running
docker version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Start database services
echo Starting database services...
docker-compose up -d postgres redis

REM Wait for services to be ready
echo Waiting for services to be ready...
timeout /t 15 /nobreak >nul

REM Start backend
echo Starting backend API server...
start "Backend API" cmd /k "cd backend && npm run dev"

REM Wait for backend to start
timeout /t 10 /nobreak >nul

REM Start frontend
echo Starting frontend development server...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo 🎉 SymptoMap MVP is starting!
echo.
echo 📍 Access points:
echo    Frontend: http://localhost:3000
echo    Backend API: http://localhost:8787
echo    API Health: http://localhost:8787/health
echo.
echo ⚠️  Important: Update your Mapbox token in .env file
echo    Get your token from: https://mapbox.com
echo.
echo The application will start in separate windows.
echo Close those windows to stop the services.
echo.
pause
