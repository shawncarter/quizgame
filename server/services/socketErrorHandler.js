/**
 * Socket Error Handler
 * Provides standardized error handling for Socket.io events
 */

/**
 * Wrap a socket event handler with error handling
 * @param {Function} handler - The event handler function
 * @returns {Function} Wrapped handler with error handling
 */
function withErrorHandling(handler) {
  return async function(socket, data) {
    try {
      return await handler(socket, data);
    } catch (error) {
      handleSocketError(socket, error);
    }
  };
}

/**
 * Handle socket errors consistently
 * @param {Socket} socket - Socket.io socket instance
 * @param {Error} error - Error object
 */
function handleSocketError(socket, error) {
  console.error(`Socket error (${socket.id}):`, error);
  
  // Determine error type and create appropriate response
  const errorResponse = {
    code: error.code || 'INTERNAL_ERROR',
    message: error.message || 'An unexpected error occurred',
    timestamp: Date.now()
  };
  
  // Add more details for development environment
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.stack = error.stack;
    errorResponse.details = error.details || {};
  }
  
  // Send error to client
  socket.emit('error', errorResponse);
  
  // Log detailed error for monitoring
  console.error('Detailed socket error:', {
    socketId: socket.id,
    playerId: socket.playerId,
    gameSessionId: socket.gameSessionId,
    error: {
      code: error.code,
      message: error.message,
      stack: error.stack
    }
  });
}

/**
 * Create a custom socket error
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {Object} details - Additional error details
 * @returns {Error} Custom error object
 */
function createSocketError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

module.exports = {
  withErrorHandling,
  handleSocketError,
  createSocketError
};
