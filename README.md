# 🧠 Generative AI-Based Intelligent Automation Testing System

A **production-ready** full-stack web application that leverages Generative AI to revolutionize software testing and QA automation.

![Status](https://img.shields.io/badge/status-production--ready-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)
![React](https://img.shields.io/badge/React-19-blue)

## ✨ Features

### 🎯 Core Testing Modules (10+ Features)

1. **SRS to Test Cases** - AI converts requirements to structured, executable test cases
2. **Ambiguity Detection** - Identifies vague language and suggests clarifications
3. **Test Prioritization** - ML-based intelligent prioritization (High/Medium/Low)
4. **Automation Script Generator** - Generates ready-to-run scripts (Selenium, Cypress, Playwright)
5. **Traceability Matrix** - Maps requirements to test cases with coverage metrics
6. **Duplicate Detection** - Finds and flags similar test cases with similarity %
7. **Negative & Edge Cases** - Auto-generates boundary and error handling tests
8. **Coverage Analyzer** - Shows requirement coverage with visual graphs
9. **Risk Assessment** - Security, performance, and functional risk scoring
10. **CI/CD API** - RESTful endpoints for integration with CI/CD pipelines

### 🎨 UI/UX Excellence

- ✅ Dark/Light theme toggle
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Smooth animations and transitions
- ✅ Professional gradient colors (Indigo to Blue)
- ✅ Interactive charts and analytics
- ✅ Toast notifications
- ✅ Skeleton loading animations
- ✅ Clean typography

## 🚀 Quick Start

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for complete setup instructions.

```bash
# Install dependencies
npm install
npm run backend:install

# Start development servers
npm run dev:all

# Access at http://localhost:5173
```

Safe startup and quality gates:

```bash
# Validate required ports then boot frontend+backend
npm run dev:safe

# Pre-commit/CI safety
npm run check:secrets
npm run lint
npm run typecheck
```

## 🌍 Free Deployment (Vercel + Render)

- **Frontend (Vercel)**:
  - Set `VITE_API_URL` to your backend URL + `/api`
  - SPA routing handled by `vercel.json`
- **Backend (Render free)**:
  - Deploy `server` as a Node web service
  - Use MongoDB Atlas free cluster for `MONGODB_URI`
  - Set `CORS_ORIGIN` to your Vercel domain
  - Keep `ALLOW_TEST_RUN_COMMANDS=false` in hosted environments

See `SETUP_GUIDE.md` for step-by-step deployment.

## 📚 Documentation

- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Complete installation & deployment guide
- **[API Documentation](#-api-endpoints)** - All API endpoints
- **[Architecture](#-architecture)** - System architecture

## 🏗 Architecture

### Frontend: React 19 + TypeScript + Tailwind CSS
- Modern component-based UI
- Zustand state management
- Axios API client
- Framer Motion animations

### Backend: Node.js + Express.js + MongoDB
- RESTful API with JWT auth
- MongoDB with Mongoose ODM
- Winston logger
- Rate limiting

## 🔑 API Endpoints

Full API documentation in [SETUP_GUIDE.md](./SETUP_GUIDE.md#-api-endpoints)

## 🧪 Testing

```bash
npm test
cd server && npm test
```

## 🚢 Deployment

See [SETUP_GUIDE.md](./SETUP_GUIDE.md#-deployment) for:
- Docker deployment
- Vercel/Railway deployment
- Production build configuration

## 🤝 Contributing

Contributions welcome! Please create a feature branch and submit a pull request.

## 📄 License

MIT License - See [LICENSE](./LICENSE)

**For complete documentation, setup instructions, and deployment guide, see [SETUP_GUIDE.md](./SETUP_GUIDE.md)**
