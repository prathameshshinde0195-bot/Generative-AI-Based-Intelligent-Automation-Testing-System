import { verifyToken } from '../utils/jwt.js';
import User from '../models/User.js';
import { AuthenticationError, AuthorizationError } from '../utils/errors.js';
import logger from '../utils/logger.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new AuthenticationError('No token provided');
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id);

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    if (!user.isActive) {
      throw new AuthenticationError('User account is inactive');
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error(`Authentication error: ${error.message}`);
    res.status(401).json({
      success: false,
      message: error.message || 'Authentication failed',
    });
  }
};

export const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AuthenticationError('User not authenticated');
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
        throw new AuthorizationError(`Only ${allowedRoles.join(', ')} users can access this resource`);
      }

      next();
    } catch (error) {
      logger.error(`Authorization error: ${error.message}`);
      res.status(403).json({
        success: false,
        message: error.message,
      });
    }
  };
};

export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.id);
      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    logger.warn(`Optional auth failed: ${error.message}`);
    next();
  }
};
