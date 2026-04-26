#!/bin/bash

# AI Testing System - Quick Start Script

echo "🚀 Starting AI-Based Intelligent Automation Testing System..."
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first:"
    echo "   Visit: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check if Docker daemon is running
if ! docker ps &> /dev/null; then
    echo "❌ Docker daemon is not running. Please start Docker and try again."
    exit 1
fi

echo "✅ Docker is available"
echo ""

# Setup environment file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cat > ".env" << EOF
JWT_SECRET=your-super-secret-jwt-key-change-in-production-12345
OPENAI_API_KEY=
CORS_ORIGIN=http://localhost:3000
EOF
    echo "✅ .env file created. Please update with your values."
fi

echo ""
echo "🐳 Building and starting Docker containers..."
echo "   This may take a few minutes on first run..."
echo ""

# Build and start containers
docker-compose up -d

# Wait for services to be ready
echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "running"; then
    echo ""
    echo "✅ Services are running!"
    echo ""
    echo "📋 Access the application:"
    echo "   Frontend: http://localhost:3000"
    echo "   Backend:  http://localhost:5000"
    echo "   MongoDB:  localhost:27017"
    echo ""
    echo "👤 Default credentials:"
    echo "   Create a new account in the UI or use:"
    echo "   Email: test@example.com"
    echo "   Password: (set your own)"
    echo ""
    echo "📚 Documentation:"
    echo "   Setup Guide: SETUP_GUIDE.md"
    echo "   API Docs: http://localhost:5000/api/docs"
    echo ""
    echo "⏹️  To stop services: docker-compose down"
    echo "🔄 To restart services: docker-compose restart"
    echo "📊 To view logs: docker-compose logs -f"
else
    echo "❌ Failed to start services. Check logs:"
    docker-compose logs
    exit 1
fi
