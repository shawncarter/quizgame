import { createContext, useState, useEffect, useContext, useCallback } from 'react';
import socketService from '../services/socketService';
import playerService from '../services/playerService';

// Create context
const SocketContext = createContext(null);

// Export the context
export { SocketContext };

/**
 * Socket provider component
 * @param {Object} props - Component props
 * @returns {JSX.Element} Provider component
 */
export function SocketProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false);
  const [socketError, setSocketError] = useState(null);
  const [gameSession, setGameSession] = useState(null);
  const [events, setEvents] = useState({});
  const [needsRegistration, setNeedsRegistration] = useState(false);

  // Initialize socket connection
  useEffect(() => {
    const handleConnect = () => {
      setIsConnected(true);
      setSocketError(null);
      setNeedsRegistration(false); // Reset flag on successful connection
      
      // Clear any existing error message when successfully connected
      console.log('Socket connected successfully');
    };

    const handleDisconnect = (namespace, reason) => {
      setIsConnected(false);
      console.log(`Socket disconnected from namespace ${namespace}. Reason: ${reason}`);
      
      if (reason !== 'io client disconnect') {
        setSocketError(`Connection lost: ${reason}`);
      }
    };

    const handleError = (namespace, error) => {
      console.log(`Socket error in namespace ${namespace}:`, error?.message || 'Unknown error');
      
      // If the error is about player ID being required, set a flag
      if (error?.message === 'Authentication error: Player ID required') {
        setSocketError('You need to register as a player first');
        setNeedsRegistration(true);
      } else if (error?.message && error?.message.includes('Authentication')) {
        console.error('Authentication error:', error.message);
        setSocketError('Authentication failed. Please try registering again.');
        setNeedsRegistration(true);
      } else {
        setSocketError(error?.message || 'Connection error');
      }
    };

    // Register global event handlers
    socketService.onConnect(handleConnect);
    socketService.onDisconnect(handleDisconnect);
    socketService.onError(handleError);

    // Get player ID from localStorage for authentication
    const playerId = playerService.getPlayerId();

    // Initialize socket connection with player ID if available
    if (playerId) {
      socketService.connect({ playerId });
    } else {
      // If no player ID, only try to connect if we're on a page that doesn't require auth
      // or if we're explicitly testing the connection
      const currentPath = window.location.pathname;
      const publicPaths = ['/', '/register', '/join'];
      const isPublicPath = publicPaths.some(path => currentPath === path || currentPath.startsWith(path + '/'));

      if (isPublicPath) {
        // Allow connection without auth for public paths, but expect auth error
        socketService.connect({}, { allowNoAuth: true });
        // Set the flag directly to avoid socket connection errors
        setNeedsRegistration(true);
      } else {
        // For protected paths, don't even try to connect without auth
        setNeedsRegistration(true);
      }
    }

    return () => {
      // Clean up socket connection on unmount
      socketService.disconnect();
    };
  }, []);

  /**
   * Connect to a socket namespace
   * @param {string} namespace - Namespace to connect to
   * @param {Object} auth - Authentication data
   * @returns {Promise} Promise that resolves when connected
   */
  const connectToNamespace = useCallback((namespace, auth = {}) => {
    console.log(`Connecting to namespace ${namespace} with auth:`, auth);

    // Create a promise that resolves when connected
    return new Promise((resolve, reject) => {
      try {
        // Connect to the namespace
        socketService.connectToNamespace(namespace, auth);

        // Set a timeout to resolve the promise after a short delay
        // This gives the socket time to establish the connection
        setTimeout(() => {
          console.log(`Namespace ${namespace} connection attempt completed`);
          resolve();
        }, 500);
      } catch (error) {
        console.error(`Error connecting to namespace ${namespace}:`, error);
        reject(error);
      }
    });
  }, []);

  /**
   * Join a game session
   * @param {string} gameSessionId - Game session ID
   * @param {string} gameCode - Game session code
   * @param {string} playerId - Player ID
   * @param {boolean} isHost - Whether the user is the game host
   */
  const joinGameSession = useCallback((gameSessionId, gameCode, playerId, isHost = false) => {
    socketService.joinGameSession(gameSessionId, gameCode, playerId, isHost);
    setGameSession({ id: gameSessionId, code: gameCode, isHost });
  }, []);

  /**
   * Leave current game session
   */
  const leaveGameSession = useCallback(() => {
    if (gameSession) {
      socketService.leaveGameSession(gameSession.id);
      setGameSession(null);
    }
  }, [gameSession]);

  /**
   * Register event handler for a specific event
   * @param {string} namespace - Socket namespace
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  const registerEvent = useCallback((namespace, event, callback) => {
    // Register with socket service
    socketService.onNamespace(namespace, event, callback);

    // Store in events state
    setEvents(prev => ({
      ...prev,
      [`${namespace}:${event}`]: callback
    }));

    // Return unregister function
    return () => {
      socketService.offNamespace(namespace, event, callback);
      setEvents(prev => {
        const newEvents = { ...prev };
        delete newEvents[`${namespace}:${event}`];
        return newEvents;
      });
    };
  }, []);

  /**
   * Emit event to socket namespace
   * @param {string} namespace - Socket namespace
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  const emitEvent = useCallback((namespace, event, data) => {
    socketService.emitToNamespace(namespace, event, data);
  }, []);

  /**
   * Activate buzzer for current player
   * @param {string} questionId - Current question ID
   */
  const activateBuzzer = useCallback((questionId) => {
    socketService.activateBuzzer(questionId);
  }, []);

  /**
   * Submit answer for current question
   * @param {string} questionId - Question ID
   * @param {string} answer - Player's answer
   * @param {number} timeToAnswer - Time taken to answer in milliseconds
   */
  const submitAnswer = useCallback((questionId, answer, timeToAnswer) => {
    socketService.submitAnswer(questionId, answer, timeToAnswer);
  }, []);

  /**
   * Update player status
   * @param {string} status - Player status
   */
  const updatePlayerStatus = useCallback((status) => {
    socketService.updatePlayerStatus(status);
  }, []);

  /**
   * Send chat message in game
   * @param {string} message - Chat message
   */
  const sendChatMessage = useCallback((message) => {
    socketService.sendChatMessage(message);
  }, []);

  // Create context value
  const value = {
    isConnected,
    socketError,
    gameSession,
    needsRegistration,
    setNeedsRegistration,
    connectToNamespace,
    joinGameSession,
    leaveGameSession,
    registerEvent,
    emitEvent,
    activateBuzzer,
    submitAnswer,
    updatePlayerStatus,
    sendChatMessage
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

/**
 * Custom hook to use the socket context
 * @returns {Object} Socket context
 */
export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

export default SocketContext;
