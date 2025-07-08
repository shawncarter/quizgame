const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const socketService = require('./services/socketService');
const routes = require('./routes');
const config = require('./config/config');

// Create Express app
const app = express();
const server = http.createServer(app);

// Set up Socket.io
const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // In development, allow all origins
      if (config.IS_DEVELOPMENT) {
        callback(null, true);
        return;
      }

      // In production, check against allowed origins
      if (config.CORS_ORIGINS.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log('Not allowed by CORS:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-auth-token', 'Origin']
  },
  // Add socket timeout configuration to prevent ping timeouts
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  connectTimeout: 45000, // 45 seconds
  transports: ['websocket', 'polling']
});

// Initialize Socket service
socketService.initialize(io);

// Make Socket.io instance available to routes
app.set('io', io);

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // In development, allow all origins
    if (config.IS_DEVELOPMENT) {
      callback(null, true);
      return;
    }

    // In production, check against allowed origins
    if (config.CORS_ORIGINS.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Not allowed by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-auth-token', 'Origin']
}));
app.use(express.json());

// Routes
app.use('/', routes);
app.get('/', (req, res) => {
  res.send('QuizGame API is running');
});

// Error handler middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
server.listen(config.PORT, '0.0.0.0', async () => {
  console.log(`Server running on port ${config.PORT}`);
  console.log(`Server accessible at: http://0.0.0.0:${config.PORT}`);
  console.log(`Local network access: http://192.168.0.87:${config.PORT}`);
  console.log(`Environment: ${config.NODE_ENV}`);
  console.log(`Client URL: ${config.CLIENT_URL}`);

  try {
    await connectDB();
    console.log(`Database connected`);
    console.log(`Socket.io server ready for connections`);
  } catch (err) {
    console.error('Failed to connect to database:', err.message);
    console.error('Please check your database configuration');
    process.exit(1);
  }
});
