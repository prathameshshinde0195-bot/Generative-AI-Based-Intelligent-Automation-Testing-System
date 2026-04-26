import User from '../models/User.js';
import { generateToken } from '../utils/jwt.js';
import { ValidationError, AuthenticationError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { ensureDefaultProject } from './projectService.js';

export const register = async (userData) => {
  const { name, email, password, company, department } = userData;

  // Validation
  if (!email || !password || !name) {
    throw new ValidationError('Name, email, and password are required');
  }

  if (password.length < 6) {
    throw new ValidationError('Password must be at least 6 characters');
  }

  // Check if user exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ValidationError('User with this email already exists');
  }

  // Create user
  const user = new User({
    name,
    email,
    password,
    company,
    department,
  });

  await user.save();
  await ensureDefaultProject(user._id);

  const token = generateToken(user._id);

  logger.info(`User registered: ${email}`);

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    token,
  };
};

export const login = async (email, password) => {
  if (!email || !password) {
    throw new ValidationError('Email and password are required');
  }

  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    throw new AuthenticationError('Invalid email or password');
  }

  const isPasswordValid = await user.matchPassword(password);

  if (!isPasswordValid) {
    throw new AuthenticationError('Invalid email or password');
  }

  if (!user.isActive) {
    throw new AuthenticationError('Your account has been deactivated');
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  const token = generateToken(user._id);

  logger.info(`User logged in: ${email}`);

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      preferences: user.preferences,
    },
    token,
  };
};

export const getProfile = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  return user;
};

export const updateProfile = async (userId, updateData) => {
  const { name, company, department, preferences } = updateData;

  const user = await User.findByIdAndUpdate(
    userId,
    {
      ...(name && { name }),
      ...(company && { company }),
      ...(department && { department }),
      ...(preferences && { preferences }),
    },
    { new: true, runValidators: true }
  );

  logger.info(`User profile updated: ${user.email}`);

  return user;
};

export const changePassword = async (userId, oldPassword, newPassword) => {
  const user = await User.findById(userId).select('+password');

  if (!user) {
    throw new Error('User not found');
  }

  const isPasswordValid = await user.matchPassword(oldPassword);

  if (!isPasswordValid) {
    throw new ValidationError('Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();

  logger.info(`Password changed for user: ${user.email}`);

  return { message: 'Password changed successfully' };
};
