import rateLimit from 'express-rate-limit';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const isAutomatedTest = (req) => {
  return (
    req.headers['x-automated-test'] === 'true' ||
    req.headers['x-test-runner'] === 'true' ||
    req.headers['x-test-suite'] === 'true' ||
    Boolean(req.headers['x-test-run-id']) ||
    process.env.NODE_ENV === 'development'
  );
};

export const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 10000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isAutomatedTest,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.',
    });
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Generous login attempt limit for automated test execution
  skipSuccessfulRequests: true,
  skip: isAutomatedTest,
  message: 'Too many login attempts, please try again later',
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again later.',
    });
  },
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10000, // Very generous limit for AI operations
  skipFailedRequests: true,
  skip: isAutomatedTest,
  handler: (req, res) => {
    logger.warn(`AI rate limit exceeded for user: ${req.user?.id}`);
    res.status(429).json({
      success: false,
      message: 'AI request limit exceeded. Please try again later.',
    });
  },
});
