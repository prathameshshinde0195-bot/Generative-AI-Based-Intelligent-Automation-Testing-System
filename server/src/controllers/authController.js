import * as authService from '../services/authService.js';
import { catchAsync } from '../middleware/error.js';
import logger from '../utils/logger.js';

export const register = catchAsync(async (req, res) => {
  const result = await authService.register(req.body);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: result,
  });
});

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);

  res.status(200).json({
    success: true,
    message: 'Logged in successfully',
    data: result,
  });
});

export const getProfile = catchAsync(async (req, res) => {
  const user = await authService.getProfile(req.user.id);

  res.status(200).json({
    success: true,
    data: user,
  });
});

export const updateProfile = catchAsync(async (req, res) => {
  const user = await authService.updateProfile(req.user.id, req.body);

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: user,
  });
});

export const changePassword = catchAsync(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const result = await authService.changePassword(req.user.id, oldPassword, newPassword);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});

export const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  const result = await authService.forgotPassword(email);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});

export const resetPassword = catchAsync(async (req, res) => {
  const { token, newPassword } = req.body;
  const result = await authService.resetPassword(token, newPassword);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});

export const verifyEmail = catchAsync(async (req, res) => {
  const token = req.params.token || req.body.token || req.query.token;
  const result = await authService.verifyEmail(token);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});

export const logout = catchAsync(async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

export const googleLogin = catchAsync(async (req, res) => {
  const result = await authService.googleAuth(req.body);

  res.status(200).json({
    success: true,
    message: result.message || 'Authenticated successfully with Google',
    data: result,
  });
});
