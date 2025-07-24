const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import routes
let authRoutes, contentRoutes, userRoutes, adminRoutes, streamRoutes, searchRoutes;

try {
  authRoutes = require('./routes/auth');
  contentRoutes = require('./routes/content');
  userRoutes = require('./routes/user');
  adminRoutes = require('./routes/admin');
  streamRoutes = require('./routes/stream');
  searchRoutes = require('./routes/search');
} catch (error) {
  console.error('Error importing routes:', error);
  process.exit(1);
}

// Import middleware
let errorHandler, authMiddleware;

try {
  const errorModule = require('./middleware/errorHandler');
  errorHandler = errorModule.errorHandler;
  authMiddleware = require('./middleware/auth');
} catch (error) {
  console.error('Error importing middleware:', error);
  process.exit(1);
}

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// CORS configuration - Move this BEFORE security middleware
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Get allowed origins based on environment
    let allowedOrigins = [];
    
    if (process.env.NODE_ENV === 'production') {
      // In production, use ALLOWED_ORIGINS or CORS_ORIGIN
      const corsOrigins = process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '';
      allowedOrigins = corsOrigins.split(',').filter(Boolean);
      console.log('Production CORS origins:', allowedOrigins);
    } else {
      // In development, allow localhost and any specified origins
      allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001', 
        'http://127.0.0.1:3000',
        process.env.FRONTEND_URL
      ].filter(Boolean);
      
      // Also add any ALLOWED_ORIGINS or CORS_ORIGIN in development
      const corsOrigins = process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '';
      if (corsOrigins) {
        allowedOrigins.push(...corsOrigins.split(',').filter(Boolean));
      }
      console.log('Development CORS origins:', allowedOrigins);
    }
    
    // Check if the origin is allowed
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Log the rejected origin for debugging
    console.log(`CORS: Origin ${origin} not allowed. Allowed origins:`, allowedOrigins);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'Cache-Control', 'X-Access-Token']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "http://localhost:3000", "https://image.tmdb.org"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'", "https:"],
      imgSrc: ["'self'", "data:", "https:", "http://localhost:3000", "https://image.tmdb.org"],
      connectSrc: ["'self'", "https:", "wss:", "http://localhost:3000", "http://localhost:5000"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https:", "blob:"],
      frameSrc: ["'self'", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable COEP for video embedding
}));

// Trust proxy for rate limiting (development)
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  trustProxy: true
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Database connection
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/streamora';
console.log('Connecting to MongoDB:', mongoURI.includes('mongodb+srv') ? 'Atlas Cloud' : 'Local');

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB');
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error.message);
  console.log('💡 Make sure MongoDB is running locally or update MONGODB_URI in .env');
  console.log('🔗 For development, you can use MongoDB Atlas: https://www.mongodb.com/atlas');
  console.log('⚠️  Server will continue running without database connection');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/search', searchRoutes);

// Socket.IO for real-time features
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join room for watching together
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-joined', socket.id);
  });

  // Sync video playback
  socket.on('video-sync', (data) => {
    socket.to(data.roomId).emit('video-sync', data);
  });

  // Chat messages
  socket.on('chat-message', (data) => {
    socket.to(data.roomId).emit('chat-message', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});
