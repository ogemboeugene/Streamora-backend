@echo off
REM Streamora Development Startup Script for Windows

echo 🎬 Starting Streamora Development Environment...

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if we're in the right directory
if not exist "README.md" (
    echo ❌ Please run this script from the Streamora root directory
    pause
    exit /b 1
)

echo 📦 Installing dependencies...

REM Install server dependencies
echo Installing server dependencies...
cd server
if not exist "node_modules" (
    npm install
)
cd ..

REM Install client dependencies  
echo Installing client dependencies...
cd client
if not exist "node_modules" (
    npm install
)
cd ..

echo ✅ Dependencies installed!

REM Check for environment files
if not exist "server\.env" (
    echo ⚠️  Warning: server\.env not found. Copy from .env.example and configure.
)

if not exist "client\.env" (
    echo ⚠️  Warning: client\.env not found. Copy from .env.example and configure.
)

echo.
echo 🚀 Ready to start development!
echo.
echo To start the servers:
echo   Backend:  cd server ^&^& npm run dev
echo   Frontend: cd client ^&^& npm start
echo.
echo Default URLs:
echo   Backend:  http://localhost:5000
echo   Frontend: http://localhost:3000
echo.
echo 📖 Check DEVELOPMENT.md for detailed setup instructions.
echo.
pause
