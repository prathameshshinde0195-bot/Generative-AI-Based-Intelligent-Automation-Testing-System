import { randomUUID } from 'crypto';
import logger from '../utils/logger.js';

export const requestLogger = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || randomUUID();
  req.requestId = String(requestId);
  res.setHeader('X-Request-Id', req.requestId);

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`, {
      requestId: req.requestId,
      projectId: req.projectId || 'n/a',
      userId: req.user?.id || 'anonymous',
    });
  });
  next();
};

export const corsMiddleware = (req, res, next) => {
  // Allow localhost on any port in development
  const origin = req.headers.origin;
  if (origin && (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:5173');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Project-Id, X-Request-Id');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
};

export const projectContext = (req, _res, next) => {
  const headerProjectId = req.headers['x-project-id'];
  const projectId = headerProjectId || req.query?.projectId || req.body?.projectId;
  req.projectId = typeof projectId === 'string' && projectId.trim() ? projectId.trim() : 'default';
  next();
};
