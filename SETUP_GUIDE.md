# Generative AI-Based Intelligent Automation Testing System - Setup Guide

## 📋 Prerequisites

- **Node.js**: v18+ (Download from [nodejs.org](https://nodejs.org))
- **MongoDB**: Local installation or MongoDB Atlas account
- **PostgreSQL** (Optional): For advanced data management
- **Git**: For version control
- **OpenAI API Key** (Optional): For advanced AI features

## 🚀 Quick Start

### 1. **Clone or Extract Project**

```bash
cd d:\projects\genai-testing-system_demo
```

### 2. **Install Frontend Dependencies**

```bash
npm install
```

### 3. **Install Backend Dependencies**

```bash
npm run backend:install
```

### 4. **Setup Backend Environment**

Edit `server/.env` with your configuration:

```env
PORT=5001
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/ai-testing-system

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_in_production_12345
JWT_EXPIRE=7d

# OpenAI Configuration (Optional)
OPENAI_API_KEY=your_openai_api_key_here
LLM_API_ENDPOINT=https://api.openai.com/v1

# CORS Configuration
CORS_ORIGIN=http://localhost:5174
```

### 5. **Setup Frontend Environment**

Create/Update `.env.local`:

```env
VITE_API_URL=http://localhost:5001/api
```

### 6. **Start MongoDB**

```bash
# Windows
net start MongoDB

# macOS (Homebrew)
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Or use Docker
docker run -d -p 27017:27017 --name mongodb mongo
```

### 7. **Start Development Servers**

**Option A: Start Both Servers Separately**

Terminal 1 - Frontend:
```bash
npm run dev
```
Visit: http://localhost:5173 (or the next available port)

Terminal 2 - Backend:
```bash
npm run dev:backend
```
Backend: http://localhost:5001

**Option B: Start Both Together**

```bash
npm run dev:all
```
(Requires `concurrently` package)

**Option C (Recommended): Safe Startup**

```bash
npm run dev:safe
```
This validates required ports first, then starts both servers.

## 📊 Default Login Credentials (First Time)

Create a user by registering in the UI, or manually seed the database:

```bash
# Backend directory
node scripts/seed-db.js
```

## ✨ Features Implemented

✅ **SRS to Test Cases** - Convert requirements to structured test cases  
✅ **Ambiguity Detection** - Detect vague language in requirements  
✅ **Test Prioritization** - AI-powered priority assignment  
✅ **Automation Script Generator** - Generate Selenium/Cypress/Playwright code  
✅ **Traceability Matrix** - Map requirements to test cases  
✅ **Duplicate Detection** - Find similar test cases  
✅ **Negative & Edge Cases** - Generate boundary testing scenarios  
✅ **Coverage Analysis** - Requirement coverage metrics  
✅ **Risk Assessment** - Security & performance risk scoring  
✅ **Dark/Light Theme** - Professional UI with theme toggle  
✅ **Authentication** - JWT-based login/register  
✅ **Export Options** - CSV, JSON, Excel export  
✅ **Dashboard** - Real-time analytics and KPIs  
✅ **Test Runs** - Command runs + Realtime TC checks (dataset variants + assertions)  
✅ **Metrics API** - Test-run analytics (`GET /api/metrics/test-runs`)  
✅ **CI Quality Gates** - GitHub Actions workflow (lint/typecheck/build + backend lint)  
✅ **Request Correlation** - `X-Request-Id` tracing + logs  

## 🗂️ Project Structure

```
genai-testing-system_demo/
├── src/                          # Frontend (React + TypeScript)
│   ├── components/               # React components
│   ├── lib/                      # Utilities, API clients, store
│   ├── assets/                   # Images, icons
│   ├── App.tsx                   # Main app component
│   └── index.css                 # Global styles
│
├── server/                       # Backend (Node.js + Express)
│   ├── src/
│   │   ├── models/              # Mongoose schemas
│   │   ├── controllers/         # Request handlers
│   │   ├── services/            # Business logic
│   │   ├── routes/              # API routes
│   │   ├── middleware/          # Express middleware
│   │   ├── config/              # Configuration
│   │   ├── utils/               # Utilities (JWT, LLM, Logger)
│   │   └── server.js            # Entry point
│   ├── .env                      # Environment variables
│   └── package.json              # Backend dependencies
│
├── package.json                  # Frontend dependencies
├── tsconfig.json                 # TypeScript config
└── vite.config.ts               # Vite configuration
```

## 🔑 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/logout` - Logout

### AI Features
- `POST /api/ai/generate-test-cases` - Generate test cases
- `POST /api/ai/detect-ambiguities` - Detect ambiguities
- `POST /api/ai/prioritize-test-cases` - Prioritize tests
- `POST /api/ai/generate-automation-script` - Generate scripts
- `POST /api/ai/detect-duplicates` - Find duplicates
- `GET /api/ai/traceability-matrix` - Get traceability
- `GET /api/ai/coverage-analysis` - Get coverage
- `POST /api/ai/assess-risk` - Assess risks
- `GET /api/ai/dashboard-metrics` - Get metrics

### Test Cases
- `GET /api/test-cases` - List test cases
- `POST /api/test-cases` - Create test case
- `PUT /api/test-cases/:id` - Update test case
- `DELETE /api/test-cases/:id` - Delete test case
- `GET /api/test-cases/export` - Export test cases

### Test Runs (Realtime + Command)
- `POST /api/test-runs` - Create run (`command` or `realtime-tc`)
- `GET /api/test-runs` - List runs
- `GET /api/test-runs/:runId` - Run details
- `GET /api/test-runs/:runId/stream` - SSE stream (token via query supported)
- `POST /api/test-runs/:runId/execute` - Execute run
- `POST /api/test-runs/:runId/cancel` - Cancel run

### Metrics
- `GET /api/metrics/test-runs` - Realtime run analytics (last 24h)

### Requirements
- `GET /api/requirements` - List requirements
- `POST /api/requirements` - Create requirement
- `PUT /api/requirements/:id` - Update requirement
- `DELETE /api/requirements/:id` - Delete requirement

## 🔐 Security Features

- ✅ JWT Authentication
- ✅ Password Hashing (bcrypt)
- ✅ Role-Based Access Control (Admin, QA, Viewer)
- ✅ Rate Limiting
- ✅ CORS Protection
- ✅ Input Validation
- ✅ Error Handling

## 📈 Performance Optimizations

- ✅ Async/Await Structure
- ✅ MongoDB Indexing
- ✅ Lazy Component Loading
- ✅ Debounced Input Fields
- ✅ Efficient State Management (Zustand)
- ✅ Request Caching

## 🚢 Deployment

### Free Hosting (Recommended): Vercel (Frontend) + Render (Backend) + MongoDB Atlas

#### 1) Backend on Render (Free)
- Create a free MongoDB Atlas cluster and copy the connection string.
- In Render:
  - New → **Web Service**
  - Connect your GitHub repo
  - Root directory: `server`
  - Build command: `npm ci`
  - Start command: `npm start`
  - Set environment variables:
    - `MONGODB_URI` = Atlas connection string
    - `JWT_SECRET` = long secret
    - `JWT_EXPIRE` = `7d`
    - `CORS_ORIGIN` = your Vercel frontend URL (example: `https://your-app.vercel.app`)
    - `ALLOW_TEST_RUN_COMMANDS` = `false` (recommended for hosted environments)

You can also use the provided file `server/render.yaml` as a baseline.

#### 2) Frontend on Vercel (Free)
- Import the repo in Vercel.
- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`
- Set environment variable:
  - `VITE_API_URL` = `https://<your-render-backend>.onrender.com/api`

SPA routing is handled via `vercel.json`.

#### 3) Verify
- Open Vercel URL → signup/login should work
- Test backend health:
  - `GET https://<render-backend>.onrender.com/health`
- Test metrics:
  - `GET https://<render-backend>.onrender.com/api/metrics/test-runs`

### Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run backend:install
RUN npm run build
EXPOSE 3000 5000
CMD ["bash", "-c", "npm run dev:backend & npm run preview"]
```

Build and run:
```bash
docker build -t ai-testing-system .
docker run -p 3000:3000 -p 5000:5000 ai-testing-system
```

### Vercel (Frontend Only)

```bash
npm install -g vercel
vercel
```

### Render (Full Stack)

1. Connect GitHub repo
2. Create Web Service for backend (Node.js)
3. Create Static Site for frontend
4. Set environment variables in Render dashboard

### Railway

```bash
npm install -g railway
railway init
railway up
```

## 📝 Environment Variables Reference

### Frontend (.env.local)
```env
VITE_API_URL=http://localhost:5001/api
VITE_APP_NAME=AI Testing System
```

### Backend (.env)
```env
# Server
PORT=5001
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/ai-testing
MONGODB_USER=admin
MONGODB_PASSWORD=password

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRE=7d

# LLM/AI
OPENAI_API_KEY=sk-...
LLM_API_ENDPOINT=https://api.openai.com/v1

# Features
ENABLE_EMAIL_NOTIFICATIONS=false
ENABLE_WEBHOOKS=true
ENABLE_ANALYTICS=true

# CORS
CORS_ORIGIN=http://localhost:5174

# Logging
LOG_LEVEL=debug
```

## 🧪 Testing

### Run Tests

```bash
# Frontend quality gates
npm run lint
npm run typecheck
npm run build

# Backend quality gate
cd server && npm run lint

# Optional: environment hygiene (strict in CI)
npm run check:secrets
```

## 📚 Documentation

- **API Documentation**: See endpoints section above
- **Component Documentation**: Check individual component files
- **Database Schema**: See `server/src/models/` directory

## 🐛 Troubleshooting

### MongoDB Connection Error
```
MongoServerError: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution**: Start MongoDB or ensure it's running on port 27017

### CORS Error
```
Access to XMLHttpRequest blocked by CORS policy
```
**Solution**: Update `CORS_ORIGIN` in `.env` to match frontend URL

### API Key Error
```
OpenAI API key not configured
```
**Solution**: Add `OPENAI_API_KEY` to `.env` or use mock responses

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::5000
```
**Solution**: Kill process on port or change PORT in `.env`

## 📞 Support

For issues or questions:
1. Check troubleshooting section
2. Review error logs in `server/logs/`
3. Check API response messages
4. Verify environment variables

## 📄 License

MIT License - Free to use and modify

## 🎯 Next Steps

1. ✅ Setup and run the application
2. ✅ Create your first project
3. ✅ Import requirements or SRS document
4. ✅ Generate test cases using AI
5. ✅ Review and prioritize tests
6. ✅ Generate automation scripts
7. ✅ Export for your CI/CD pipeline

Enjoy testing with AI! 🚀
