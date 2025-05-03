/**
 * Game Socket Service
 * Handles real-time communication for game sessions using Socket.io
 */
import { io } from 'socket.io-client';
import { useContext } from 'react';
import { SocketContext } from '../context/SocketContext';

// Socket.io connection options
const socketOptions = {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000
};

/**
 * Create a new socket connection to the host namespace
 * @param {string} playerId - Player ID for authentication
 * @param {string} gameSessionId - Game session ID
 * @returns {Socket} Socket.io socket instance
 */
const createHostSocket = (playerId, gameSessionId) => {
  const socket = io('/host', {
    ...socketOptions,
    auth: {
      playerId,
      gameSessionId,
      isHost: true
    }
  });
  
  return socket;
};

/**
 * Create a new socket connection to the player namespace
 * @param {string} playerId - Player ID for authentication
 * @param {string} gameSessionId - Game session ID
 * @returns {Socket} Socket.io socket instance
 */
const createPlayerSocket = (playerId, gameSessionId) => {
  const socket = io('/player', {
    ...socketOptions,
    auth: {
      playerId,
      gameSessionId,
      isHost: false
    }
  });
  
  return socket;
};

/**
 * Create a new socket connection to the game namespace
 * @param {string} playerId - Player ID for authentication
 * @param {string} gameSessionId - Game session ID
 * @returns {Socket} Socket.io socket instance
 */
const createGameSocket = (playerId, gameSessionId) => {
  const socket = io('/game', {
    ...socketOptions,
    auth: {
      playerId,
      gameSessionId
    }
  });
  
  return socket;
};

/**
 * Connect to the socket server
 * @param {Socket} socket - Socket.io socket instance
 * @returns {Promise<void>} Promise that resolves when connected
 */
const connectSocket = (socket) => {
  return new Promise((resolve, reject) => {
    socket.connect();
    
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      resolve();
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      reject(error);
    });
  });
};

/**
 * Disconnect from the socket server
 * @param {Socket} socket - Socket.io socket instance
 */
const disconnectSocket = (socket) => {
  if (socket && socket.connected) {
    socket.disconnect();
    console.log('Socket disconnected');
  }
};

/**
 * Game Master event handlers for socket events
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} handlers - Event handlers
 */
const setupGameMasterHandlers = (socket, handlers) => {
  if (!socket) return;
  
  // Game state events
  socket.on('game:state', handlers.onGameState || (() => {}));
  socket.on('game:players', handlers.onGamePlayers || (() => {}));
  socket.on('game:round', handlers.onGameRound || (() => {}));
  socket.on('game:question', handlers.onGameQuestion || (() => {}));
  socket.on('game:answer', handlers.onGameAnswer || (() => {}));
  socket.on('game:scores', handlers.onGameScores || (() => {}));
  socket.on('game:chat', handlers.onGameChat || (() => {}));
  
  // Player events
  socket.on('player:join', handlers.onPlayerJoin || (() => {}));
  socket.on('player:leave', handlers.onPlayerLeave || (() => {}));
  socket.on('player:ready', handlers.onPlayerReady || (() => {}));
  socket.on('player:buzzer', handlers.onPlayerBuzzer || (() => {}));
  socket.on('player:answer', handlers.onPlayerAnswer || (() => {}));
  socket.on('player:status', handlers.onPlayerStatus || (() => {}));
  
  // Error events
  socket.on('error', handlers.onError || (() => {}));
  
  // Connection events
  socket.on('disconnect', handlers.onDisconnect || (() => {}));
  socket.on('reconnect', handlers.onReconnect || (() => {}));
  socket.on('reconnect_attempt', handlers.onReconnectAttempt || (() => {}));
  socket.on('reconnect_error', handlers.onReconnectError || (() => {}));
  socket.on('reconnect_failed', handlers.onReconnectFailed || (() => {}));
};

/**
 * Game Master event emitters for controlling the game
 * @param {Socket} socket - Socket.io socket instance
 */
const gameMasterEmitters = (socket) => {
  if (!socket) return {};
  
  return {
    /**
     * Start the game
     * @param {Object} data - Game start data
     */
    startGame: (data = {}) => {
      socket.emit('game:start', data);
    },
    
    /**
     * Pause the game
     * @param {Object} data - Game pause data
     */
    pauseGame: (data = {}) => {
      socket.emit('game:pause', data);
    },
    
    /**
     * Resume the game
     * @param {Object} data - Game resume data
     */
    resumeGame: (data = {}) => {
      socket.emit('game:resume', data);
    },
    
    /**
     * End the game
     * @param {Object} data - Game end data
     */
    endGame: (data = {}) => {
      socket.emit('game:end', data);
    },
    
    /**
     * Start a round
     * @param {Object} data - Round start data
     */
    startRound: (data) => {
      socket.emit('round:start', data);
    },
    
    /**
     * End a round
     * @param {Object} data - Round end data
     */
    endRound: (data = {}) => {
      socket.emit('round:end', data);
    },
    
    /**
     * Move to the next question
     * @param {Object} data - Question data
     */
    nextQuestion: (data = {}) => {
      socket.emit('question:next', data);
    },
    
    /**
     * Reveal the answer to the current question
     * @param {Object} data - Answer data
     */
    revealAnswer: (data = {}) => {
      socket.emit('question:reveal', data);
    },
    
    /**
     * Kick a player from the game
     * @param {Object} data - Player data
     */
    kickPlayer: (data) => {
      socket.emit('player:kick', data);
    },
    
    /**
     * Send a chat message
     * @param {Object} data - Chat message data
     */
    sendChatMessage: (data) => {
      socket.emit('chat:message', data);
    },
    
    /**
     * Request game state update
     */
    requestGameState: () => {
      socket.emit('game:request_state');
    },
    
    /**
     * Request player list update
     */
    requestPlayerList: () => {
      socket.emit('game:request_players');
    }
  };
};

/**
 * Custom hook for using game socket in components
 * @returns {Object} Socket context
 */
const useGameSocket = () => {
  const socketContext = useContext(SocketContext);
  
  if (!socketContext) {
    throw new Error('useGameSocket must be used within a SocketProvider');
  }
  
  return socketContext;
};

export {
  createHostSocket,
  createPlayerSocket,
  createGameSocket,
  connectSocket,
  disconnectSocket,
  setupGameMasterHandlers,
  gameMasterEmitters,
  useGameSocket
};
