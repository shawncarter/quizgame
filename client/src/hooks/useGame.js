import { useState, useEffect, useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';
import socketService from '../services/socketService';
import gameApiService from '../services/gameApiService';

/**
 * Custom hook for game session management
 * @returns {Object} Game session state and methods
 */
export const useGame = () => {
  const [gameSession, setGameSession] = useState(null);
  const [gameStatus, setGameStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);
  const { player } = usePlayer();

  /**
   * Connect to a game session
   * @param {string} gameId - Game session ID
   */
  const connectToGame = useCallback(async (gameId) => {
    try {
      console.log(`Connecting to game ${gameId} as player ${player?.id}`);
      setGameStatus('loading');
      setError(null);

      if (!player || !player?.id) {
        throw new Error('Player not authenticated');
      }

      // First, get the game session data from the API
      const gameData = await gameApiService.getGameSessionById(gameId);
      console.log('Game session data retrieved:', gameData);

      // Store the game session data
      setGameSession(gameData);

      // Connect to the socket server
      const isHost = gameData.hostId === player?.id;
      console.log(`Connecting to socket as ${isHost ? 'host' : 'player'}`);

      // Create socket connection
      const gameSocket = socketService.joinGameSession(
        gameId,
        gameData.code,
        player?.id,
        isHost
      );

      // Set up socket event listeners
      gameSocket.on('game:state', (data) => {
        console.log('Received game state update:', data);
        
        // Ensure ID compatibility between MongoDB and PostgreSQL
        const normalizedData = {
          ...data,
          // Ensure both id and _id are available
          id: data.id || data._id || data.gameSessionId,
          _id: data._id || data.id || data.gameSessionId,
          gameSessionId: data.gameSessionId || data.id || data._id
        };
        
        console.log('Normalized game state data:', normalizedData);
        
        setGameSession(prevState => ({
          ...prevState,
          ...normalizedData
        }));
      });

      gameSocket.on('error', (error) => {
        console.error('Socket error:', error);
        setError(error.message || 'Socket connection error');
      });

      // Store the socket
      setSocket(gameSocket);
      setGameStatus('connected');
    } catch (error) {
      console.error('Error connecting to game:', error);
      setError(error.message || 'Failed to connect to game');
      setGameStatus('error');
    }
  }, [player]);

  /**
   * Disconnect from the current game session
   */
  const disconnectFromGame = useCallback(() => {
    if (socket) {
      console.log('Disconnecting from game socket');
      socket.disconnect();
      setSocket(null);
    }

    setGameSession(null);
    setGameStatus('idle');
    setError(null);
  }, [socket]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        console.log('Cleaning up game socket connection');
        socket.disconnect();
      }
    };
  }, [socket]);

  return {
    gameSession,
    gameStatus,
    error,
    connectToGame,
    disconnectFromGame,
    socket
  };
};