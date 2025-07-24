const express = require('express');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { catchAsync, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// ========== PROFILE MANAGEMENT ==========

// Get user profile
router.get('/profile', auth, catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  
  res.json({
    success: true,
    data: user
  });
}));

// Update user profile
router.put('/profile', auth, catchAsync(async (req, res) => {
  const { username, avatar, preferences } = req.body;
  
  const updateData = {};
  if (username) updateData.username = username;
  if (avatar !== undefined) updateData.avatar = avatar;
  if (preferences) updateData.preferences = preferences;
  
  // Check if username is already taken by another user
  if (username && username !== req.user.username) {
    const existingUser = await User.findOne({ username, _id: { $ne: req.user.id } });
    if (existingUser) {
      throw new AppError('Username already taken', 400);
    }
  }
  
  const user = await User.findByIdAndUpdate(
    req.user.id,
    updateData,
    { new: true, runValidators: true }
  ).select('-password');
  
  res.json({
    success: true,
    data: user,
    message: 'Profile updated successfully'
  });
}));

// Change password
router.put('/change-password', auth, catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    throw new AppError('Current password and new password are required', 400);
  }
  
  const user = await User.findById(req.user.id);
  
  // Verify current password
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    throw new AppError('Current password is incorrect', 400);
  }
  
  // Update password (will be hashed by pre-save middleware)
  user.password = newPassword;
  await user.save();
  
  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

// Delete account
router.delete('/account', auth, catchAsync(async (req, res) => {
  await User.findByIdAndDelete(req.user.id);
  
  res.json({
    success: true,
    message: 'Account deleted successfully'
  });
}));

// Get user's watch history
router.get('/watch-history', auth, catchAsync(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const user = await User.findById(req.user.id);

  const startIndex = (parseInt(page) - 1) * parseInt(limit);
  const endIndex = startIndex + parseInt(limit);
  
  const watchHistory = user.watchHistory.slice(startIndex, endIndex);
  const totalItems = user.watchHistory.length;

  res.json({
    success: true,
    data: watchHistory,
    pagination: {
      currentPage: parseInt(page),
      limit: parseInt(limit),
      totalItems,
      totalPages: Math.ceil(totalItems / parseInt(limit)),
      hasMore: endIndex < totalItems
    }
  });
}));

// Add to watch history
router.post('/watch-history', auth, catchAsync(async (req, res) => {
  const { contentId, contentType, title, poster, progress = 0, duration } = req.body;

  if (!contentId || !contentType || !title) {
    throw new AppError('Missing required fields: contentId, contentType, title', 400);
  }

  const user = await User.findById(req.user.id);
  await user.addToWatchHistory({
    contentId,
    contentType,
    title,
    poster,
    progress,
    duration
  });

  res.json({
    success: true,
    message: 'Added to watch history'
  });
}));

// Update watch progress
router.put('/watch-history/:contentId', auth, catchAsync(async (req, res) => {
  const { contentId } = req.params;
  const { progress, duration } = req.body;

  const user = await User.findById(req.user.id);
  
  const historyItem = user.watchHistory.find(item => item.contentId === contentId);
  if (historyItem) {
    historyItem.progress = progress || historyItem.progress;
    historyItem.duration = duration || historyItem.duration;
    historyItem.watchedAt = new Date();
    await user.save();
  }

  res.json({
    success: true,
    message: 'Watch progress updated'
  });
}));

// Clear watch history
router.delete('/watch-history', auth, catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);
  user.watchHistory = [];
  await user.save();

  res.json({
    success: true,
    message: 'Watch history cleared'
  });
}));

// Remove specific item from watch history
router.delete('/watch-history/:contentId', auth, catchAsync(async (req, res) => {
  const { contentId } = req.params;
  
  const user = await User.findById(req.user.id);
  user.watchHistory = user.watchHistory.filter(item => item.contentId !== contentId);
  await user.save();

  res.json({
    success: true,
    message: 'Item removed from watch history'
  });
}));

// Get user's favorites
router.get('/favorites', auth, catchAsync(async (req, res) => {
  const { page = 1, limit = 50, type } = req.query;
  const user = await User.findById(req.user.id);

  let favorites = user.favorites;
  
  // Filter by type if specified
  if (type) {
    favorites = favorites.filter(item => item.contentType === type);
  }

  const startIndex = (parseInt(page) - 1) * parseInt(limit);
  const endIndex = startIndex + parseInt(limit);
  
  const paginatedFavorites = favorites.slice(startIndex, endIndex);
  const totalItems = favorites.length;

  res.json({
    success: true,
    data: paginatedFavorites,
    pagination: {
      currentPage: parseInt(page),
      limit: parseInt(limit),
      totalItems,
      totalPages: Math.ceil(totalItems / parseInt(limit)),
      hasMore: endIndex < totalItems
    }
  });
}));

// Add to favorites
router.post('/favorites', auth, catchAsync(async (req, res) => {
  const { contentId, contentType, title, poster } = req.body;

  if (!contentId || !contentType || !title) {
    throw new AppError('Missing required fields: contentId, contentType, title', 400);
  }

  const user = await User.findById(req.user.id);
  
  // Check if already in favorites
  const exists = user.favorites.some(item => item.contentId === contentId);
  if (exists) {
    return res.status(400).json({
      success: false,
      message: 'Item already in favorites'
    });
  }

  await user.addToFavorites({
    contentId,
    contentType,
    title,
    poster
  });

  res.json({
    success: true,
    message: 'Added to favorites'
  });
}));

// Remove from favorites
router.delete('/favorites/:contentId', auth, catchAsync(async (req, res) => {
  const { contentId } = req.params;
  
  const user = await User.findById(req.user.id);
  await user.removeFromFavorites(contentId);

  res.json({
    success: true,
    message: 'Removed from favorites'
  });
}));

// Check if item is in favorites
router.get('/favorites/:contentId', auth, catchAsync(async (req, res) => {
  const { contentId } = req.params;
  
  const user = await User.findById(req.user.id);
  const isFavorite = user.favorites.some(item => item.contentId === contentId);

  res.json({
    success: true,
    data: { isFavorite }
  });
}));

// Get user's watchlist
router.get('/watchlist', auth, catchAsync(async (req, res) => {
  const { page = 1, limit = 50, type } = req.query;
  const user = await User.findById(req.user.id);

  let watchlist = user.watchlist;
  
  // Filter by type if specified
  if (type) {
    watchlist = watchlist.filter(item => item.contentType === type);
  }

  const startIndex = (parseInt(page) - 1) * parseInt(limit);
  const endIndex = startIndex + parseInt(limit);
  
  const paginatedWatchlist = watchlist.slice(startIndex, endIndex);
  const totalItems = watchlist.length;

  res.json({
    success: true,
    data: paginatedWatchlist,
    pagination: {
      currentPage: parseInt(page),
      limit: parseInt(limit),
      totalItems,
      totalPages: Math.ceil(totalItems / parseInt(limit)),
      hasMore: endIndex < totalItems
    }
  });
}));

// Add to watchlist
router.post('/watchlist', auth, catchAsync(async (req, res) => {
  const { contentId, contentType, title, poster } = req.body;

  if (!contentId || !contentType || !title) {
    throw new AppError('Missing required fields: contentId, contentType, title', 400);
  }

  const user = await User.findById(req.user.id);
  
  // Check if already in watchlist
  const exists = user.watchlist.some(item => item.contentId === contentId);
  if (exists) {
    return res.status(400).json({
      success: false,
      message: 'Item already in watchlist'
    });
  }

  await user.addToWatchlist({
    contentId,
    contentType,
    title,
    poster
  });

  res.json({
    success: true,
    message: 'Added to watchlist'
  });
}));

// Remove from watchlist
router.delete('/watchlist/:contentId', auth, catchAsync(async (req, res) => {
  const { contentId } = req.params;
  
  const user = await User.findById(req.user.id);
  await user.removeFromWatchlist(contentId);

  res.json({
    success: true,
    message: 'Removed from watchlist'
  });
}));

// Check if item is in watchlist
router.get('/watchlist/:contentId', auth, catchAsync(async (req, res) => {
  const { contentId } = req.params;
  
  const user = await User.findById(req.user.id);
  const isInWatchlist = user.watchlist.some(item => item.contentId === contentId);

  res.json({
    success: true,
    data: { isInWatchlist }
  });
}));

// ========== RATINGS MANAGEMENT ==========

// Get user's ratings
router.get('/ratings', auth, catchAsync(async (req, res) => {
  const { page = 1, limit = 50, type, sortBy = 'ratedAt' } = req.query;
  const user = await User.findById(req.user.id);

  let ratings = user.ratings;
  
  // Filter by type if specified
  if (type) {
    ratings = ratings.filter(item => item.contentType === type);
  }

  // Sort ratings
  ratings.sort((a, b) => {
    if (sortBy === 'rating') {
      return b.rating - a.rating;
    } else if (sortBy === 'ratedAt') {
      return new Date(b.ratedAt) - new Date(a.ratedAt);
    } else if (sortBy === 'title') {
      return a.title.localeCompare(b.title);
    }
    return 0;
  });

  const startIndex = (parseInt(page) - 1) * parseInt(limit);
  const endIndex = startIndex + parseInt(limit);
  
  const paginatedRatings = ratings.slice(startIndex, endIndex);
  const totalItems = ratings.length;

  res.json({
    success: true,
    data: paginatedRatings,
    pagination: {
      currentPage: parseInt(page),
      limit: parseInt(limit),
      totalItems,
      totalPages: Math.ceil(totalItems / parseInt(limit)),
      hasMore: endIndex < totalItems
    }
  });
}));

// Add or update rating
router.post('/ratings', auth, catchAsync(async (req, res) => {
  const { contentId, contentType, rating, title, poster } = req.body;

  if (!contentId || !contentType || !rating || !title) {
    throw new AppError('Missing required fields: contentId, contentType, rating, title', 400);
  }

  if (rating < 0.5 || rating > 5 || rating % 0.5 !== 0) {
    throw new AppError('Rating must be between 0.5 and 5 in 0.5 increments', 400);
  }

  const user = await User.findById(req.user.id);
  await user.addRating({
    contentId,
    contentType,
    rating,
    title,
    poster
  });

  res.json({
    success: true,
    message: 'Rating saved successfully'
  });
}));

// Get user's rating for specific content
router.get('/ratings/:contentId', auth, catchAsync(async (req, res) => {
  const { contentId } = req.params;
  
  const user = await User.findById(req.user.id);
  const rating = user.getRating(contentId);

  res.json({
    success: true,
    data: { rating }
  });
}));

// Remove rating
router.delete('/ratings/:contentId', auth, catchAsync(async (req, res) => {
  const { contentId } = req.params;
  
  const user = await User.findById(req.user.id);
  await user.removeRating(contentId);

  res.json({
    success: true,
    message: 'Rating removed successfully'
  });
}));

// ========== CUSTOM LISTS MANAGEMENT ==========

// Get user's custom lists
router.get('/lists', auth, catchAsync(async (req, res) => {
  const { includeItems = false } = req.query;
  const user = await User.findById(req.user.id);

  let lists = user.lists.map(list => {
    const listObj = list.toObject();
    if (!includeItems) {
      delete listObj.items;
    }
    listObj.itemCount = list.items.length;
    return listObj;
  });

  res.json({
    success: true,
    data: lists
  });
}));

// Get specific list with items
router.get('/lists/:listId', auth, catchAsync(async (req, res) => {
  const { listId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  
  const user = await User.findById(req.user.id);
  const list = user.lists.id(listId);

  if (!list) {
    throw new AppError('List not found', 404);
  }

  const startIndex = (parseInt(page) - 1) * parseInt(limit);
  const endIndex = startIndex + parseInt(limit);
  
  const paginatedItems = list.items.slice(startIndex, endIndex);
  const totalItems = list.items.length;

  res.json({
    success: true,
    data: {
      ...list.toObject(),
      items: paginatedItems,
      pagination: {
        currentPage: parseInt(page),
        limit: parseInt(limit),
        totalItems,
        totalPages: Math.ceil(totalItems / parseInt(limit)),
        hasMore: endIndex < totalItems
      }
    }
  });
}));

// Create new custom list
router.post('/lists', auth, catchAsync(async (req, res) => {
  const { name, description, isPublic = false } = req.body;

  if (!name) {
    throw new AppError('List name is required', 400);
  }

  const user = await User.findById(req.user.id);
  
  // Check if user already has a list with this name
  const existingList = user.lists.find(list => list.name.toLowerCase() === name.toLowerCase());
  if (existingList) {
    throw new AppError('You already have a list with this name', 400);
  }

  await user.createList({
    name,
    description,
    isPublic
  });

  res.json({
    success: true,
    message: 'List created successfully'
  });
}));

// Update list details
router.put('/lists/:listId', auth, catchAsync(async (req, res) => {
  const { listId } = req.params;
  const { name, description, isPublic } = req.body;

  const user = await User.findById(req.user.id);
  
  try {
    await user.updateList(listId, {
      name,
      description,
      isPublic
    });

    res.json({
      success: true,
      message: 'List updated successfully'
    });
  } catch (error) {
    throw new AppError(error.message, 404);
  }
}));

// Delete list
router.delete('/lists/:listId', auth, catchAsync(async (req, res) => {
  const { listId } = req.params;

  const user = await User.findById(req.user.id);
  
  try {
    await user.deleteList(listId);

    res.json({
      success: true,
      message: 'List deleted successfully'
    });
  } catch (error) {
    throw new AppError(error.message, 404);
  }
}));

// Add item to list
router.post('/lists/:listId/items', auth, catchAsync(async (req, res) => {
  const { listId } = req.params;
  const { contentId, contentType, title, poster } = req.body;

  if (!contentId || !contentType || !title) {
    throw new AppError('Missing required fields: contentId, contentType, title', 400);
  }

  const user = await User.findById(req.user.id);
  
  try {
    await user.addToList(listId, {
      contentId,
      contentType,
      title,
      poster
    });

    res.json({
      success: true,
      message: 'Item added to list successfully'
    });
  } catch (error) {
    throw new AppError(error.message, 400);
  }
}));

// Remove item from list
router.delete('/lists/:listId/items/:contentId', auth, catchAsync(async (req, res) => {
  const { listId, contentId } = req.params;

  const user = await User.findById(req.user.id);
  
  try {
    await user.removeFromList(listId, contentId);

    res.json({
      success: true,
      message: 'Item removed from list successfully'
    });
  } catch (error) {
    throw new AppError(error.message, 404);
  }
}));

// Get user stats and analytics
router.get('/stats', auth, catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);
  const stats = user.getStats();

  // Calculate additional stats
  const genreStats = {};
  const typeStats = { movie: 0, tv: 0, radio: 0 };

  user.watchHistory.forEach(item => {
    typeStats[item.contentType] = (typeStats[item.contentType] || 0) + 1;
  });

  // Get most watched day of week
  const dayStats = {};
  user.watchHistory.forEach(item => {
    const day = new Date(item.watchedAt).getDay();
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
    dayStats[dayName] = (dayStats[dayName] || 0) + 1;
  });

  const mostWatchedDay = Object.keys(dayStats).reduce((a, b) => 
    dayStats[a] > dayStats[b] ? a : b, 'Monday'
  );

  // Calculate rating distribution
  const ratingDistribution = {};
  user.ratings.forEach(item => {
    const rating = item.rating.toString();
    ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
  });

  // Calculate watching streak
  const today = new Date();
  let streakDays = 0;
  const sortedHistory = user.watchHistory
    .sort((a, b) => new Date(b.watchedAt) - new Date(a.watchedAt));

  for (let i = 0; i < sortedHistory.length; i++) {
    const watchDate = new Date(sortedHistory[i].watchedAt);
    const daysDiff = Math.floor((today - watchDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === streakDays) {
      streakDays++;
    } else {
      break;
    }
  }

  res.json({
    success: true,
    data: {
      ...stats,
      typeBreakdown: typeStats,
      genrePreferences: genreStats,
      mostWatchedDay,
      ratingDistribution,
      streakDays,
      // Monthly activity for the last 12 months
      monthlyActivity: generateMonthlyActivity(user.watchHistory),
      topRatedContent: user.ratings
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 5),
      publicListsCount: user.lists.filter(list => list.isPublic).length
    }
  });
}));

// Helper function to generate monthly activity data
function generateMonthlyActivity(watchHistory) {
  const monthlyData = {};
  const now = new Date();
  
  // Initialize last 12 months
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[key] = 0;
  }
  
  // Count watch history by month
  watchHistory.forEach(item => {
    const date = new Date(item.watchedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyData.hasOwnProperty(key)) {
      monthlyData[key]++;
    }
  });
  
  return Object.entries(monthlyData).map(([month, count]) => ({
    month,
    count
  }));
}

// Get personalized recommendations
router.get('/recommendations', auth, catchAsync(async (req, res) => {
  const { limit = 20 } = req.query;
  const user = await User.findById(req.user.id);

  // This is a simple recommendation system
  // In a real app, this would be much more sophisticated
  
  const recommendations = {
    continueWatching: user.watchHistory
      .filter(item => item.progress > 0 && item.progress < 90)
      .slice(0, 10)
      .map(item => ({
        ...item,
        reason: 'Continue watching'
      })),
    
    basedOnFavorites: [],
    trending: [],
    newReleases: []
  };

  // Simple "because you liked" recommendations
  if (user.favorites.length > 0) {
    // In a real app, this would use the TMDB "similar" endpoint
    // or a more sophisticated recommendation algorithm
    const favoriteTypes = user.favorites.reduce((acc, item) => {
      acc[item.contentType] = (acc[item.contentType] || 0) + 1;
      return acc;
    }, {});

    const preferredType = Object.keys(favoriteTypes).reduce((a, b) => 
      favoriteTypes[a] > favoriteTypes[b] ? a : b
    );

    recommendations.basedOnFavorites = user.favorites
      .filter(item => item.contentType === preferredType)
      .slice(0, 5)
      .map(item => ({
        ...item,
        reason: `Because you liked ${item.title}`
      }));
  }

  res.json({
    success: true,
    data: recommendations
  });
}));

// Export user data (GDPR compliance)
router.get('/export', auth, catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);

  const exportData = {
    profile: {
      username: user.username,
      email: user.email,
      joinDate: user.createdAt,
      lastLogin: user.lastLogin,
      preferences: user.preferences
    },
    watchHistory: user.watchHistory,
    favorites: user.favorites,
    watchlist: user.watchlist,
    ratings: user.ratings,
    customLists: user.lists,
    stats: user.getStats(),
    exportDate: new Date().toISOString()
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="streamora-data-${user.username}-${Date.now()}.json"`);
  
  res.json(exportData);
}));

module.exports = router;
