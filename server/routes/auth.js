const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth, optionalAuth, generateToken, setTokenCookie } = require('../middleware/auth');
const { catchAsync, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Validation middleware
const validateRegistration = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Register user
router.post('/register', validateRegistration, catchAsync(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { username, email, password } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { username }]
  });

  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: existingUser.email === email ? 
        'Email already registered' : 
        'Username already taken'
    });
  }

  // Create new user
  const user = new User({
    username,
    email,
    password,
    isVerified: true // Auto-verify for demo purposes
  });

  await user.save();

  // Generate token
  const token = generateToken(user._id);
  setTokenCookie(res, token);

  // Update login stats
  user.lastLogin = new Date();
  user.loginCount += 1;
  await user.save();

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    token,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      preferences: user.preferences,
      stats: user.getStats()
    }
  });
}));

// Login user
router.post('/login', validateLogin, catchAsync(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email, password } = req.body;

  // Find user and include password for comparison
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }

  // Check if account is active
  if (!user.isActive) {
    return res.status(401).json({
      success: false,
      message: 'Account is deactivated. Please contact support.'
    });
  }

  // Compare password
  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }

  // Generate token
  const token = generateToken(user._id);
  setTokenCookie(res, token);

  // Update login stats
  user.lastLogin = new Date();
  user.loginCount += 1;
  await user.save();

  res.json({
    success: true,
    message: 'Login successful',
    token,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      preferences: user.preferences,
      stats: user.getStats()
    }
  });
}));

// Logout user
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Get current user
router.get('/me', optionalAuth, catchAsync(async (req, res) => {
  // If no user is authenticated, return null
  if (!req.user) {
    return res.json({
      success: true,
      user: null
    });
  }

  const user = await User.findById(req.user.id);

  res.json({
    success: true,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      preferences: user.preferences,
      watchHistory: user.watchHistory.slice(0, 20), // Latest 20
      favorites: user.favorites.slice(0, 50), // Latest 50
      watchlist: user.watchlist.slice(0, 50), // Latest 50
      stats: user.getStats()
    }
  });
}));

// Update user profile
router.put('/profile', auth, [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { username, email, avatar } = req.body;
  const user = await User.findById(req.user.id);

  // Check for duplicate username/email if changed
  if (username && username !== user.username) {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username already taken'
      });
    }
    user.username = username;
  }

  if (email && email !== user.email) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }
    user.email = email;
  }

  if (avatar !== undefined) {
    user.avatar = avatar;
  }

  await user.save();

  res.json({
    success: true,
    message: 'Profile updated successfully',
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      preferences: user.preferences
    }
  });
}));

// Update user preferences
router.put('/preferences', auth, catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);
  
  // Update preferences
  if (req.body.theme) user.preferences.theme = req.body.theme;
  if (req.body.language) user.preferences.language = req.body.language;
  if (req.body.autoplay !== undefined) user.preferences.autoplay = req.body.autoplay;
  if (req.body.quality) user.preferences.quality = req.body.quality;
  if (req.body.subtitles !== undefined) user.preferences.subtitles = req.body.subtitles;
  if (req.body.notifications) {
    user.preferences.notifications = { ...user.preferences.notifications, ...req.body.notifications };
  }

  await user.save();

  res.json({
    success: true,
    message: 'Preferences updated successfully',
    preferences: user.preferences
  });
}));

// Change password
router.put('/change-password', auth, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user.id).select('+password');

  // Verify current password
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  // Update password
  user.password = newPassword;
  await user.save();

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

// Delete account
router.delete('/account', auth, [
  body('password').notEmpty().withMessage('Password is required to delete account')
], catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { password } = req.body;
  const user = await User.findById(req.user.id).select('+password');

  // Verify password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(400).json({
      success: false,
      message: 'Incorrect password'
    });
  }

  // Soft delete - deactivate account
  user.isActive = false;
  user.email = `deleted_${Date.now()}_${user.email}`;
  user.username = `deleted_${Date.now()}_${user.username}`;
  await user.save();

  // Clear cookie
  res.clearCookie('token');

  res.json({
    success: true,
    message: 'Account deleted successfully'
  });
}));

// Verify token
router.get('/verify', auth, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role
    }
  });
});

module.exports = router;
