#!/bin/bash
# Streamora Development Startup Script

echo "🎬 Starting Streamora Development Environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "README.md" ]; then
    echo "❌ Please run this script from the Streamora root directory"
    exit 1
fi

echo "📦 Installing dependencies..."

# Install server dependencies
echo "Installing server dependencies..."
cd server
if [ ! -d "node_modules" ]; then
    npm install
fi
cd ..

# Install client dependencies  
echo "Installing client dependencies..."
cd client
if [ ! -d "node_modules" ]; then
    npm install
fi
cd ..

echo "✅ Dependencies installed!"

# Check for environment files
if [ ! -f "server/.env" ]; then
    echo "⚠️  Warning: server/.env not found. Copy from .env.example and configure."
fi

if [ ! -f "client/.env" ]; then
    echo "⚠️  Warning: client/.env not found. Copy from .env.example and configure."
fi

echo ""
echo "🚀 Ready to start development!"
echo ""
echo "To start the servers:"
echo "  Backend:  cd server && npm run dev"
echo "  Frontend: cd client && npm start"
echo ""
echo "Default URLs:"
echo "  Backend:  http://localhost:5000"
echo "  Frontend: http://localhost:3000"
echo ""
echo "📖 Check DEVELOPMENT.md for detailed setup instructions."
