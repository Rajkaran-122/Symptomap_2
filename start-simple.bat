@echo off
echo Starting SymptoMap MVP (Simple Mode)...

REM Start database services
echo Starting database services...
docker-compose up -d postgres redis

REM Wait for services
echo Waiting for services to be ready...
timeout /t 10 /nobreak >nul

REM Start backend
echo Starting backend API server...
start "Backend API" cmd /k "cd backend && npm run dev"

REM Wait for backend
timeout /t 5 /nobreak >nul

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
echo ⚠️  Note: Database migration will run automatically when backend starts
echo.
pause
