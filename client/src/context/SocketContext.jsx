import { createContext, useState, useEffect, useContext, useCallback } from 'react';
import socketService from '../services/socketService';

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

  // Initialize socket connection
  useEffect(() => {
    const handleConnect = () => {
      setIsConnected(true);
      setSocketError(null);
    };

    const handleDisconnect = (namespace, reason) => {
      setIsConnected(false);
      if (reason !== 'io client disconnect') {
        setSocketError(`Connection lost: ${reason}`);
      }
    };

    const handleError = (namespace, error) => {
      setSocketError(error?.message || 'Connection error');
    };

    // Register global event handlers
    socketService.onConnect(handleConnect);
    socketService.onDisconnect(handleDisconnect);
    socketService.onError(handleError);

    // Initialize main socket connection
    socketService.connect();

    return () => {
      // Clean up socket connection on unmount
      socketService.disconnect();
    };
  }, []);

  /**
   * Connect to a socket namespace
   * @param {string} namespace - Namespace to connect to
   * @param {Object} auth - Authentication data
   */
  const connectToNamespace = useCallback((namespace, auth = {}) => {
    socketService.connectToNamespace(namespace, auth);
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
