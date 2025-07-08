/**
 * Game Socket Service
 * Handles real-time communication for game sessions using Socket.io
 */
import { io } from 'socket.io-client';
import { useContext } from 'react';
import { SocketContext } from '../context/SocketContext';
import { API_URL, SOCKET_URL } from '../config/config';

// Socket.io connection options
const socketOptions = {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000,
  transports: ['websocket', 'polling'], // Try websocket first, fallback to polling
  forceNew: true, // Force a new connection
  upgrade: true, // Allow transport upgrade
  rememberUpgrade: true // Remember the successful upgrade
};

/**
 * Create a new socket connection to the host namespace
 * @param {string} playerId - Player ID for authentication
 * @param {string} gameSessionId - Game session ID
 * @returns {Socket} Socket.io socket instance
 */
const createHostSocket = (playerId, gameSessionId) => {
  console.log('=== GAME SOCKET SERVICE - CREATE HOST SOCKET ===');
  console.log(`Creating host socket with playerId: ${playerId}, gameSessionId: ${gameSessionId}`);

  // Use the SOCKET_URL from environment variables and ensure it doesn't have /api
  const baseUrl = SOCKET_URL.includes('/api') ? SOCKET_URL.replace('/api', '') : SOCKET_URL;

  console.log(`Using socket base URL: ${baseUrl}`);
  console.log('Original API_URL from env:', API_URL);
  console.log('Window location:', window.location.href);
  console.log('Document URL:', document.URL);
  console.log('Socket options being used:', socketOptions);

  // Update socket options to ensure WebSocket transport is prioritized
  const socketConfig = {
    ...socketOptions,
    path: '/socket.io',
    transports: ['websocket', 'polling'], // Allow polling fallback
    auth: {
      playerId,
      gameSessionId: gameSessionId.trim(), // Clean the gameSessionId
      isHost: true
    }
  };

  console.log('Final socket configuration:', socketConfig);
  console.log('Socket namespace URL:', `${baseUrl}/host`);

  const socket = io(`${baseUrl}/host`, socketConfig);

  // Add debug listeners
  socket.on('connect', () => {
    console.log('Host socket connected successfully with ID:', socket.id);
    console.log('Socket connection details:', {
      connected: socket.connected,
      id: socket.id,
      namespace: socket.nsp,
      auth: socket.auth
    });
  });

  socket.on('connect_error', (error) => {
    console.error('Host socket connect error:', error.message);
    console.error('Error details:', error);
    console.log('Socket connection state:', {
      connected: socket.connected,
      connecting: socket.connecting,
      disconnected: socket.disconnected
    });
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
  // Use the SOCKET_URL from environment variables and ensure it doesn't have /api
  const baseUrl = SOCKET_URL.includes('/api') ? SOCKET_URL.replace('/api', '') : SOCKET_URL;

  console.log(`Using socket base URL for player: ${baseUrl}`);

  const socket = io(`${baseUrl}/player`, {
    ...socketOptions,
    path: '/socket.io',
    transports: ['websocket', 'polling'], // Allow polling fallback
    auth: {
      playerId,
      gameSessionId: gameSessionId.trim(), // Clean the gameSessionId
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
  // Use the SOCKET_URL from environment variables and ensure it doesn't have /api
  const baseUrl = SOCKET_URL.includes('/api') ? SOCKET_URL.replace('/api', '') : SOCKET_URL;

  console.log(`Using socket base URL for game: ${baseUrl}`);

  const socket = io(`${baseUrl}/game`, {
    ...socketOptions,
    path: '/socket.io',
    transports: ['websocket', 'polling'], // Allow polling fallback
    auth: {
      playerId,
      gameSessionId: gameSessionId.trim() // Clean the gameSessionId
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
  console.log('=== GAME SOCKET SERVICE - CONNECT SOCKET ===');
  console.log('Attempting to connect socket with ID:', socket.id);
  console.log('Socket current state:', {
    connected: socket.connected,
    connecting: socket.connecting,
    disconnected: socket.disconnected
  });

  return new Promise((resolve, reject) => {
    // Clear existing listeners to prevent duplicates
    socket.off('connect');
    socket.off('connect_error');
    socket.off('error');
    console.log('Cleared existing socket listeners');

    // Set connection timeout
    const connectionTimeout = setTimeout(() => {
      console.error('Socket connection timeout after 10 seconds');
      console.error('Socket state at timeout:', {
        connected: socket.connected,
        connecting: socket.connecting,
        disconnected: socket.disconnected,
        id: socket.id
      });

      // Try to reconnect with polling if websocket fails
      console.log('Trying to reconnect with polling transport...');
      socket.io.opts.transports = ['polling', 'websocket'];
      socket.connect();

      // Set a new timeout for the polling attempt
      setTimeout(() => {
        if (!socket.connected) {
          console.error('Socket connection failed after trying polling transport');
          reject(new Error('Connection timeout after trying both websocket and polling'));
        }
      }, 5000);
    }, 10000);

    // Connect event
    socket.on('connect', () => {
      console.log('Socket connected successfully:', socket.id);
      console.log('Socket transport used:', socket.io.engine.transport.name);
      console.log('Socket connection details:', {
        connected: socket.connected,
        id: socket.id,
        namespace: socket.nsp,
        auth: socket.auth
      });
      clearTimeout(connectionTimeout);
      resolve(socket);
    });

    // Connection error event
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      console.error('Error details:', error);
      console.error('Socket state at error:', {
        connected: socket.connected,
        connecting: socket.connecting,
        disconnected: socket.disconnected,
        id: socket.id
      });

      // Check if this is an authentication error
      if (error.message && error.message.includes('Authentication')) {
        console.error('Authentication error detected. Check player ID and game session ID.');
        console.error('Auth data:', socket.auth);
        
        // Still try to continue with polling as fallback
      }
      
      // If this is a websocket error or we've had a connection issue, try polling instead
      if ((error.message === 'websocket error' || error.message.includes('timeout')) && 
          socket.io.opts.transports[0] === 'websocket') {
        console.log('Websocket connection failed, falling back to polling...');
        socket.io.opts.transports = ['polling', 'websocket'];
        
        // Give it a little more time before rejecting
        setTimeout(() => {
          if (!socket.connected) {
            clearTimeout(connectionTimeout);
            reject(error);
          }
        }, 3000);
        
        // Don't reject yet, let it try polling
        return;
      }

      clearTimeout(connectionTimeout);
      reject(error);
    });

    // General error event
    socket.on('error', (error) => {
      console.error('Socket error:', error);
      console.error('Socket state at error:', {
        connected: socket.connected,
        connecting: socket.connecting,
        disconnected: socket.disconnected,
        id: socket.id
      });
      clearTimeout(connectionTimeout);
      reject(error);
    });

    // Attempt connection
    console.log('Attempting socket connection...');
    socket.connect();

    // Log connection attempt
    console.log('Socket connection attempt initiated');
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

  // New events for test players and game updates
  socket.on('playersUpdated', handlers.onPlayersUpdated || (() => {}));
  socket.on('gameUpdated', handlers.onGameUpdated || (() => {}));

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
