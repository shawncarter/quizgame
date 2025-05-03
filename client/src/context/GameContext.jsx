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
   */
  const connectToGame = useCallback(async (gameId) => {
    try {
      if (!player) {
        throw new Error('Player not authenticated');
      }
      
      setGameStatus('loading');
      setError(null);
      
      // Get game session data
      const gameData = await gameApiService.getGameSessionById(gameId);
      setGameSession(gameData);
      
      // Get players in the game session
      const playersData = await gameApiService.getGameSessionPlayers(gameId);
      setPlayers(playersData);
      
      // Create socket connection
      const newSocket = createHostSocket(player._id, gameId);
      
      // Set up event handlers
      setupGameMasterHandlers(newSocket, {
        onGameState: (data) => {
          setGameSession(data.gameSession);
          setGameStatus(data.gameSession.status);
          if (data.currentRound) setCurrentRound(data.currentRound);
          if (data.currentQuestion) setCurrentQuestion(data.currentQuestion);
        },
        onGamePlayers: (data) => {
          setPlayers(data.players);
        },
        onGameRound: (data) => {
          setCurrentRound(data.round);
        },
        onGameQuestion: (data) => {
          setCurrentQuestion(data.question);
        },
        onGameAnswer: (data) => {
          setPlayerAnswers(prev => ({
            ...prev,
            [data.playerId]: data.answer
          }));
        },
        onGameScores: (data) => {
          setScores(data.scores);
        },
        onPlayerJoin: (data) => {
          setPlayers(prev => [...prev, data.player]);
        },
        onPlayerLeave: (data) => {
          setPlayers(prev => prev.filter(p => p._id !== data.playerId));
        },
        onError: (error) => {
          console.error('Socket error:', error);
          setError(error.message || 'An error occurred');
        },
        onDisconnect: (reason) => {
          console.log('Socket disconnected:', reason);
          setIsConnected(false);
        },
        onReconnect: (attemptNumber) => {
          console.log('Socket reconnected after', attemptNumber, 'attempts');
          setIsConnected(true);
          setIsReconnecting(false);
        },
        onReconnectAttempt: (attemptNumber) => {
          console.log('Socket reconnection attempt:', attemptNumber);
          setIsReconnecting(true);
        },
        onReconnectError: (error) => {
          console.error('Socket reconnection error:', error);
          setIsReconnecting(false);
        },
        onReconnectFailed: () => {
          console.error('Socket reconnection failed');
          setIsReconnecting(false);
          setError('Failed to reconnect to the game server');
        }
      });
      
      // Connect to the socket
      await connectSocket(newSocket);
      setSocket(newSocket);
      setIsConnected(true);
      
      // Update game status based on game session status
      setGameStatus(gameData.status);
      
    } catch (err) {
      console.error('Error connecting to game:', err);
      setError(err.message || 'Failed to connect to game');
      setGameStatus('error');
    }
  }, [player]);
  
  /**
   * Disconnect from the game session
   */
  const disconnectFromGame = useCallback(() => {
    if (socket) {
      disconnectSocket(socket);
      setSocket(null);
      setIsConnected(false);
    }
    
    setGameSession(null);
    setPlayers([]);
    setCurrentRound(null);
    setCurrentQuestion(null);
    setPlayerAnswers({});
    setScores([]);
    setGameStatus('idle');
    setError(null);
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
