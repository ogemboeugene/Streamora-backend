const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId; // Password required only if not Google OAuth user
    },
    minlength: [6, 'Password must be at least 6 characters']
  },
  googleId: {
    type: String,
    sparse: true
  },
  avatar: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    },
    language: {
      type: String,
      default: 'en'
    },
    autoplay: {
      type: Boolean,
      default: true
    },
    quality: {
      type: String,
      enum: ['auto', '480p', '720p', '1080p'],
      default: 'auto'
    },
    subtitles: {
      type: Boolean,
      default: true
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      }
    }
  },
  watchHistory: [{
    contentId: {
      type: String,
      required: true
    },
    contentType: {
      type: String,
      enum: ['movie', 'tv', 'radio'],
      required: true
    },
    title: String,
    poster: String,
    watchedAt: {
      type: Date,
      default: Date.now
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    duration: Number
  }],
  favorites: [{
    contentId: {
      type: String,
      required: true
    },
    contentType: {
      type: String,
      enum: ['movie', 'tv', 'radio'],
      required: true
    },
    title: String,
    poster: String,
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  watchlist: [{
    contentId: {
      type: String,
      required: true
    },
    contentType: {
      type: String,
      enum: ['movie', 'tv', 'radio'],
      required: true
    },
    title: String,
    poster: String,
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  ratings: [{
    contentId: {
      type: String,
      required: true
    },
    contentType: {
      type: String,
      enum: ['movie', 'tv', 'radio'],
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 0.5,
      max: 5,
      validate: {
        validator: function(v) {
          return v % 0.5 === 0; // Only allow half-star ratings
        },
        message: 'Rating must be in 0.5 increments'
      }
    },
    title: String,
    poster: String,
    ratedAt: {
      type: Date,
      default: Date.now
    }
  }],
  lists: [{
    name: {
      type: String,
      required: true,
      maxlength: 100
    },
    description: {
      type: String,
      maxlength: 500
    },
    isPublic: {
      type: Boolean,
      default: false
    },
    items: [{
      contentId: {
        type: String,
        required: true
      },
      contentType: {
        type: String,
        enum: ['movie', 'tv', 'radio'],
        required: true
      },
      title: String,
      poster: String,
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  subscriptions: {
    plan: {
      type: String,
      enum: ['free', 'premium'],
      default: 'free'
    },
    expiresAt: Date,
    stripeCustomerId: String
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  loginCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ 'watchHistory.contentId': 1 });
userSchema.index({ 'favorites.contentId': 1 });
userSchema.index({ 'watchlist.contentId': 1 });
userSchema.index({ 'ratings.contentId': 1 });
userSchema.index({ 'lists.isPublic': 1 });
userSchema.index({ 'lists.name': 'text', 'lists.description': 'text' });

// Virtual for full name (if we add first/last name later)
userSchema.virtual('displayName').get(function() {
  return this.username;
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to add to watch history
userSchema.methods.addToWatchHistory = function(contentData) {
  // Remove existing entry if exists
  this.watchHistory = this.watchHistory.filter(
    item => item.contentId !== contentData.contentId
  );
  
  // Add to beginning of array
  this.watchHistory.unshift(contentData);
  
  // Keep only last 100 items
  if (this.watchHistory.length > 100) {
    this.watchHistory = this.watchHistory.slice(0, 100);
  }
  
  return this.save();
};

// Method to add to favorites
userSchema.methods.addToFavorites = function(contentData) {
  const exists = this.favorites.some(item => item.contentId === contentData.contentId);
  if (!exists) {
    this.favorites.push(contentData);
  }
  return this.save();
};

// Method to remove from favorites
userSchema.methods.removeFromFavorites = function(contentId) {
  this.favorites = this.favorites.filter(item => item.contentId !== contentId);
  return this.save();
};

// Method to add to watchlist
userSchema.methods.addToWatchlist = function(contentData) {
  const exists = this.watchlist.some(item => item.contentId === contentData.contentId);
  if (!exists) {
    this.watchlist.push(contentData);
  }
  return this.save();
};

// Method to remove from watchlist
userSchema.methods.removeFromWatchlist = function(contentId) {
  this.watchlist = this.watchlist.filter(item => item.contentId !== contentId);
  return this.save();
};

// Method to add/update rating
userSchema.methods.addRating = function(contentData) {
  // Remove existing rating if exists
  this.ratings = this.ratings.filter(item => item.contentId !== contentData.contentId);
  
  // Add new rating
  this.ratings.push({
    ...contentData,
    ratedAt: new Date()
  });
  
  return this.save();
};

// Method to remove rating
userSchema.methods.removeRating = function(contentId) {
  this.ratings = this.ratings.filter(item => item.contentId !== contentId);
  return this.save();
};

// Method to get user's rating for content
userSchema.methods.getRating = function(contentId) {
  const rating = this.ratings.find(item => item.contentId === contentId);
  return rating ? rating.rating : null;
};

// Method to create custom list
userSchema.methods.createList = function(listData) {
  this.lists.push({
    ...listData,
    items: [],
    createdAt: new Date(),
    updatedAt: new Date()
  });
  return this.save();
};

// Method to update list
userSchema.methods.updateList = function(listId, updateData) {
  const list = this.lists.id(listId);
  if (list) {
    Object.assign(list, updateData);
    list.updatedAt = new Date();
    return this.save();
  }
  throw new Error('List not found');
};

// Method to delete list
userSchema.methods.deleteList = function(listId) {
  this.lists.pull({ _id: listId });
  return this.save();
};

// Method to add item to list
userSchema.methods.addToList = function(listId, contentData) {
  const list = this.lists.id(listId);
  if (list) {
    const exists = list.items.some(item => item.contentId === contentData.contentId);
    if (!exists) {
      list.items.push({
        ...contentData,
        addedAt: new Date()
      });
      list.updatedAt = new Date();
      return this.save();
    }
  }
  throw new Error('List not found or item already exists');
};

// Method to remove item from list
userSchema.methods.removeFromList = function(listId, contentId) {
  const list = this.lists.id(listId);
  if (list) {
    list.items = list.items.filter(item => item.contentId !== contentId);
    list.updatedAt = new Date();
    return this.save();
  }
  throw new Error('List not found');
};

// Method to get user stats
userSchema.methods.getStats = function() {
  const avgRating = this.ratings.length > 0 
    ? this.ratings.reduce((sum, item) => sum + item.rating, 0) / this.ratings.length 
    : 0;

  return {
    watchHistoryCount: this.watchHistory.length,
    favoritesCount: this.favorites.length,
    watchlistCount: this.watchlist.length,
    ratingsCount: this.ratings.length,
    listsCount: this.lists.length,
    averageRating: Math.round(avgRating * 10) / 10,
    totalWatchTime: this.watchHistory.reduce((total, item) => {
      return total + (item.duration * (item.progress / 100) || 0);
    }, 0),
    joinedDate: this.createdAt,
    lastActive: this.lastLogin
  };
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.__v;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);
