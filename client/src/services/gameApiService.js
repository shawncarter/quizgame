/**
 * Game API Service
 * Handles API calls for game session management
 */
import axios from 'axios';
import playerService from './playerService';
import { API_URL } from '../config/config';

/**
 * Get authentication headers with player token
 * @returns {Object} Headers object with auth token
 */
const getAuthHeaders = () => {
  const deviceId = playerService.getDeviceId(); // Use device ID for authentication
  const playerToken = playerService.getPlayerToken();

  const token = playerToken || deviceId; // Prefer token, fallback to device ID

  console.log('Using auth token for API request:', token ? 'Token exists' : 'No token');

  return {
    headers: {
      'x-auth-token': token || '',
      'Content-Type': 'application/json'
    }
  };
};

/**
 * Create a new game session
 * @param {Object} gameData - Game configuration data
 * @returns {Promise<Object>} The created game session
 */
const createGameSession = async (gameData) => {
  try {
    const response = await axios.post(`${API_URL}/games`, gameData, getAuthHeaders());
    const gameSession = response.data.data;

    // Store the game ID and code in localStorage
    localStorage.setItem('lastCreatedGameId', gameSession.id);
    localStorage.setItem('lastCreatedGameCode', gameSession.code);

    return gameSession;
  } catch (error) {
    console.error('Error creating game session:', error);
    throw error;
  }
};

/**
 * Get a game session by ID
 * @param {string} gameId - Game session ID
 * @returns {Promise<Object>} The game session data
 */
const getGameSessionById = async (gameId) => {
  try {
    // Validate gameId before making the API call
    if (!gameId) {
      console.error('Cannot fetch game session: gameId is undefined or null');
      throw new Error('Game ID is required to fetch game session');
    }

    if (typeof gameId !== 'string' || gameId.trim() === '') {
      console.error('Invalid game ID format:', gameId);
      throw new Error('Invalid game ID format');
    }

    console.log(`Fetching game session with ID: ${gameId}`);
    const headers = getAuthHeaders();
    console.log('Using auth headers:', headers);

    // Make sure we're using the correct API URL
    const apiUrl = `${API_URL}/games/${gameId}`;
    console.log('API URL:', apiUrl);

    const response = await axios.get(apiUrl, headers);

    // Validate the response data
    if (!response.data || !response.data.data) {
      console.error('Invalid response format from API:', response);
      throw new Error('Invalid response format from server');
    }

    const gameData = response.data.data;
    console.log('Successfully retrieved game session:', gameData);

    // Store the game ID in localStorage as a backup
    localStorage.setItem('lastCreatedGameId', gameData.id);
    if (gameData.code) {
      localStorage.setItem('lastCreatedGameCode', gameData.code);
    }

    return gameData;
  } catch (error) {
    console.error('Error getting game session:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
};

/**
 * Get a game session by code
 * @param {string} gameCode - Game session code
 * @returns {Promise<Object>} The game session data
 */
const getGameSessionByCode = async (gameCode) => {
  try {
    const response = await axios.get(`${API_URL}/games/code/${gameCode}`, getAuthHeaders());
    return response.data.data;
  } catch (error) {
    console.error('Error getting game session by code:', error);
    throw error;
  }
};

/**
 * Get all active game sessions
 * @param {boolean} includePrivate - Whether to include private games
 * @returns {Promise<Array>} Array of active game sessions
 */
const getActiveGameSessions = async (includePrivate = false) => {
  try {
    const response = await axios.get(`${API_URL}/games/active?includePrivate=${includePrivate}`, getAuthHeaders());
    return response.data.data;
  } catch (error) {
    console.error('Error getting active game sessions:', error);
    throw error;
  }
};

/**
 * Update game session settings
 * @param {string} gameId - Game session ID
 * @param {Object} updates - Updates to apply to the game session
 * @returns {Promise<Object>} The updated game session
 */
const updateGameSession = async (gameId, updates) => {
  try {
    const response = await axios.put(`${API_URL}/games/${gameId}`, updates, getAuthHeaders());
    return response.data.data;
  } catch (error) {
    console.error('Error updating game session:', error);
    throw error;
  }
};

/**
 * Start a game session
 * @param {string} gameId - Game session ID
 * @returns {Promise<Object>} The updated game session
 */
const startGameSession = async (gameId) => {
  try {
    const response = await axios.put(`${API_URL}/games/${gameId}/start`, {}, getAuthHeaders());
    return response.data.data;
  } catch (error) {
    console.error('Error starting game session:', error);
    throw error;
  }
};

/**
 * End a game session
 * @param {string} gameId - Game session ID
 * @returns {Promise<Object>} The updated game session
 */
const endGameSession = async (gameId) => {
  try {
    const response = await axios.put(`${API_URL}/games/${gameId}/end`, {}, getAuthHeaders());
    return response.data.data;
  } catch (error) {
    console.error('Error ending game session:', error);
    throw error;
  }
};

/**
 * Get players in a game session
 * @param {string} gameId - Game session ID
 * @returns {Promise<Array>} Array of players in the game session
 */
const getGameSessionPlayers = async (gameId) => {
  try {
    const response = await axios.get(`${API_URL}/games/${gameId}/players`, getAuthHeaders());
    return response.data.data;
  } catch (error) {
    console.error('Error getting game session players:', error);
    throw error;
  }
};

/**
 * Delete a game session
 * @param {string} gameId - Game session ID
 * @returns {Promise<Object>} The response data
 */
const deleteGameSession = async (gameId) => {
  try {
    const response = await axios.delete(`${API_URL}/games/${gameId}`, getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error('Error deleting game session:', error);
    throw error;
  }
};

/**
 * Join a game session
 * @param {string} gameId - Game session ID
 * @param {Object} playerData - Player data for joining
 * @returns {Promise<Object>} The response data
 */
const joinGameSession = async (gameId, playerData) => {
  try {
    const response = await axios.post(`${API_URL}/games/${gameId}/join`, playerData, getAuthHeaders());
    return response.data.data;
  } catch (error) {
    console.error('Error joining game session:', error);
    throw error;
  }
};

/**
 * Leave a game session
 * @param {string} gameId - Game session ID
 * @returns {Promise<Object>} The response data
 */
const leaveGameSession = async (gameId) => {
  try {
    const response = await axios.delete(`${API_URL}/games/${gameId}/leave`, getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error('Error leaving game session:', error);
    throw error;
  }
};

/**
 * Get games hosted by the current player
 * @returns {Promise<Array>} Array of games hosted by the player
 */
const getHostedGames = async () => {
  try {
    const response = await axios.get(`${API_URL}/games/hosted`, getAuthHeaders());
    return response.data.data;
  } catch (error) {
    console.error('Error getting hosted games:', error);

    // If the endpoint doesn't exist yet, return the last created game from localStorage
    const lastCreatedGameId = localStorage.getItem('lastCreatedGameId');
    const lastCreatedGameCode = localStorage.getItem('lastCreatedGameCode');

    if (lastCreatedGameId) {
      try {
        // Try to fetch the game details
        const gameData = await getGameSessionById(lastCreatedGameId);
        return [gameData];
      } catch (innerError) {
        console.error('Error fetching last created game:', innerError);

        // If we can't fetch the game, return a basic object with the stored data
        if (lastCreatedGameId && lastCreatedGameCode) {
          return [{
            _id: lastCreatedGameId,
            code: lastCreatedGameCode,
            status: 'unknown'
          }];
        }
      }
    }

    // If all else fails, return an empty array
    return [];
  }
};

export default {
  createGameSession,
  getGameSessionById,
  getGameSessionByCode,
  getActiveGameSessions,
  updateGameSession,
  startGameSession,
  endGameSession,
  getGameSessionPlayers,
  deleteGameSession,
  joinGameSession,
  leaveGameSession,
  getHostedGames
};
