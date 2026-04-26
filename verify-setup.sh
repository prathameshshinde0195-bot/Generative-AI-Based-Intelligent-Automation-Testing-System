#!/bin/bash

# Verification Script - Check if all systems are properly set up

echo "🔍 Verifying AI Testing System Setup..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

errors=0
warnings=0

check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✅${NC} $1 is installed"
        return 0
    else
        echo -e "${RED}❌${NC} $1 is NOT installed"
        ((errors++))
        return 1
    fi
}

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅${NC} $1 exists"
        return 0
    else
        echo -e "${YELLOW}⚠️${NC}  $1 does NOT exist"
        ((warnings++))
        return 1
    fi
}

check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${GREEN}✅${NC} Port $1 is available"
        return 0
    else
        echo -e "${YELLOW}⚠️${NC}  Port $1 is in use or not accessible"
        ((warnings++))
        return 1
    fi
}

echo "📦 Checking Prerequisites..."
echo ""
check_command node
check_command npm
check_command mongod || check_command mongo
check_command git
echo ""

echo "📁 Checking Project Structure..."
echo ""
check_file "package.json"
check_file "server/package.json"
check_file ".env.local"
check_file "server/.env"
echo ""

echo "🔌 Checking Ports..."
echo ""
check_port 3000
check_port 5000
check_port 27017
echo ""

echo "📦 Checking Dependencies..."
echo ""
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅${NC} Frontend node_modules exist"
else
    echo -e "${YELLOW}⚠️${NC}  Frontend node_modules NOT found (run: npm install)"
    ((warnings++))
fi

if [ -d "server/node_modules" ]; then
    echo -e "${GREEN}✅${NC} Backend node_modules exist"
else
    echo -e "${YELLOW}⚠️${NC}  Backend node_modules NOT found (run: npm run backend:install)"
    ((warnings++))
fi
echo ""

echo "🔐 Checking Environment Variables..."
echo ""
if grep -q "OPENAI_API_KEY" "server/.env"; then
    if grep -q "OPENAI_API_KEY=" "server/.env"; then
        openai_value=$(grep "OPENAI_API_KEY=" "server/.env" | cut -d'=' -f2-)
        if [ -z "$openai_value" ] || [ "$openai_value" = "your_openai_api_key_here" ]; then
            echo -e "${YELLOW}⚠️${NC}  OPENAI_API_KEY is not set (optional, using mock responses)"
            ((warnings++))
        else
            echo -e "${GREEN}✅${NC} OPENAI_API_KEY is configured"
        fi
    fi
fi

if grep -q "JWT_SECRET" "server/.env"; then
    echo -e "${GREEN}✅${NC} JWT_SECRET is configured"
else
    echo -e "${RED}❌${NC} JWT_SECRET is NOT configured"
    ((errors++))
fi

if grep -q "MONGODB_URI" "server/.env"; then
    echo -e "${GREEN}✅${NC} MONGODB_URI is configured"
else
    echo -e "${RED}❌${NC} MONGODB_URI is NOT configured"
    ((errors++))
fi
echo ""

echo "🚀 Summary..."
echo ""
if [ $errors -eq 0 ]; then
    echo -e "${GREEN}✅ All critical checks passed!${NC}"
else
    echo -e "${RED}❌ $errors critical issues found${NC}"
fi

if [ $warnings -gt 0 ]; then
    echo -e "${YELLOW}⚠️  $warnings warnings found${NC}"
fi

echo ""
if [ $errors -eq 0 ]; then
    echo -e "${GREEN}✅ System is ready to run!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Start MongoDB: mongod"
    echo "  2. Terminal 1: npm run dev"
    echo "  3. Terminal 2: npm run dev:backend"
    echo "  4. Visit: http://localhost:5173"
else
    echo -e "${RED}❌ Please fix the critical issues before running${NC}"
fi

exit $errors
