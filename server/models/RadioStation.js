const mongoose = require('mongoose');

const radioStationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  streamUrl: {
    type: String,
    required: true
  },
  website: String,
  logo: String,
  genre: {
    type: [String],
    default: []
  },
  language: {
    type: String,
    default: 'en'
  },
  country: String,
  city: String,
  bitrate: Number,
  codec: {
    type: String,
    enum: ['mp3', 'aac', 'ogg', 'flac'],
    default: 'mp3'
  },
  listeners: {
    type: Number,
    default: 0
  },
  maxListeners: Number,
  isActive: {
    type: Boolean,
    default: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  tags: [String],
  social: {
    facebook: String,
    twitter: String,
    instagram: String
  },
  contact: {
    email: String,
    phone: String
  },
  schedule: [{
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    },
    startTime: String,
    endTime: String,
    program: String,
    host: String
  }],
  stats: {
    totalListeners: {
      type: Number,
      default: 0
    },
    peakListeners: {
      type: Number,
      default: 0
    },
    averageListenTime: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  suppressReservedKeysWarning: true
});

// Indexes
radioStationSchema.index({ name: 'text', description: 'text' });
radioStationSchema.index({ genre: 1 });
radioStationSchema.index({ country: 1 });
radioStationSchema.index({ language: 1 });
radioStationSchema.index({ isActive: 1 });
radioStationSchema.index({ featured: 1 });

module.exports = mongoose.model('RadioStation', radioStationSchema);
