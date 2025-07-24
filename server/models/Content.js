const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
  tmdbId: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  originalTitle: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['movie', 'tv', 'radio'],
    required: true
  },
  overview: {
    type: String,
    trim: true
  },
  genres: [{
    id: Number,
    name: String
  }],
  releaseDate: Date,
  runtime: Number, // in minutes
  rating: {
    tmdb: Number,
    imdb: Number,
    rottenTomatoes: Number
  },
  voteAverage: {
    type: Number,
    min: 0,
    max: 10
  },
  voteCount: {
    type: Number,
    default: 0
  },
  popularity: {
    type: Number,
    default: 0
  },
  adult: {
    type: Boolean,
    default: false
  },
  language: {
    type: String,
    default: 'en'
  },
  availableLanguages: [String],
  
  // Media URLs and metadata
  poster: {
    path: String,
    url: String
  },
  backdrop: {
    path: String,
    url: String
  },
  
  // Streaming sources
  sources: [{
    provider: {
      type: String,
      enum: ['youtube', 'vimeo', 'openMovieAPI', 'archive', 'custom'],
      required: true
    },
    url: {
      type: String,
      required: true
    },
    quality: {
      type: String,
      enum: ['240p', '360p', '480p', '720p', '1080p', 'auto'],
      default: 'auto'
    },
    type: {
      type: String,
      enum: ['direct', 'embed', 'stream'],
      default: 'embed'
    },
    language: {
      type: String,
      default: 'en'
    },
    subtitles: [{
      language: String,
      url: String,
      label: String
    }],
    isActive: {
      type: Boolean,
      default: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // TV Show specific fields
  seasons: [{
    seasonNumber: Number,
    episodeCount: Number,
    airDate: Date,
    overview: String,
    poster: String
  }],
  
  // Cast and crew
  cast: [{
    id: Number,
    name: String,
    character: String,
    profilePath: String,
    order: Number
  }],
  crew: [{
    id: Number,
    name: String,
    job: String,
    department: String,
    profilePath: String
  }],
  
  // Production details
  productionCompanies: [{
    id: Number,
    name: String,
    logoPath: String,
    originCountry: String
  }],
  productionCountries: [{
    iso31661: String,
    name: String
  }],
  spokenLanguages: [{
    iso6391: String,
    name: String
  }],
  
  // External IDs
  externalIds: {
    imdbId: String,
    tvdbId: String,
    facebookId: String,
    instagramId: String,
    twitterId: String
  },
  
  // Metadata
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending', 'blocked'],
    default: 'active'
  },
  featured: {
    type: Boolean,
    default: false
  },
  trending: {
    type: Boolean,
    default: false
  },
  categories: [{
    type: String,
    enum: ['popular', 'trending', 'top_rated', 'upcoming', 'now_playing', 'on_air', 'airing_today']
  }],
  
  // Analytics
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  shares: {
    type: Number,
    default: 0
  },
  
  // Cache control
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  cacheExpiry: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
contentSchema.index({ tmdbId: 1 });
contentSchema.index({ type: 1 });
contentSchema.index({ 'genres.name': 1 });
contentSchema.index({ releaseDate: -1 });
contentSchema.index({ popularity: -1 });
contentSchema.index({ voteAverage: -1 });
contentSchema.index({ featured: 1 });
contentSchema.index({ trending: 1 });
contentSchema.index({ status: 1 });
contentSchema.index({ categories: 1 });
contentSchema.index({ title: 'text', overview: 'text' }); // Text search

// Virtual for formatted rating
contentSchema.virtual('formattedRating').get(function() {
  return this.voteAverage ? Math.round(this.voteAverage * 10) / 10 : 0;
});

// Virtual for year
contentSchema.virtual('year').get(function() {
  return this.releaseDate ? this.releaseDate.getFullYear() : null;
});

// Virtual for duration string
contentSchema.virtual('durationString').get(function() {
  if (!this.runtime) return null;
  const hours = Math.floor(this.runtime / 60);
  const minutes = this.runtime % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
});

// Method to increment views
contentSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Method to add source
contentSchema.methods.addSource = function(sourceData) {
  this.sources.push(sourceData);
  return this.save();
};

// Method to remove source
contentSchema.methods.removeSource = function(sourceId) {
  this.sources = this.sources.filter(source => source._id.toString() !== sourceId);
  return this.save();
};

// Method to get active sources
contentSchema.methods.getActiveSources = function() {
  return this.sources.filter(source => source.isActive);
};

// Method to check if content needs update
contentSchema.methods.needsUpdate = function() {
  return this.cacheExpiry < new Date();
};

// Static method to find trending content
contentSchema.statics.findTrending = function(limit = 20) {
  return this.find({ trending: true, status: 'active' })
    .sort({ popularity: -1 })
    .limit(limit);
};

// Static method to find featured content
contentSchema.statics.findFeatured = function(limit = 10) {
  return this.find({ featured: true, status: 'active' })
    .sort({ voteAverage: -1 })
    .limit(limit);
};

// Static method to find by genre
contentSchema.statics.findByGenre = function(genreName, limit = 20) {
  return this.find({ 
    'genres.name': { $regex: genreName, $options: 'i' },
    status: 'active'
  })
  .sort({ popularity: -1 })
  .limit(limit);
};

// Static method to search content
contentSchema.statics.searchContent = function(query, options = {}) {
  const {
    limit = 20,
    skip = 0,
    type = null,
    genre = null,
    year = null,
    sortBy = 'popularity'
  } = options;

  let searchQuery = {
    $text: { $search: query },
    status: 'active'
  };

  if (type) searchQuery.type = type;
  if (genre) searchQuery['genres.name'] = { $regex: genre, $options: 'i' };
  if (year) {
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year}-12-31`);
    searchQuery.releaseDate = { $gte: startDate, $lte: endDate };
  }

  let sortQuery = {};
  switch (sortBy) {
    case 'rating':
      sortQuery = { voteAverage: -1 };
      break;
    case 'date':
      sortQuery = { releaseDate: -1 };
      break;
    case 'popularity':
    default:
      sortQuery = { popularity: -1 };
  }

  return this.find(searchQuery)
    .sort(sortQuery)
    .skip(skip)
    .limit(limit);
};

module.exports = mongoose.model('Content', contentSchema);
