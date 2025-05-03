/**
 * Socket Rate Limiter
 * Implements rate limiting for Socket.io events to prevent abuse
 */

// Store for rate limiting data
const rateLimits = new Map(); // Maps socketId to event counters

// Default rate limits per event type
const DEFAULT_LIMITS = {
  'player:join': { maxRequests: 5, windowMs: 60000 }, // 5 requests per minute
  'player:leave': { maxRequests: 5, windowMs: 60000 },
  'player:buzzer': { maxRequests: 10, windowMs: 10000 }, // 10 requests per 10 seconds
  'player:answer': { maxRequests: 10, windowMs: 10000 },
  'player:ready': { maxRequests: 5, windowMs: 10000 },
  'chat:message': { maxRequests: 20, windowMs: 60000 }, // 20 messages per minute
  
  // Host events (less restrictive)
  'host:startGame': { maxRequests: 3, windowMs: 10000 },
  'host:nextQuestion': { maxRequests: 10, windowMs: 10000 },
  'host:endQuestion': { maxRequests: 10, windowMs: 10000 },
  'host:pauseGame': { maxRequests: 5, windowMs: 10000 },
  'host:resumeGame': { maxRequests: 5, windowMs: 10000 },
  'host:endGame': { maxRequests: 3, windowMs: 10000 },
  
  // Default for any other event
  'default': { maxRequests: 30, windowMs: 10000 } // 30 requests per 10 seconds
};

/**
 * Apply rate limiting to a socket event handler
 * @param {string} eventName - Name of the event
 * @param {Function} handler - Event handler function
 * @returns {Function} Rate-limited handler
 */
function rateLimitHandler(eventName, handler) {
  return function(socket, data) {
    const socketId = socket.id;
    
    // Get or create rate limit entry for this socket
    if (!rateLimits.has(socketId)) {
      rateLimits.set(socketId, new Map());
    }
    
    const socketLimits = rateLimits.get(socketId);
    
    // Get or create counter for this event
    if (!socketLimits.has(eventName)) {
      socketLimits.set(eventName, {
        count: 0,
        resetAt: Date.now() + (DEFAULT_LIMITS[eventName]?.windowMs || DEFAULT_LIMITS.default.windowMs)
      });
    }
    
    const counter = socketLimits.get(eventName);
    
    // Check if window has reset
    if (Date.now() > counter.resetAt) {
      counter.count = 0;
      counter.resetAt = Date.now() + (DEFAULT_LIMITS[eventName]?.windowMs || DEFAULT_LIMITS.default.windowMs);
    }
    
    // Increment counter
    counter.count++;
    
    // Check if limit exceeded
    const limit = DEFAULT_LIMITS[eventName] || DEFAULT_LIMITS.default;
    if (counter.count > limit.maxRequests) {
      return socket.emit('error', {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many ${eventName} requests. Please wait a moment before trying again.`,
        retryAfter: Math.ceil((counter.resetAt - Date.now()) / 1000) // seconds until reset
      });
    }
    
    // Call the original handler
    return handler(socket, data);
  };
}

/**
 * Clean up rate limit data for disconnected sockets
 * @param {string} socketId - ID of disconnected socket
 */
function cleanupRateLimits(socketId) {
  rateLimits.delete(socketId);
}

/**
 * Get current rate limit status for a socket and event
 * @param {string} socketId - Socket ID
 * @param {string} eventName - Event name
 * @returns {Object|null} Rate limit status or null if not found
 */
function getRateLimitStatus(socketId, eventName) {
  if (rateLimits.has(socketId) && rateLimits.get(socketId).has(eventName)) {
    const counter = rateLimits.get(socketId).get(eventName);
    const limit = DEFAULT_LIMITS[eventName] || DEFAULT_LIMITS.default;
    
    return {
      current: counter.count,
      limit: limit.maxRequests,
      remaining: Math.max(0, limit.maxRequests - counter.count),
      resetAt: counter.resetAt,
      windowMs: limit.windowMs
    };
  }
  
  return null;
}

module.exports = {
  rateLimitHandler,
  cleanupRateLimits,
  getRateLimitStatus
};
