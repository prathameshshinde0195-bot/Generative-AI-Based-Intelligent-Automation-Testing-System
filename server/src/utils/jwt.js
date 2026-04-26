import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { AuthenticationError } from './errors.js';

export const generateToken = (userId) => {
  return jwt.sign({ id: userId }, config.jwt.secret, {
    expiresIn: config.jwt.expire,
  });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    throw new AuthenticationError('Invalid or expired token');
  }
};

export const decodeToken = (token) => {
  return jwt.decode(token);
};
