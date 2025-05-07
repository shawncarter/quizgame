import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import gameApiService from '../services/gameApiService';
import {
  createHostSocket,
  connectSocket,
  disconnectSocket,
  setupGameMasterHandlers,
  gameMasterEmitters
} from '../services/gameSocketService';
import { usePlayer } from './PlayerContext';
import { io } from 'socket.io-client';

// Import API_URL from the same place it's defined in other services
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Socket.io connection options
const socketOptions = {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000,
  transports: ['websocket', 'polling'] // Try websocket first, fallback to polling
};

// Create the context
const GameContext = createContext();

/**
 * Provider component for game-related state management
 * Handles game session creation, configuration, and real-time updates
 */
export const GameProvider = ({ children }) => {
  const navigate = useNavigate();
  const { player } = usePlayer();

  // Game state
  const [gameSession, setGameSession] = useState(null);
  const [players, setPlayers] = useState([]);
  const [currentRound, setCurrentRound] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [playerAnswers, setPlayerAnswers] = useState({});
  const [scores, setScores] = useState([]);
  const [gameStatus, setGameStatus] = useState('idle'); // idle, loading, active, paused, completed, error
  const [error, setError] = useState(null);

  // Socket state
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Clean up socket connection on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        disconnectSocket(socket);
      }
    };
  }, [socket]);

  /**
   * Connect to the game session as a host
   * @param {string} gameId - Game session ID
   * @param {Object} options - Additional options
   * @param {Object} options.gameSessionData - Optional game session data to use instead of fetching
   */
  const connectToGame = useCallback(async (gameId, options = {}) => {
    try {
      if (!player || !player._id) {
        throw new Error('Player not authenticated');
      }

      // Validate gameId
      if (!gameId) {
        console.error('Cannot connect to game: gameId is undefined or null');
        setError('Game ID is missing. Please create a new game or try again.');
        setGameStatus('error');
        return;
      }

      console.log('=== GAME CONTEXT - CONNECT TO GAME ===');
      console.log(`Attempting to connect to game: ${gameId} as player: ${player._id}`);
      console.log('Current game status:', gameStatus);
      console.log('Current game session:', gameSession);
      console.log('Current error state:', error);
      console.log('Current socket connection:', socket ? 'Connected' : 'Not connected');
      console.log('Current players:', players);
      console.log('Options provided:', options);

      setGameStatus('loading');
      setError(null);

      // Check if we have game session data in location state
      const locationState = window.history.state?.usr;
      console.log('Location state from window.history:', locationState);
      const gameSessionFromState = locationState?.gameSession;

      // Also check localStorage as a backup
      const lastCreatedGameId = localStorage.getItem('lastCreatedGameId');
      const lastCreatedGameCode = localStorage.getItem('lastCreatedGameCode');
      console.log('Last created game ID from localStorage:', lastCreatedGameId);
      console.log('Last created game code from localStorage:', lastCreatedGameCode);

      // Get game session data first
      let gameData;
      try {
        // If we have game session data in options or location state, use it
        if (options?.gameSessionData) {
          console.log('Using provided game session data from options');
          gameData = options.gameSessionData;
          console.log('Game data from options:', gameData);
        } else if (gameSessionFromState && gameSessionFromState._id === gameId) {
          console.log('Using game session data from location state');
          gameData = gameSessionFromState;
          console.log('Game data from location state:', gameData);
        } else {
          // Otherwise fetch from API
          console.log('Fetching game session data from API...');

          // Double check that gameId is valid before making the API call
          if (!gameId || typeof gameId !== 'string' || gameId.trim() === '') {
            throw new Error('Invalid game ID format');
          }

          try {
            gameData = await gameApiService.getGameSessionById(gameId);
            console.log('Game data from API:', gameData);
          } catch (apiCallError) {
            console.error('API call error:', apiCallError);

            // If the API call fails and we have a game ID in localStorage that matches,
            // try to redirect to create a new game
            if (lastCreatedGameId && lastCreatedGameId === gameId) {
              console.log('API call failed but we have a matching game ID in localStorage');
              throw new Error('Game session could not be loaded. Please try creating a new game.');
            } else {
              throw apiCallError; // Re-throw the original error
            }
          }
        }

        // Validate the game data
        if (!gameData || !gameData._id) {
          throw new Error('Game session not found or invalid');
        }

        console.log('Successfully loaded game session:', gameData);
        setGameSession(gameData);

        // Get players in the game session
        // Only fetch players if we didn't get them from location state
        if (!options?.gameSessionData && !gameSessionFromState) {
          const playersData = await gameApiService.getGameSessionPlayers(gameId);
          setPlayers(playersData || []);
          console.log('Loaded players:', playersData?.length || 0);
        } else if (gameData.players) {
          setPlayers(gameData.players);
          console.log('Using players from provided data:', gameData.players.length);
        }
      } catch (apiError) {
        console.error('API Error fetching game data:', apiError);
        const errorMessage = apiError.response?.data?.message || apiError.message || 'Failed to load game session';
        setError(errorMessage);
        setGameStatus('error');
        return; // Exit early if API request fails
      }

      // Create a new socket connection
      console.log('Creating socket connection...');

      // Make sure the socket URL doesn't contain /api
      const baseUrl = API_URL ? API_URL.replace('/api', '') : 'http://localhost:5000';
      console.log('Using socket URL:', baseUrl);

      // Create the socket with the correct URL
      let newSocket = createHostSocket(player._id, gameId);

      // Set up socket event handlers
      setupGameMasterHandlers(newSocket, {
        onGameState: (gameState) => {
          console.log('Received game state update:', gameState);
          if (gameState.gameSession) {
            setGameSession(gameState.gameSession);
          }
          if (gameState.players) {
            setPlayers(gameState.players);
          }
          if (gameState.currentRound) {
            setCurrentRound(gameState.currentRound);
          }
          if (gameState.currentQuestion) {
            setCurrentQuestion(gameState.currentQuestion);
          }
          setGameStatus(gameState.status || 'active');
        },
        onPlayerJoin: (playerData) => {
          console.log('Player joined:', playerData);
          setPlayers(current => {
            const exists = current.some(p => p.playerId._id === playerData.playerId._id);
            if (exists) {
              return current.map(p =>
                p.playerId._id === playerData.playerId._id ? playerData : p
              );
            }
            return [...current, playerData];
          });
        },
        onPlayerLeave: (playerId) => {
          console.log('Player left:', playerId);
          setPlayers(current =>
            current.filter(p => p.playerId._id !== playerId)
          );
        },
        onError: (errorData) => {
          console.error('Socket error:', errorData);
          setError(errorData.message || 'An error occurred with the game connection');
        }
      });

      // Connect to the socket with error handling
      try {
        console.log('Connecting to socket...');

        // Check if the socket URL is correct
        if (newSocket.io.uri.includes('/api/')) {
          console.warn('Socket URL contains /api/ which may cause connection issues. Fixing URL...');
          // Disconnect the current socket
          disconnectSocket(newSocket);

          // Create a new socket with the correct URL
          const baseUrl = API_URL ? API_URL.replace('/api', '') : 'http://localhost:5000';
          console.log('Using corrected socket URL:', `${baseUrl}/host`);

          // Create a new socket with the correct URL
          const correctedSocket = io(`${baseUrl}/host`, {
            ...socketOptions,
            path: '/socket.io',
            auth: {
              playerId: player._id,
              gameSessionId: gameId,
              isHost: true
            }
          });

          // Use the corrected socket
          newSocket = correctedSocket;
        }

        await connectSocket(newSocket);
        setSocket(newSocket);
        setIsConnected(true);
        console.log('Socket successfully connected');

        // Request initial game state via socket
        newSocket.emit('game:request_state');

        // Update game status based on game session status
        setGameStatus(gameData.status || 'active');
      } catch (socketError) {
        console.error('Socket connection error:', socketError);

        // Still set the game session data we already got from API
        if (gameData) {
          setGameSession(gameData);
          setGameStatus(gameData.status || 'unknown');
        }

        // Set a warning but don't fail completely as we have game data
        const errorMessage = socketError.message || 'Unknown socket error';
        const warningMessage = errorMessage.includes('Invalid namespace')
          ? 'Warning: Real-time connection failed due to invalid namespace. The game will work but without real-time updates.'
          : `Warning: Real-time connection failed: ${errorMessage}. Some features may be limited.`;

        setError(warningMessage);
      }
    } catch (error) {
      console.error('Error connecting to game:', error);
      setError(error.message || 'Failed to connect to game');
      setGameStatus('error');
    }
  }, [player, setupGameMasterHandlers]);

  /**
   * Disconnect from the game session
   * @param {boolean} preserveState - Whether to preserve the game state (default: false)
   */
  const disconnectFromGame = useCallback((preserveState = false) => {
    if (socket) {
      disconnectSocket(socket);
      setSocket(null);
      setIsConnected(false);
    }

    // Only reset game state if preserveState is false
    if (!preserveState) {
      setGameSession(null);
      setPlayers([]);
      setCurrentRound(null);
      setCurrentQuestion(null);
      setPlayerAnswers({});
      setScores([]);
      setGameStatus('idle');
      setError(null);
    } else {
      console.log('Disconnected from socket but preserving game state');
    }
  }, [socket]);

  /**
   * Create a new game session
   * @param {Object} gameData - Game configuration data
   */
  const createGame = useCallback(async (gameData) => {
    try {
      if (!player) {
        throw new Error('Player not authenticated');
      }

      setGameStatus('loading');
      setError(null);

      const newGame = await gameApiService.createGameSession(gameData);

      // Navigate to the game master page
      navigate(`/game-master/${newGame._id}`);

      return newGame;
    } catch (err) {
      console.error('Error creating game:', err);
      setError(err.message || 'Failed to create game');
      setGameStatus('error');
      throw err;
    }
  }, [player, navigate]);

  /**
   * Update game session settings
   * @param {Object} updates - Updates to apply to the game session
   */
  const updateGameSettings = useCallback(async (updates) => {
    try {
      if (!gameSession) {
        throw new Error('No active game session');
      }

      const updatedGame = await gameApiService.updateGameSession(gameSession._id, updates);
      setGameSession(updatedGame);

      return updatedGame;
    } catch (err) {
      console.error('Error updating game settings:', err);
      setError(err.message || 'Failed to update game settings');
      throw err;
    }
  }, [gameSession]);

  // Create emitters object if socket exists
  const emitters = socket ? gameMasterEmitters(socket) : {};

  // Game control functions that use both API and socket
  const gameControls = {
    /**
     * Start the game
     */
    startGame: useCallback(async () => {
      try {
        if (!gameSession) {
          throw new Error('No active game session');
        }

        // Update via API
        await gameApiService.startGameSession(gameSession._id);

        // Emit via socket
        if (emitters.startGame) {
          emitters.startGame();
        }

        setGameStatus('active');
      } catch (err) {
        console.error('Error starting game:', err);
        setError(err.message || 'Failed to start game');
        throw err;
      }
    }, [gameSession, emitters]),

    /**
     * End the game
     */
    endGame: useCallback(async () => {
      try {
        if (!gameSession) {
          throw new Error('No active game session');
        }

        // Update via API
        await gameApiService.endGameSession(gameSession._id);

        // Emit via socket
        if (emitters.endGame) {
          emitters.endGame();
        }

        setGameStatus('completed');
      } catch (err) {
        console.error('Error ending game:', err);
        setError(err.message || 'Failed to end game');
        throw err;
      }
    }, [gameSession, emitters]),

    /**
     * Pause the game
     */
    pauseGame: useCallback(() => {
      try {
        if (!gameSession) {
          throw new Error('No active game session');
        }

        // Emit via socket
        if (emitters.pauseGame) {
          emitters.pauseGame();
        }

        setGameStatus('paused');
      } catch (err) {
        console.error('Error pausing game:', err);
        setError(err.message || 'Failed to pause game');
        throw err;
      }
    }, [gameSession, emitters]),

    /**
     * Resume the game
     */
    resumeGame: useCallback(() => {
      try {
        if (!gameSession) {
          throw new Error('No active game session');
        }

        // Emit via socket
        if (emitters.resumeGame) {
          emitters.resumeGame();
        }

        setGameStatus('active');
      } catch (err) {
        console.error('Error resuming game:', err);
        setError(err.message || 'Failed to resume game');
        throw err;
      }
    }, [gameSession, emitters]),

    /**
     * Start a round
     * @param {Object} roundData - Round configuration data
     */
    startRound: useCallback((roundData) => {
      try {
        if (!gameSession) {
          throw new Error('No active game session');
        }

        // Emit via socket
        if (emitters.startRound) {
          emitters.startRound(roundData);
        }
      } catch (err) {
        console.error('Error starting round:', err);
        setError(err.message || 'Failed to start round');
        throw err;
      }
    }, [gameSession, emitters]),

    /**
     * End the current round
     */
    endRound: useCallback(() => {
      try {
        if (!gameSession) {
          throw new Error('No active game session');
        }

        // Emit via socket
        if (emitters.endRound) {
          emitters.endRound();
        }
      } catch (err) {
        console.error('Error ending round:', err);
        setError(err.message || 'Failed to end round');
        throw err;
      }
    }, [gameSession, emitters]),

    /**
     * Move to the next question
     */
    nextQuestion: useCallback(() => {
      try {
        if (!gameSession) {
          throw new Error('No active game session');
        }

        // Emit via socket
        if (emitters.nextQuestion) {
          emitters.nextQuestion();
        }
      } catch (err) {
        console.error('Error moving to next question:', err);
        setError(err.message || 'Failed to move to next question');
        throw err;
      }
    }, [gameSession, emitters]),

    /**
     * Reveal the answer to the current question
     */
    revealAnswer: useCallback(() => {
      try {
        if (!gameSession) {
          throw new Error('No active game session');
        }

        // Emit via socket
        if (emitters.revealAnswer) {
          emitters.revealAnswer();
        }
      } catch (err) {
        console.error('Error revealing answer:', err);
        setError(err.message || 'Failed to reveal answer');
        throw err;
      }
    }, [gameSession, emitters]),

    /**
     * Kick a player from the game
     * @param {string} playerId - ID of the player to kick
     */
    kickPlayer: useCallback((playerId) => {
      try {
        if (!gameSession) {
          throw new Error('No active game session');
        }

        // Emit via socket
        if (emitters.kickPlayer) {
          emitters.kickPlayer({ playerId });
        }

        // Update local state
        setPlayers(prev => prev.filter(p => p._id !== playerId));
      } catch (err) {
        console.error('Error kicking player:', err);
        setError(err.message || 'Failed to kick player');
        throw err;
      }
    }, [gameSession, emitters]),

    /**
     * Send a chat message
     * @param {string} message - Message to send
     */
    sendChatMessage: useCallback((message) => {
      try {
        if (!gameSession) {
          throw new Error('No active game session');
        }

        // Emit via socket
        if (emitters.sendChatMessage) {
          emitters.sendChatMessage({ message });
        }
      } catch (err) {
        console.error('Error sending chat message:', err);
        setError(err.message || 'Failed to send chat message');
        throw err;
      }
    }, [gameSession, emitters]),

    /**
     * Request game state update
     */
    refreshGameState: useCallback(() => {
      try {
        if (!gameSession) {
          throw new Error('No active game session');
        }

        // Emit via socket
        if (emitters.requestGameState) {
          emitters.requestGameState();
        }
      } catch (err) {
        console.error('Error refreshing game state:', err);
        setError(err.message || 'Failed to refresh game state');
        throw err;
      }
    }, [gameSession, emitters]),

    /**
     * Request player list update
     */
    refreshPlayerList: useCallback(() => {
      try {
        if (!gameSession) {
          throw new Error('No active game session');
        }

        // Emit via socket
        if (emitters.requestPlayerList) {
          emitters.requestPlayerList();
        }
      } catch (err) {
        console.error('Error refreshing player list:', err);
        setError(err.message || 'Failed to refresh player list');
        throw err;
      }
    }, [gameSession, emitters])
  };

  // Context value
  const value = {
    gameSession,
    players,
    currentRound,
    currentQuestion,
    playerAnswers,
    scores,
    gameStatus,
    error,
    isConnected,
    isReconnecting,

    // Connection functions
    connectToGame,
    disconnectFromGame,

    // Game management functions
    createGame,
    updateGameSettings,

    // Game control functions
    ...gameControls
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};

// Custom hook for using the game context
export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

export default GameContext;
