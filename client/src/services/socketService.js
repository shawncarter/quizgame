import { io } from 'socket.io-client';
import { initErrorHandling } from './socketErrorHandler';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

class SocketService {
  constructor() {
    this.socket = null;
    this.gameSocket = null;
    this.playerSocket = null;
    this.hostSocket = null;
    this.namespaces = new Map();
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.connectionTimeout = 20000; // 20 seconds
    this.reconnectionDelay = 1000; // 1 second
    this.reconnectionDelayMax = 5000; // 5 seconds
    this.onConnectCallbacks = [];
    this.onDisconnectCallbacks = [];
    this.onErrorCallbacks = [];
    this.onReconnectCallbacks = [];
  }

  /**
   * Connect to the main socket
   * @param {Object} auth - Authentication data
   * @param {Object} options - Additional connection options
   * @returns {Socket} Socket instance
   */
  connect(auth = {}, options = {}) {
    if (this.socket) return this.socket;

    // Check if we have a player ID - if not and we're not in a special case, don't try to connect
    if (!auth.playerId && !options.allowNoAuth) {
      console.log('No player ID available, skipping socket connection');
      return null;
    }

    // Merge default options with provided options
    const socketOptions = {
      auth,
      reconnection: true,
      reconnectionAttempts: options.maxReconnectAttempts || this.maxReconnectAttempts,
      reconnectionDelay: options.reconnectionDelay || this.reconnectionDelay,
      reconnectionDelayMax: options.reconnectionDelayMax || this.reconnectionDelayMax,
      timeout: options.connectionTimeout || this.connectionTimeout,
      query: options.query || {}
    };

    try {
      // Make sure the socket URL doesn't contain /api
      const baseUrl = SOCKET_URL.includes('/api') ? SOCKET_URL.replace('/api', '') : SOCKET_URL;
      console.log('Connecting to socket server at:', baseUrl);
      this.socket = io(baseUrl, socketOptions);

      // Set up standard event listeners
      this.setupSocketListeners(this.socket, 'main');

      // Set up error handling
      initErrorHandling(
        this.socket,
        (attemptNumber) => this.handleReconnect(attemptNumber),
        (error) => this.handleFatalError(error)
      );

      return this.socket;
    } catch (error) {
      console.error('Error creating socket connection:', error);
      return null;
    }
  }

  /**
   * Handle successful reconnection
   * @param {number} attemptNumber - Reconnection attempt number
   */
  handleReconnect(attemptNumber) {
    console.log(`Socket reconnected after ${attemptNumber} attempts`);
    this.isConnected = true;
    this.reconnectAttempts = 0;

    // Call reconnect callbacks
    this.onReconnectCallbacks.forEach(callback => callback(attemptNumber));
  }

  /**
   * Handle fatal connection errors
   * @param {Error} error - Fatal error
   */
  handleFatalError(error) {
    // Check if this is an expected authentication error for a new user
    if (error && error.message && error.message.includes('Authentication error: Player ID required')) {
      console.log('Socket requires authentication: Player registration needed');
    } else {
      // Only log as error for unexpected fatal errors
      console.error('Fatal socket error:', error);
    }

    this.isConnected = false;

    // Trigger error callbacks
    this.onErrorCallbacks.forEach(callback =>
      callback('fatal', error, 'main')
    );
  }

  /**
   * Connect to a specific namespace
   * @param {string} namespace - Namespace to connect to (e.g., 'game', 'player', 'host')
   * @param {Object} auth - Authentication data
   * @param {Object} options - Additional connection options
   * @returns {Socket} Namespace socket instance
   */
  connectToNamespace(namespace, auth = {}, options = {}) {
    if (this.namespaces.has(namespace)) {
      return this.namespaces.get(namespace);
    }

    // Merge default options with provided options
    const socketOptions = {
      auth,
      reconnection: true,
      reconnectionAttempts: options.maxReconnectAttempts || this.maxReconnectAttempts,
      reconnectionDelay: options.reconnectionDelay || this.reconnectionDelay,
      reconnectionDelayMax: options.reconnectionDelayMax || this.reconnectionDelayMax,
      timeout: options.connectionTimeout || this.connectionTimeout,
      query: options.query || {}
    };

    // Make sure the socket URL doesn't contain /api
    const baseUrl = SOCKET_URL.includes('/api') ? SOCKET_URL.replace('/api', '') : SOCKET_URL;
    console.log(`Connecting to socket namespace ${namespace} at:`, baseUrl);
    const namespaceSocket = io(`${baseUrl}/${namespace}`, socketOptions);

    // Set up standard event listeners
    this.setupSocketListeners(namespaceSocket, namespace);

    // Set up error handling with namespace-specific callbacks
    initErrorHandling(
      namespaceSocket,
      (attemptNumber) => this.handleNamespaceReconnect(namespace, attemptNumber),
      (error) => this.handleNamespaceFatalError(namespace, error)
    );

    this.namespaces.set(namespace, namespaceSocket);

    // Store in specific properties for convenience
    if (namespace === 'game') this.gameSocket = namespaceSocket;
    if (namespace === 'player') this.playerSocket = namespaceSocket;
    if (namespace === 'host') this.hostSocket = namespaceSocket;

    return namespaceSocket;
  }

  /**
   * Handle successful namespace reconnection
   * @param {string} namespace - Socket namespace
   * @param {number} attemptNumber - Reconnection attempt number
   */
  handleNamespaceReconnect(namespace, attemptNumber) {
    console.log(`Socket namespace ${namespace} reconnected after ${attemptNumber} attempts`);

    // Call reconnect callbacks with namespace info
    this.onReconnectCallbacks.forEach(callback => callback(attemptNumber, namespace));
  }

  /**
   * Handle fatal namespace connection errors
   * @param {string} namespace - Socket namespace
   * @param {Error} error - Fatal error
   */
  handleNamespaceFatalError(namespace, error) {
    // Check if this is an expected authentication error for a new user
    if (error && error.message && error.message.includes('Authentication error: Player ID required')) {
      console.log(`Socket namespace ${namespace} requires authentication: Player registration needed`);
    } else {
      // Only log as error for unexpected fatal errors
      console.error(`Fatal socket error in namespace ${namespace}:`, error);
    }

    // Trigger error callbacks with namespace info
    this.onErrorCallbacks.forEach(callback =>
      callback('fatal', error, namespace)
    );
  }

  /**
   * Set up event listeners for a socket
   * @param {Socket} socket - Socket instance
   * @param {string} name - Socket name for logging
   */
  setupSocketListeners(socket, name) {
    socket.on('connect', () => {
      console.log(`Connected to ${name} socket`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.onConnectCallbacks.forEach(callback => callback(name));
    });

    socket.on('disconnect', (reason) => {
      console.log(`Disconnected from ${name} socket: ${reason}`);
      this.isConnected = false;
      this.onDisconnectCallbacks.forEach(callback => callback(name, reason));
    });

    socket.on('connect_error', (error) => {
      // Check if this is an expected authentication error for a new user
      if (error.message && error.message.includes('Authentication error: Player ID required')) {
        console.log(`${name} socket requires authentication: Player registration needed`);
      } else {
        console.error(`Connection error for ${name} socket:`, error.message);
      }

      this.reconnectAttempts++;
      this.onErrorCallbacks.forEach(callback => callback(name, error));

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.log(`Max reconnection attempts reached for ${name} socket`);
        socket.disconnect();
      }
    });
  }

  /**
   * Disconnect from all sockets
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    // Disconnect from all namespaces
    for (const [namespace, socket] of this.namespaces.entries()) {
      socket.disconnect();
      this.namespaces.delete(namespace);
    }

    this.gameSocket = null;
    this.playerSocket = null;
    this.hostSocket = null;
    this.isConnected = false;
  }

  /**
   * Disconnect from a specific namespace
   * @param {string} namespace - Namespace to disconnect from
   */
  disconnectFromNamespace(namespace) {
    if (this.namespaces.has(namespace)) {
      const socket = this.namespaces.get(namespace);
      socket.disconnect();
      this.namespaces.delete(namespace);

      // Clear specific socket property
      if (namespace === 'game') this.gameSocket = null;
      if (namespace === 'player') this.playerSocket = null;
      if (namespace === 'host') this.hostSocket = null;
    }
  }

  /**
   * Join a game session
   * @param {string} gameSessionId - Game session ID
   * @param {string} gameCode - Game session code
   * @param {string} playerId - Player ID
   * @param {boolean} isHost - Whether the user is the game host
   */
  joinGameSession(gameSessionId, gameCode, playerId, isHost = false) {
    console.log(`Joining game session ${gameSessionId} (${gameCode}) as ${isHost ? 'host' : 'player'}`);

    // Prepare authentication data
    const auth = {
      playerId,
      gameSessionId,
      isHost,
      gameCode
    };

    // First connect to the game namespace
    const gameSocket = this.connectToNamespace('game', auth);

    // Join the game session
    gameSocket.emit('game:join', {
      gameSessionId,
      gameCode,
      playerId,
      isHost
    });

    // If host, also connect to host namespace
    if (isHost) {
      console.log('Connecting to host namespace');
      const hostSocket = this.connectToNamespace('host', auth);

      // Set up host-specific event listeners
      hostSocket.on('connect', () => {
        console.log('Connected to host namespace');
        hostSocket.emit('host:connected', {
          gameSessionId,
          gameCode
        });
      });
    } else {
      // If player, connect to player namespace
      console.log('Connecting to player namespace');
      const playerSocket = this.connectToNamespace('player', auth);

      // Set up player-specific event listeners
      playerSocket.on('connect', () => {
        console.log('Connected to player namespace');
        playerSocket.emit('player:connected', {
          gameSessionId,
          gameCode
        });
      });
    }

    return gameSocket;
  }

  /**
   * Leave a game session
   * @param {string} gameSessionId - Game session ID
   */
  leaveGameSession(gameSessionId) {
    // Emit leave event to game namespace
    if (this.gameSocket) {
      this.gameSocket.emit('game:leave', { gameSessionId });
      this.disconnectFromNamespace('game');
    }

    // Also disconnect from player or host namespace
    this.disconnectFromNamespace('player');
    this.disconnectFromNamespace('host');
  }

  /**
   * Emit event to a specific namespace
   * @param {string} namespace - Namespace to emit to
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  emitToNamespace(namespace, event, data) {
    if (!this.namespaces.has(namespace)) return;
    this.namespaces.get(namespace).emit(event, data);
  }

  /**
   * Emit event to main socket
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  emit(event, data) {
    if (!this.socket) return;
    this.socket.emit(event, data);
  }

  /**
   * Listen for event on main socket
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  on(event, callback) {
    if (!this.socket) return;
    this.socket.on(event, callback);
  }

  /**
   * Remove event listener from main socket
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  off(event, callback) {
    if (!this.socket) return;
    this.socket.off(event, callback);
  }

  /**
   * Listen for event on specific namespace
   * @param {string} namespace - Namespace to listen on
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  onNamespace(namespace, event, callback) {
    if (!this.namespaces.has(namespace)) return;
    this.namespaces.get(namespace).on(event, callback);
  }

  /**
   * Remove event listener from specific namespace
   * @param {string} namespace - Namespace to remove listener from
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  offNamespace(namespace, event, callback) {
    if (!this.namespaces.has(namespace)) return;
    this.namespaces.get(namespace).off(event, callback);
  }

  /**
   * Register callback for socket connection
   * @param {Function} callback - Connection callback
   */
  onConnect(callback) {
    this.onConnectCallbacks.push(callback);
  }

  /**
   * Register callback for socket disconnection
   * @param {Function} callback - Disconnection callback
   */
  onDisconnect(callback) {
    this.onDisconnectCallbacks.push(callback);
  }

  /**
   * Register callback for socket error
   * @param {Function} callback - Error callback
   */
  onError(callback) {
    this.onErrorCallbacks.push(callback);
  }

  /**
   * Register callback for socket reconnection
   * @param {Function} callback - Reconnection callback
   */
  onReconnect(callback) {
    this.onReconnectCallbacks.push(callback);
  }

  /**
   * Register automatic state recovery on reconnection
   * @param {Function} getState - Function to get current state
   * @param {Function} setState - Function to restore state
   * @param {string} namespace - Socket namespace (optional)
   */
  registerStateRecovery(getState, setState, namespace = 'main') {
    // Create the recovery handler
    const recoveryHandler = (attemptNumber, reconnectNamespace) => {
      // Only proceed if this is for the correct namespace
      if (namespace !== 'main' && reconnectNamespace !== namespace) return;

      // Get current state before disconnection
      const state = getState();
      if (!state) return;

      console.log(`Recovering state for ${namespace}`);

      // Request server to resynchronize state
      const socket = namespace === 'main' ? this.socket : this.namespaces.get(namespace);

      if (socket) {
        socket.emit('state:resync', {
          lastState: state,
          timestamp: Date.now()
        });

        // Listen for state update from server
        const stateListener = (newState) => {
          console.log(`Received state update for ${namespace}`);
          setState(newState);

          // Remove the listener after state is updated
          socket.off('state:update', stateListener);
        };

        socket.on('state:update', stateListener);
      }
    };

    // Register the recovery handler
    this.onReconnect(recoveryHandler);
  }

  /**
   * Activate buzzer for current player
   * @param {string} questionId - Current question ID
   */
  activateBuzzer(questionId) {
    if (!this.gameSocket) return;
    this.gameSocket.emit('buzzer:activate', { questionId });
  }

  /**
   * Submit answer for current question
   * @param {string} questionId - Question ID
   * @param {string} answer - Player's answer
   * @param {number} timeToAnswer - Time taken to answer in milliseconds
   */
  submitAnswer(questionId, answer, timeToAnswer) {
    if (!this.gameSocket) return;
    this.gameSocket.emit('answer:submit', { questionId, answer, timeToAnswer });
  }

  /**
   * Send player status update
   * @param {string} status - Player status ('active', 'inactive', etc.)
   */
  updatePlayerStatus(status) {
    if (!this.socket) return;
    this.socket.emit('player:status', { status });
  }

  /**
   * Send chat message in game
   * @param {string} message - Chat message
   */
  sendChatMessage(message) {
    if (!this.gameSocket) return;
    this.gameSocket.emit('chat:message', { message });
  }
}

// Create a singleton instance
const socketService = new SocketService();

export default socketService;
