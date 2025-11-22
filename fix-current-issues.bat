@echo off
echo Fixing current SymptoMap MVP issues...

REM 1. Stop any running containers
echo Stopping any running containers...
docker-compose down >nul 2>&1

REM 2. Start database services
echo Starting database services...
docker-compose up -d postgres redis

REM 3. Wait for services to be ready
echo Waiting for services to be ready...
timeout /t 15 /nobreak >nul

REM 4. Test database connection
echo Testing database connection...
docker-compose exec postgres psql -U symptomap -d symptomap -c "SELECT NOW();" >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Database connection test failed, but continuing...
) else (
    echo ✅ Database connection test successful
)

REM 5. Create a simple .env file if it doesn't exist
if not exist ".env" (
    echo Creating .env file...
    echo # SymptoMap MVP Environment Configuration > .env
    echo POSTGRES_PASSWORD=password >> .env
    echo DATABASE_URL=postgresql://symptomap:password@localhost:5432/symptomap >> .env
    echo REDIS_URL=redis://localhost:6379 >> .env
    echo NODE_ENV=development >> .env
    echo PORT=8787 >> .env
    echo CORS_ORIGIN=http://localhost:3000 >> .env
    echo MAPBOX_ACCESS_TOKEN=your-mapbox-access-token-here >> .env
    echo JWT_SECRET=dev-jwt-secret-change-in-production >> .env
    echo JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production >> .env
    echo ✅ Created .env file
) else (
    echo ✅ .env file already exists
)

REM 6. Create frontend .env file if it doesn't exist
if not exist "frontend\.env" (
    echo Creating frontend .env file...
    echo VITE_API_URL=http://localhost:8787 > frontend\.env
    echo VITE_WS_URL=ws://localhost:8787 >> frontend\.env
    echo VITE_MAPBOX_ACCESS_TOKEN=your-mapbox-access-token-here >> frontend\.env
    echo VITE_ENVIRONMENT=development >> frontend\.env
    echo VITE_VERSION=1.0.0 >> frontend\.env
    echo ✅ Created frontend .env file
) else (
    echo ✅ Frontend .env file already exists
)

echo.
echo 🎉 Issues fixed! You can now start the application:
echo.
echo Option 1: Run start-now.bat
echo Option 2: Manual start:
echo   - Backend: cd backend && npm run dev
echo   - Frontend: cd frontend && npm run dev
echo.
echo ⚠️  Don't forget to update your Mapbox token in .env files!
echo    Get your token from: https://mapbox.com
echo.
pause
