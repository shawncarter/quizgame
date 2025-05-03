/**
 * Socket Error Handler for Client
 * Provides consistent error handling and recovery for Socket.io errors
 */
import { toast } from 'react-toastify';

// Error type definitions for specific handling
const ERROR_TYPES = {
  // Connection errors
  CONNECTION_ERROR: 'connection_error',
  CONNECTION_FAILED: 'connection_failed',
  AUTHENTICATION_ERROR: 'authentication_error',
  
  // Game state errors
  INVALID_GAME_STATE: 'INVALID_GAME_STATE',
  GAME_NOT_FOUND: 'GAME_NOT_FOUND',
  PLAYER_NOT_IN_GAME: 'PLAYER_NOT_IN_GAME',
  
  // Rate limiting and throttling
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Permission errors
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  
  // General errors
  INVALID_REQUEST: 'INVALID_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

/**
 * Initialize error handling for a socket
 * @param {Socket} socket - Socket.io client instance
 * @param {Function} onReconnect - Function to call on reconnection (optional)
 * @param {Function} onFatal - Function to call on fatal error (optional)
 */
function initErrorHandling(socket, onReconnect, onFatal) {
  if (!socket) {
    console.error('Cannot initialize error handling: Socket is null');
    return;
  }

  console.log('Initializing socket error handling');
  
  // Handle socket errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
    handleSocketError(error, socket);
  });
  
  // Handle connection errors
  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
    handleConnectionError(error, socket, onFatal);
  });
  
  // Handle successful connection
  socket.on('connect', () => {
    console.log('Socket connected successfully');
    toast.success('Connected to server', {
      autoClose: 3000
    });
  });
  
  // Handle disconnections
  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
    
    // For certain disconnection reasons, attempt recovery
    if (reason === 'io server disconnect') {
      // The server has forcefully disconnected the socket
      console.log('Attempting to reconnect after server disconnect');
      socket.connect();
    }
    
    // Display notification based on reason
    if (reason === 'transport close' || reason === 'ping timeout') {
      toast.warning('Lost connection to server. Attempting to reconnect...', {
        autoClose: 5000
      });
    }
  });
  
  // Handle reconnection
  socket.on('reconnect', (attemptNumber) => {
    console.log(`Socket reconnected after ${attemptNumber} attempts`);
    toast.success('Reconnected to server', {
      autoClose: 3000
    });
    
    if (onReconnect) {
      onReconnect(attemptNumber);
    }
  });
  
  // Handle reconnection attempts
  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`Socket reconnection attempt ${attemptNumber}`);
    
    // Only show notification every 3 attempts to avoid spam
    if (attemptNumber % 3 === 1) {
      toast.info(`Reconnection attempt ${attemptNumber}...`, {
        autoClose: 2000
      });
    }
  });
  
  // Handle reconnection errors
  socket.on('reconnect_error', (error) => {
    console.error('Socket reconnection error:', error);
    
    toast.error('Failed to reconnect. Please refresh the page.', {
      autoClose: false
    });
    
    if (onFatal) {
      onFatal(error);
    }
  });
  
  // Handle reconnection failures
  socket.on('reconnect_failed', () => {
    console.error('Socket reconnection failed after all attempts');
    
    toast.error('Connection lost. Please refresh the page to reconnect.', {
      autoClose: false
    });
    
    if (onFatal) {
      onFatal(new Error('Reconnection failed'));
    }
  });
}

/**
 * Handle socket errors from the server
 * @param {Object} error - Error object from server
 * @param {Socket} socket - Socket.io client instance
 */
function handleSocketError(error, socket) {
  // Default error notification
  let notification = {
    message: error.message || 'An error occurred',
    type: 'error',
    autoClose: 5000,
    closeButton: true
  };
  
  // Handle specific error types
  switch (error.code) {
    case ERROR_TYPES.RATE_LIMIT_EXCEEDED:
      notification.message = `${error.message} Please wait ${error.retryAfter || 'a moment'} before trying again.`;
      notification.type = 'warning';
      break;
      
    case ERROR_TYPES.INVALID_GAME_STATE:
      notification.message = 'Cannot perform this action in the current game state.';
      notification.type = 'warning';
      break;
      
    case ERROR_TYPES.GAME_NOT_FOUND:
      notification.message = 'Game not found. It may have ended or been removed.';
      notification.type = 'error';
      notification.autoClose = false;
      break;
      
    case ERROR_TYPES.PLAYER_NOT_IN_GAME:
      notification.message = 'You are not a participant in this game.';
      notification.type = 'error';
      break;
      
    case ERROR_TYPES.PERMISSION_DENIED:
      notification.message = 'You do not have permission to perform this action.';
      notification.type = 'error';
      break;
      
    default:
      // Use default notification
      break;
  }
  
  // Show toast notification
  toast[notification.type](notification.message, {
    autoClose: notification.autoClose,
    closeButton: notification.closeButton
  });
}

/**
 * Handle connection errors
 * @param {Error} error - Connection error
 * @param {Socket} socket - Socket.io client instance
 * @param {Function} onFatal - Function to call on fatal error
 */
function handleConnectionError(error, socket, onFatal) {
  console.log('Handling connection error:', error.message);
  
  if (error.message.includes('authentication')) {
    toast.error('Authentication failed. Please log in again.', {
      autoClose: false
    });
    
    // This is likely a fatal error requiring user action
    if (onFatal) {
      onFatal(error);
    }
  } else if (error.message.includes('CORS')) {
    console.error('CORS error:', error);
    toast.error('Connection blocked by CORS policy. Please check server configuration.', {
      autoClose: false
    });
    
    if (onFatal) {
      onFatal(error);
    }
  } else {
    toast.error(`Connection error: ${error.message}. Attempting to reconnect...`, {
      autoClose: 5000
    });
    
    // Socket.io will automatically try to reconnect
    console.log('Waiting for automatic reconnection...');
  }
}

/**
 * Create a custom error handler for specific events
 * @param {Function} onError - Custom error handler
 * @returns {Function} Error handler function
 */
function createErrorHandler(onError) {
  return function(error) {
    // First apply default handling
    handleSocketError(error);
    
    // Then apply custom handling if provided
    if (onError) {
      onError(error);
    }
  };
}

export {
  initErrorHandling,
  handleSocketError,
  handleConnectionError,
  createErrorHandler,
  ERROR_TYPES
};
