@echo off
echo Fixing SymptoMap MVP Issues...

REM 1. Create proper .env file if it doesn't exist
if not exist ".env" (
    echo Creating .env file...
    copy env.dev .env
    echo ✅ Created .env file
) else (
    echo ✅ .env file already exists
)

REM 2. Create frontend .env file if it doesn't exist
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

REM 3. Install dependencies
echo Installing dependencies...
npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)
echo ✅ Dependencies installed

REM 4. Check Docker
docker version >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Docker is not running. Please start Docker Desktop first.
    echo You can still run the development servers without Docker.
) else (
    echo ✅ Docker is running
)

echo.
echo 🎉 Issues fixed! You can now:
echo.
echo For Development:
echo   - Run: start-dev.bat
echo   - Or manually: npm run dev
echo.
echo For Production:
echo   - Run: start-prod.bat
echo   - Or manually: docker-compose -f docker-compose.prod.yml up -d
echo.
echo ⚠️  Don't forget to:
echo   1. Update your Mapbox token in .env files
echo   2. Update JWT secrets for production
echo   3. Configure OpenAI API key if using AI features
echo.
pause
