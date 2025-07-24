const express = require('express');
const Content = require('../models/Content');
const RadioStation = require('../models/RadioStation');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');
const { catchAsync, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Apply auth middleware to all admin routes
router.use(auth);
router.use(adminAuth);

// Dashboard stats
router.get('/dashboard', catchAsync(async (req, res) => {
  const [
    totalUsers,
    totalContent,
    totalRadioStations,
    activeUsers,
    recentUsers,
    topContent
  ] = await Promise.all([
    User.countDocuments(),
    Content.countDocuments(),
    RadioStation.countDocuments(),
    User.countDocuments({ lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
    User.find().sort({ createdAt: -1 }).limit(10).select('username email createdAt lastLogin'),
    Content.find().sort({ views: -1 }).limit(10).select('title type views rating')
  ]);

  const stats = {
    users: {
      total: totalUsers,
      active: activeUsers,
      growth: 0 // Calculate growth rate
    },
    content: {
      total: totalContent,
      movies: await Content.countDocuments({ type: 'movie' }),
      tv: await Content.countDocuments({ type: 'tv' }),
      radio: totalRadioStations
    },
    engagement: {
      totalViews: await Content.aggregate([
        { $group: { _id: null, total: { $sum: '$views' } } }
      ]).then(result => result[0]?.total || 0),
      averageRating: await Content.aggregate([
        { $group: { _id: null, avg: { $avg: '$voteAverage' } } }
      ]).then(result => result[0]?.avg || 0)
    },
    recent: {
      users: recentUsers,
      content: topContent
    }
  };

  res.json({
    success: true,
    data: stats
  });
}));

// User management
router.get('/users', catchAsync(async (req, res) => {
  const { page = 1, limit = 50, search, role, status } = req.query;

  const query = {};
  
  if (search) {
    query.$or = [
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (role) query.role = role;
  if (status === 'active') query.isActive = true;
  if (status === 'inactive') query.isActive = false;

  const users = await User.find(query)
    .select('-password')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await User.countDocuments(query);

  res.json({
    success: true,
    data: users,
    pagination: {
      currentPage: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalUsers: total
    }
  });
}));

// Update user role
router.put('/users/:userId/role', catchAsync(async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  if (!['user', 'admin', 'moderator'].includes(role)) {
    throw new AppError('Invalid role', 400);
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { role },
    { new: true }
  ).select('-password');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({
    success: true,
    message: `User role updated to ${role}`,
    data: user
  });
}));

// Deactivate/activate user
router.put('/users/:userId/status', catchAsync(async (req, res) => {
  const { userId } = req.params;
  const { isActive } = req.body;

  const user = await User.findByIdAndUpdate(
    userId,
    { isActive },
    { new: true }
  ).select('-password');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({
    success: true,
    message: `User ${isActive ? 'activated' : 'deactivated'}`,
    data: user
  });
}));

// Content management
router.get('/content', catchAsync(async (req, res) => {
  const { page = 1, limit = 50, type, status, search } = req.query;

  const query = {};
  
  if (type) query.type = type;
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { overview: { $regex: search, $options: 'i' } }
    ];
  }

  const content = await Content.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Content.countDocuments(query);

  res.json({
    success: true,
    data: content,
    pagination: {
      currentPage: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalContent: total
    }
  });
}));

// Update content status
router.put('/content/:contentId/status', catchAsync(async (req, res) => {
  const { contentId } = req.params;
  const { status } = req.body;

  if (!['active', 'inactive', 'pending', 'blocked'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  const content = await Content.findByIdAndUpdate(
    contentId,
    { status },
    { new: true }
  );

  if (!content) {
    throw new AppError('Content not found', 404);
  }

  res.json({
    success: true,
    message: `Content status updated to ${status}`,
    data: content
  });
}));

// Toggle featured content
router.put('/content/:contentId/featured', catchAsync(async (req, res) => {
  const { contentId } = req.params;
  const { featured } = req.body;

  const content = await Content.findByIdAndUpdate(
    contentId,
    { featured },
    { new: true }
  );

  if (!content) {
    throw new AppError('Content not found', 404);
  }

  res.json({
    success: true,
    message: `Content ${featured ? 'featured' : 'unfeatured'}`,
    data: content
  });
}));

// Radio station management
router.get('/radio-stations', catchAsync(async (req, res) => {
  const { page = 1, limit = 50, search, country, genre } = req.query;

  const query = {};
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (country) query.country = country;
  if (genre) query.genre = { $in: [genre] };

  const stations = await RadioStation.find(query)
    .sort({ listeners: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await RadioStation.countDocuments(query);

  res.json({
    success: true,
    data: stations,
    pagination: {
      currentPage: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalStations: total
    }
  });
}));

// Add radio station
router.post('/radio-stations', catchAsync(async (req, res) => {
  const stationData = req.body;
  
  const station = new RadioStation(stationData);
  await station.save();

  res.status(201).json({
    success: true,
    message: 'Radio station added successfully',
    data: station
  });
}));

// Update radio station
router.put('/radio-stations/:stationId', catchAsync(async (req, res) => {
  const { stationId } = req.params;
  const updateData = req.body;

  const station = await RadioStation.findByIdAndUpdate(
    stationId,
    updateData,
    { new: true, runValidators: true }
  );

  if (!station) {
    throw new AppError('Radio station not found', 404);
  }

  res.json({
    success: true,
    message: 'Radio station updated successfully',
    data: station
  });
}));

// Delete radio station
router.delete('/radio-stations/:stationId', catchAsync(async (req, res) => {
  const { stationId } = req.params;

  const station = await RadioStation.findByIdAndDelete(stationId);

  if (!station) {
    throw new AppError('Radio station not found', 404);
  }

  res.json({
    success: true,
    message: 'Radio station deleted successfully'
  });
}));

// System analytics
router.get('/analytics', catchAsync(async (req, res) => {
  const { period = '7d' } = req.query;
  
  // Calculate date range
  const now = new Date();
  let startDate;
  
  switch (period) {
    case '1d':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const analytics = {
    users: {
      newUsers: await User.countDocuments({
        createdAt: { $gte: startDate }
      }),
      activeUsers: await User.countDocuments({
        lastLogin: { $gte: startDate }
      }),
      totalUsers: await User.countDocuments()
    },
    content: {
      totalViews: await Content.aggregate([
        { $group: { _id: null, total: { $sum: '$views' } } }
      ]).then(result => result[0]?.total || 0),
      mostViewed: await Content.find()
        .sort({ views: -1 })
        .limit(10)
        .select('title type views'),
      contentByType: await Content.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            totalViews: { $sum: '$views' }
          }
        }
      ])
    },
    engagement: {
      averageSessionTime: 0, // Would need to track this
      topGenres: await Content.aggregate([
        { $unwind: '$genres' },
        {
          $group: {
            _id: '$genres.name',
            count: { $sum: 1 },
            totalViews: { $sum: '$views' }
          }
        },
        { $sort: { totalViews: -1 } },
        { $limit: 10 }
      ])
    }
  };

  res.json({
    success: true,
    data: analytics,
    period
  });
}));

// System settings
router.get('/settings', catchAsync(async (req, res) => {
  // In a real app, these would be stored in a settings collection
  const settings = {
    site: {
      name: 'Streamora',
      description: 'Free Streaming Platform',
      logo: '/logo.png',
      favicon: '/favicon.ico'
    },
    features: {
      registration: true,
      guestAccess: true,
      socialLogin: true,
      ratings: true,
      comments: false
    },
    limits: {
      maxWatchHistory: 100,
      maxFavorites: 500,
      maxWatchlist: 200
    },
    api: {
      tmdbEnabled: !!process.env.TMDB_API_KEY,
      youtubeEnabled: !!process.env.YOUTUBE_API_KEY,
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 100
      }
    }
  };

  res.json({
    success: true,
    data: settings
  });
}));

// Update system settings
router.put('/settings', catchAsync(async (req, res) => {
  const settings = req.body;
  
  // In a real app, this would update a settings collection
  // For now, we'll just return the updated settings
  
  res.json({
    success: true,
    message: 'Settings updated successfully',
    data: settings
  });
}));

// Clear cache
router.post('/cache/clear', catchAsync(async (req, res) => {
  // In a real app with Redis, this would clear the cache
  // For now, we'll just return a success message
  
  res.json({
    success: true,
    message: 'Cache cleared successfully'
  });
}));

// Export data
router.get('/export/:type', catchAsync(async (req, res) => {
  const { type } = req.params;
  
  let data;
  let filename;
  
  switch (type) {
    case 'users':
      data = await User.find().select('-password');
      filename = `users-export-${Date.now()}.json`;
      break;
    case 'content':
      data = await Content.find();
      filename = `content-export-${Date.now()}.json`;
      break;
    case 'radio':
      data = await RadioStation.find();
      filename = `radio-stations-export-${Date.now()}.json`;
      break;
    default:
      throw new AppError('Invalid export type', 400);
  }
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  
  res.json({
    exportDate: new Date().toISOString(),
    type,
    count: data.length,
    data
  });
}));

module.exports = router;
