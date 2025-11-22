@echo off
echo Starting SymptoMap MVP Production Environment...

REM Check if Docker is running
docker version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Check if environment file exists
if not exist "env.prod" (
    echo Error: env.prod file not found. Please create it with your production configuration.
    echo Copy env.example to env.prod and update the values.
    pause
    exit /b 1
)

REM Load environment variables
echo Loading production environment variables...
for /f "usebackq tokens=1,2 delims==" %%a in ("env.prod") do (
    if not "%%a"=="" if not "%%a:~0,1%"=="#" (
        set "%%a=%%b"
    )
)

REM Start production services
echo Starting production services...
docker-compose -f docker-compose.prod.yml up -d

echo.
echo 🎉 SymptoMap MVP Production Environment is ready!
echo.
echo 📍 Access points:
echo    Frontend: http://localhost:3000
echo    Backend API: http://localhost:8787
echo    API Health: http://localhost:8787/health
echo    API Docs: http://localhost:8787/api/v1/docs
echo.
echo 🛠️  Monitoring:
echo    Prometheus: http://localhost:9090
echo    Grafana: http://localhost:3001
echo.
echo 📊 Management:
echo    View logs: docker-compose -f docker-compose.prod.yml logs -f
echo    Stop services: docker-compose -f docker-compose.prod.yml down
echo.
pause
