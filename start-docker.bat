@echo off
REM AI Testing System - Quick Start Script (Windows)

echo 🚀 Starting AI-Based Intelligent Automation Testing System...
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not installed. Please install Docker Desktop:
    echo    Visit: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo ✅ Docker is available
echo.

REM Setup environment file if it doesn't exist
if not exist ".env" (
    echo 📝 Creating .env file...
    (
        echo JWT_SECRET=your-super-secret-jwt-key-change-in-production-12345
        echo OPENAI_API_KEY=
        echo CORS_ORIGIN=http://localhost:3000
    ) > .env
    echo ✅ .env file created. Please update with your values.
)

echo.
echo 🐳 Building and starting Docker containers...
echo    This may take a few minutes on first run...
echo.

REM Build and start containers
docker-compose up -d

REM Wait for services
echo.
echo ⏳ Waiting for services to be ready (10 seconds)...
timeout /t 10 /nobreak

REM Check if services are running
docker-compose ps | findstr "running" >nul
if %errorlevel% equ 0 (
    echo.
    echo ✅ Services are running!
    echo.
    echo 📋 Access the application:
    echo    Frontend: http://localhost:3000
    echo    Backend:  http://localhost:5000
    echo    MongoDB:  localhost:27017
    echo.
    echo 👤 Default credentials:
    echo    Create a new account in the UI
    echo.
    echo 📚 Documentation:
    echo    Setup Guide: SETUP_GUIDE.md
    echo.
    echo ⏹️  To stop services: docker-compose down
    echo 🔄 To restart services: docker-compose restart
    echo 📊 To view logs: docker-compose logs -f
) else (
    echo.
    echo ❌ Failed to start services. Check logs:
    docker-compose logs
    pause
    exit /b 1
)

pause
