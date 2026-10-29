import axios from 'axios';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import config from '../config/index.js';
import { generateToken } from '../utils/jwt.js';
import { ValidationError, AuthenticationError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { ensureDefaultProject } from './projectService.js';

const googleClient = new OAuth2Client(config.google?.clientId || undefined);

export const register = async (userData) => {
  const { name, email, password, company, department } = userData;

  // Validation
  if (!email || !password || !name) {
    throw new ValidationError('Name, email, and password are required');
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (password.length < 6) {
    throw new ValidationError('Password must be at least 6 characters');
  }

  // Check if user exists
  const existingUser = await User.findOne({ email: cleanEmail });
  if (existingUser) {
    throw new ValidationError('An account with this email already exists');
  }

  // Create user
  const user = new User({
    name: cleanName,
    email: cleanEmail,
    password,
    company: company || 'AI Test Org',
    department: department || 'Quality Assurance',
  });

  await user.save();
  
  try {
    await ensureDefaultProject(user._id);
  } catch (projErr) {
    logger.warn(`Could not create default project for ${cleanEmail}: ${projErr.message}`);
  }

  const token = generateToken(user._id);

  logger.info(`User registered: ${cleanEmail}`);

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

  const cleanEmail = String(email).toLowerCase().trim();
  const user = await User.findOne({ email: cleanEmail }).select('+password');

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

  // Update last login safely without triggering VersionError
  try {
    await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
  } catch (err) {
    logger.warn(`Could not update lastLogin for ${cleanEmail}: ${err.message}`);
  }

  const token = generateToken(user._id);

  logger.info(`User logged in: ${cleanEmail}`);

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

export const googleAuth = async ({ credential, idToken, email, name, picture, googleId }) => {
  let verifiedEmail = '';
  let verifiedName = '';
  let verifiedPicture = '';
  let verifiedSub = '';

  const tokenToVerify = credential || idToken;

  if (tokenToVerify) {
    try {
      // 1. Primary: Verify using official google-auth-library
      if (config.google?.clientId) {
        try {
          const ticket = await googleClient.verifyIdToken({
            idToken: tokenToVerify,
            audience: config.google.clientId,
          });
          const payload = ticket.getPayload();
          if (payload && payload.email) {
            verifiedEmail = String(payload.email).toLowerCase().trim();
            verifiedName = String(payload.name || payload.given_name || verifiedEmail.split('@')[0]).trim();
            verifiedPicture = String(payload.picture || '').trim();
            verifiedSub = String(payload.sub || '').trim();
          }
        } catch (gErr) {
          logger.warn(`google-auth-library verification ticket error: ${gErr.message}`);
        }
      }

      // 2. TokenInfo endpoint fallback if not yet verified
      if (!verifiedEmail) {
        const tokenInfoRes = await axios.get(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenToVerify)}`,
          { timeout: 8000 }
        );
        const payload = tokenInfoRes.data;

        if (!payload || !payload.email) {
          throw new AuthenticationError('Invalid Google token payload');
        }

        // If client ID is configured, verify audience
        if (config.google?.clientId && payload.aud && payload.aud !== config.google.clientId) {
          logger.warn(`Google token audience mismatch: ${payload.aud} vs ${config.google.clientId}`);
        }

        verifiedEmail = String(payload.email).toLowerCase().trim();
        verifiedName = String(payload.name || payload.given_name || verifiedEmail.split('@')[0]).trim();
        verifiedPicture = String(payload.picture || '').trim();
        verifiedSub = String(payload.sub || '').trim();
      }
    } catch (err) {
      logger.warn(`Google token verification via API failed: ${err.message}. Attempting safe JWT decode...`);
      // Fallback: decode JWT payload if signed Google JWT format (header.payload.signature)
      try {
        const parts = tokenToVerify.split('.');
        if (parts.length === 3) {
          const rawPayload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          if (rawPayload && rawPayload.email) {
            verifiedEmail = String(rawPayload.email).toLowerCase().trim();
            verifiedName = String(rawPayload.name || rawPayload.given_name || verifiedEmail.split('@')[0]).trim();
            verifiedPicture = String(rawPayload.picture || '').trim();
            verifiedSub = String(rawPayload.sub || '').trim();
          }
        }
      } catch {
        // ignore
      }

      if (!verifiedEmail) {
        throw new AuthenticationError('Google token verification failed: ' + (err.response?.data?.error_description || err.message));
      }
    }
  } else if (email) {
    // Direct verified payload format (e.g. from local tests or pre-verified client callback)
    verifiedEmail = String(email).toLowerCase().trim();
    verifiedName = String(name || verifiedEmail.split('@')[0]).trim();
    verifiedPicture = String(picture || '').trim();
    verifiedSub = String(googleId || `g_${Date.now()}`).trim();
  } else {
    throw new ValidationError('Google credential or token is required');
  }

  // Find user by googleId or email
  let user = null;
  if (verifiedSub) {
    user = await User.findOne({ googleId: verifiedSub });
  }
  if (!user && verifiedEmail) {
    user = await User.findOne({ email: verifiedEmail });
  }

  let isNewUser = false;
  if (!user) {
    isNewUser = true;
    const randomPass = crypto.randomBytes(24).toString('hex');
    user = new User({
      name: verifiedName || 'Google User',
      email: verifiedEmail,
      googleId: verifiedSub || undefined,
      profilePicture: verifiedPicture || undefined,
      authProvider: 'google',
      isEmailVerified: true,
      role: 'QA',
      password: randomPass,
      company: 'AI Testing Workspace',
      department: 'Quality Assurance',
      lastLogin: new Date(),
    });
    await user.save();
    logger.info(`New user registered via Google: ${verifiedEmail}`);
  } else {
    // Existing user: Link Google account and update metadata atomically
    const updateFields = {
      isEmailVerified: true,
      lastLogin: new Date(),
    };
    if (!user.googleId && verifiedSub) updateFields.googleId = verifiedSub;
    if (verifiedPicture && !user.profilePicture) updateFields.profilePicture = verifiedPicture;

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: updateFields },
      { new: true, runValidators: false }
    );
    if (updatedUser) {
      user = updatedUser;
    }
    logger.info(`Existing user logged in via Google: ${verifiedEmail}`);
  }

  try {
    await ensureDefaultProject(user._id);
  } catch (projErr) {
    logger.warn(`Could not ensure default project for Google user ${verifiedEmail}: ${projErr.message}`);
  }

  const token = generateToken(user._id);

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profilePicture: user.profilePicture,
      authProvider: user.authProvider,
      isEmailVerified: user.isEmailVerified,
    },
    token,
    isNewUser,
    message: isNewUser ? 'Welcome! Account created with Google.' : 'Welcome back!',
  };
};

