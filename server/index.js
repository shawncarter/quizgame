const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const socketService = require('./services/socketService');
const routes = require('./routes');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const server = http.createServer(app);

// Set up Socket.io
const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174'];
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || origin === process.env.CLIENT_URL) {
        callback(null, true);
      } else {
        console.log('Not allowed by CORS:', origin);
        callback(null, true); // Allow all origins in development
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-auth-token']
  }
});

// Initialize Socket service
socketService.initialize(io);

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174'];
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin === process.env.CLIENT_URL) {
      callback(null, true);
    } else {
      console.log('Not allowed by CORS:', origin);
      callback(null, true); // Allow all origins in development
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-auth-token']
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
const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await connectDB();
  console.log(`Socket.io server ready for connections`);
});
