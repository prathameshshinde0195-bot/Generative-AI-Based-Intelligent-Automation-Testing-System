import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/database.js';
import config from './config/index.js';
import logger from './utils/logger.js';
import { errorHandler } from './middleware/error.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import { requestLogger, corsMiddleware, projectContext } from './middleware/common.js';

import authRoutes from './routes/authRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import testCaseRoutes from './routes/testCaseRoutes.js';
import requirementRoutes from './routes/requirementRoutes.js';
import testRunRoutes from './routes/testRunRoutes.js';
import healthRoutes from './routes/healthRoutes.js';

// Load environment variables
dotenv.config();

// Initialize Express application
const app = express();

// Database Connection
const connectDatabaseAsync = async () => {
  try {
    await connectDB();
  } catch (error) {
    logger.error(`Failed to connect to database: ${error.message}`);
    process.exit(1);
  }
};

connectDatabaseAsync();

// Middleware
app.use(corsMiddleware);
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow localhost on any port during development
      if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        callback(null, true);
      } else {
        callback(null, config.corsOrigin);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Project-Id', 'X-Request-Id'],
  })
);

app.use(requestLogger);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api', projectContext);

// Rate limiting
app.use('/api/', generalLimiter);

// Health Check Routes
app.use('/', healthRoutes);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/test-cases', testCaseRoutes);
app.use('/api/requirements', requirementRoutes);
app.use('/api/test-runs', testRunRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
});

// Global Error Handler
app.use(errorHandler);

// Start Server
const BASE_PORT = Number(config.port || 5000);
const MAX_PORT_ATTEMPTS = 10;
let server;

const startServer = (port, attempt = 0) => {
  server = app.listen(port, () => {
    logger.info(`✅ Server started successfully on port ${port}`);
    logger.info(`Environment: ${config.env}`);
    logger.info(`Database: ${process.env.MONGODB_URI}`);
  });

  server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
      const nextPort = port + 1;
      logger.warn(`Port ${port} is already in use. Retrying on port ${nextPort}...`);
      startServer(nextPort, attempt + 1);
      return;
    }

    logger.error(`Server startup failed: ${error.message}`);
    process.exit(1);
  });
};

startServer(BASE_PORT);

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  logger.error(`Unhandled Rejection: ${error.message}`);
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;
