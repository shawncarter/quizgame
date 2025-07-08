/**
 * Socket Monitoring Service
 * Monitors Socket.io connections and provides utility functions for gathering metrics
 */

// Store for connection metrics
const metrics = {
  totalConnections: 0,
  activeConnections: 0,
  disconnections: 0,
  errors: 0,
  messagesSent: 0,
  messagesReceived: 0,
  avgLatency: 0, // in milliseconds
  connectionsByNamespace: new Map(),
  startTime: Date.now()
};

// Store for per-game metrics
const gameMetrics = new Map(); // Maps gameCode to game-specific metrics

// Store for cleanup
let loggingInterval = null;

/**
 * Initialize monitoring for a Socket.io server
 * @param {Server} io - Socket.io server instance
 */
function initializeMonitoring(io) {
  // Monitor server-wide events
  io.on('connection', (socket) => {
    incrementMetric('totalConnections');
    incrementMetric('activeConnections');
    
    // Track namespace-specific connections
    const namespace = socket.nsp.name;
    if (!metrics.connectionsByNamespace.has(namespace)) {
      metrics.connectionsByNamespace.set(namespace, 0);
    }
    metrics.connectionsByNamespace.set(
      namespace, 
      metrics.connectionsByNamespace.get(namespace) + 1
    );
    
    // Track disconnections
    socket.on('disconnect', (reason) => {
      incrementMetric('disconnections');
      decrementMetric('activeConnections');
      
      // Update namespace counts
      if (metrics.connectionsByNamespace.has(namespace)) {
        metrics.connectionsByNamespace.set(
          namespace, 
          Math.max(0, metrics.connectionsByNamespace.get(namespace) - 1)
        );
      }
      
      // Log reason for monitoring
      console.log(`Socket ${socket.id} disconnected: ${reason}`);
    });
    
    // Track errors
    socket.on('error', (error) => {
      incrementMetric('errors');
      console.error(`Socket ${socket.id} error:`, error);
    });
    
    // Track events for this socket
    const originalEmit = socket.emit;
    socket.emit = function(event, ...args) {
      incrementMetric('messagesSent');
      return originalEmit.apply(this, [event, ...args]);
    };
    
    const onevent = socket.onevent;
    socket.onevent = function(packet) {
      incrementMetric('messagesReceived');
      return onevent.call(this, packet);
    };
  });
  
  // Setup namespaces monitoring
  ['/', '/game', '/player', '/host', '/admin', '/test'].forEach(namespace => {
    metrics.connectionsByNamespace.set(namespace, 0);
    
    const nsp = io.of(namespace);
    nsp.on('connection', (socket) => {
      // Game-specific monitoring
      if (namespace === '/game' || namespace === '/player' || namespace === '/host') {
        const gameCode = socket.gameSessionCode;
        if (gameCode) {
          initializeGameMetrics(gameCode);
          updateGameConnection(gameCode, 1);
          
          socket.on('disconnect', () => {
            updateGameConnection(gameCode, -1);
          });
        }
      }
    });
  });
  
  // Set up periodic logging
  loggingInterval = setInterval(() => {
    console.log('Socket.io Server Metrics:', getMetricsSummary());
  }, 60000); // Log every minute
}

/**
 * Initialize metrics for a specific game
 * @param {string} gameCode - Game session code
 */
function initializeGameMetrics(gameCode) {
  if (!gameMetrics.has(gameCode)) {
    gameMetrics.set(gameCode, {
      activeConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      startTime: Date.now()
    });
  }
}

/**
 * Update connection count for a game
 * @param {string} gameCode - Game session code
 * @param {number} increment - Value to add to connection count (1 or -1)
 */
function updateGameConnection(gameCode, increment) {
  if (gameMetrics.has(gameCode)) {
    const gameStat = gameMetrics.get(gameCode);
    gameStat.activeConnections = Math.max(0, gameStat.activeConnections + increment);
    
    // Clean up metrics for games with no connections after a while
    if (gameStat.activeConnections === 0) {
      setTimeout(() => {
        if (gameMetrics.has(gameCode) && 
            gameMetrics.get(gameCode).activeConnections === 0) {
          gameMetrics.delete(gameCode);
        }
      }, 300000); // Remove after 5 minutes of inactivity
    }
  }
}

/**
 * Increment a numeric metric
 * @param {string} name - Metric name
 * @param {number} value - Value to add (default: 1)
 */
function incrementMetric(name, value = 1) {
  if (typeof metrics[name] === 'number') {
    metrics[name] += value;
  }
}

/**
 * Decrement a numeric metric
 * @param {string} name - Metric name
 * @param {number} value - Value to subtract (default: 1)
 */
function decrementMetric(name, value = 1) {
  if (typeof metrics[name] === 'number') {
    metrics[name] = Math.max(0, metrics[name] - value);
  }
}

/**
 * Update latency measurement
 * @param {number} latency - New latency value in milliseconds
 */
function updateLatency(latency) {
  // Simple moving average
  metrics.avgLatency = (metrics.avgLatency * 0.95) + (latency * 0.05);
}

/**
 * Get a summary of current metrics
 * @returns {Object} Metrics summary
 */
function getMetricsSummary() {
  const namespaceStats = {};
  for (const [namespace, count] of metrics.connectionsByNamespace.entries()) {
    namespaceStats[namespace] = count;
  }
  
  // Calculate uptime
  const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);
  
  return {
    uptime,
    activeConnections: metrics.activeConnections,
    totalConnections: metrics.totalConnections,
    disconnections: metrics.disconnections,
    errors: metrics.errors,
    messagesSent: metrics.messagesSent,
    messagesReceived: metrics.messagesReceived,
    avgLatency: Math.round(metrics.avgLatency),
    connectionsByNamespace: namespaceStats,
    activeGames: gameMetrics.size,
    timestamp: Date.now()
  };
}

/**
 * Get metrics for a specific game
 * @param {string} gameCode - Game session code
 * @returns {Object|null} Game metrics or null if not found
 */
function getGameMetrics(gameCode) {
  if (gameMetrics.has(gameCode)) {
    const gameStat = gameMetrics.get(gameCode);
    return {
      ...gameStat,
      uptime: Math.floor((Date.now() - gameStat.startTime) / 1000),
      timestamp: Date.now()
    };
  }
  return null;
}

/**
 * Cleanup function for tests and shutdown
 */
function cleanup() {
  // Clear logging interval
  if (loggingInterval) {
    clearInterval(loggingInterval);
    loggingInterval = null;
  }

  // Reset metrics
  metrics.totalConnections = 0;
  metrics.activeConnections = 0;
  metrics.disconnections = 0;
  metrics.errors = 0;
  metrics.messagesSent = 0;
  metrics.messagesReceived = 0;
  metrics.avgLatency = 0;
  metrics.connectionsByNamespace.clear();
  metrics.startTime = Date.now();

  // Clear game metrics
  gameMetrics.clear();

  console.log('Socket monitoring cleanup completed');
}

module.exports = {
  initializeMonitoring,
  getMetricsSummary,
  getGameMetrics,
  updateLatency,
  cleanup
};
