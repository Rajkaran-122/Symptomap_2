#!/bin/bash
set -e

echo "🏥 Setting up SymptoMap MVP Development Environment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Create environment files
echo "📝 Creating environment files..."

if [ ! -f .env ]; then
    cat > .env << EOF
# SymptoMap MVP Environment Configuration

# Database
POSTGRES_USER=symptomap
POSTGRES_PASSWORD=password
POSTGRES_DB=symptomap

# Redis
REDIS_PASSWORD=

# JWT Secrets (Change these in production!)
JWT_SECRET=dev-jwt-secret-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production

# External Services
OPENAI_API_KEY=your-openai-api-key
MAPBOX_ACCESS_TOKEN=your-mapbox-access-token

# API Configuration
NODE_ENV=development
PORT=8787
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# Security
BCRYPT_ROUNDS=12
SESSION_TIMEOUT=900
MAX_FAILED_ATTEMPTS=5
EOF
    echo "✅ Created .env file"
else
    echo "⚠️  .env file already exists, skipping creation"
fi

if [ ! -f frontend/.env ]; then
    cat > frontend/.env << EOF
# Frontend Environment Variables

VITE_API_URL=http://localhost:8787
VITE_WS_URL=ws://localhost:8787
VITE_MAPBOX_ACCESS_TOKEN=your-mapbox-access-token
VITE_ENVIRONMENT=development
VITE_VERSION=1.0.0
EOF
    echo "✅ Created frontend/.env file"
else
    echo "⚠️  frontend/.env file already exists, skipping creation"
fi

# Install dependencies
echo "📦 Installing dependencies..."

# Backend dependencies
if [ ! -d "backend/node_modules" ]; then
    echo "Installing backend dependencies..."
    cd backend && npm install && cd ..
    echo "✅ Backend dependencies installed"
else
    echo "⚠️  Backend dependencies already installed"
fi

# Frontend dependencies
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
    echo "✅ Frontend dependencies installed"
else
    echo "⚠️  Frontend dependencies already installed"
fi

# Start services
echo "🚀 Starting development services..."

# Start PostgreSQL and Redis
docker-compose up -d postgres redis

echo "⏳ Waiting for services to be ready..."
sleep 10

# Run database migrations
echo "🗄️  Running database migrations..."
cd backend && npm run db:migrate && cd ..

# Start development servers
echo "🎉 Starting development servers..."

# Start backend in background
echo "Starting backend API server..."
cd backend && npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 5

# Start frontend
echo "Starting frontend development server..."
cd frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "🎉 SymptoMap MVP Development Environment is ready!"
echo ""
echo "📍 Access points:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:8787"
echo "   API Health: http://localhost:8787/health"
echo "   API Docs: http://localhost:8787/api/v1/docs"
echo ""
echo "🛠️  Development tools:"
echo "   Prometheus: http://localhost:9090"
echo "   Grafana: http://localhost:3001"
echo ""
echo "📊 Monitoring:"
echo "   View logs: docker-compose logs -f"
echo "   Stop services: docker-compose down"
echo ""
echo "⚠️  Remember to:"
echo "   1. Update your Mapbox token in .env files"
echo "   2. Update JWT secrets for production"
echo "   3. Configure OpenAI API key if using AI features"
echo ""

# Keep script running
trap "echo 'Shutting down...'; kill $BACKEND_PID $FRONTEND_PID; docker-compose down; exit" INT TERM
wait