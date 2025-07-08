/**
 * Game Session Service
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
  const token = playerService.getPlayerToken();
  const deviceId = playerService.getDeviceId(); // Use device ID instead of player ID

  // Prefer token if available, otherwise use device ID
  const authValue = token || deviceId;

  if (!authValue) {
    console.warn('No authentication token or device ID available');
  }

  return {
    headers: {
      'x-auth-token': authValue,
      'Content-Type': 'application/json'
    }
  };
};

/**
 * Handle authentication errors and attempt recovery
 * @param {Error} error - The error from the API call
 * @param {Function} retryFunction - Function to retry the original call
 * @returns {Promise} - Retry result or throws error
 */
const handleAuthError = async (error, retryFunction) => {
  if (error.response && error.response.status === 401) {
    console.warn('Authentication failed, attempting recovery...');

    // Try to refresh player data from localStorage
    const playerData = localStorage.getItem('quizgame_player_data');
    if (playerData) {
      try {
        const player = JSON.parse(playerData);
        if (player.deviceId) {
          // Update the device ID in playerService
          localStorage.setItem('quizgame_device_id', player.deviceId);
          console.log('Recovered authentication with device ID:', player.deviceId);

          // Retry the original call
          return await retryFunction();
        }
      } catch (parseError) {
        console.error('Failed to parse player data from localStorage:', parseError);
      }
    }

    // If recovery fails, just log the error and continue
    console.warn('Authentication recovery failed, but continuing...');
    // Don't throw an error, just return the original error
    throw error;
  }

  // Re-throw non-auth errors
  throw error;
};

/**
 * Create a new game session
 * @param {Object} gameSettings - Game session settings
 * @returns {Promise<Object>} Created game session
 */
const createGameSession = async (gameSettings) => {
  const makeRequest = async () => {
    const response = await axios.post(`${API_URL}/games`, gameSettings, getAuthHeaders());
    return response.data.data;
  };

  try {
    return await makeRequest();
  } catch (error) {
    console.error('Error creating game session:', error);
    return await handleAuthError(error, makeRequest);
  }
};

/**
 * Get a game session by ID
 * @param {string} gameId - Game session ID
 * @returns {Promise<Object>} Game session
 */
const getGameSessionById = async (gameId) => {
  try {
    const response = await axios.get(`${API_URL}/games/${gameId}`, getAuthHeaders());
    return response.data.data;
  } catch (error) {
    console.error('Error getting game session:', error);
    throw error;
  }
};

/**
 * Get a game session by code
 * @param {string} gameCode - Game session code
 * @returns {Promise<Object>} Game session
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
 * Start a game session
 * @param {string} gameId - Game session ID
 * @returns {Promise<Object>} Updated game session
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
 * @returns {Promise<Object>} Updated game session
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
 * Update game session settings
 * @param {string} gameId - Game session ID
 * @param {Object} updates - Settings to update
 * @returns {Promise<Object>} Updated game session
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
 * Get all players in a game session
 * @param {string} gameId - Game session ID
 * @returns {Promise<Array>} Array of players
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
 * Add test players to a game session
 * @param {string} gameId - Game session ID
 * @param {number} count - Number of test players to add (default: 2)
 * @returns {Promise<Object>} Updated game session with test players
 */
const addTestPlayers = async (gameId, count = 2) => {
  const makeRequest = async () => {
    const response = await axios.post(`${API_URL}/games/${gameId}/test-players`, { count }, getAuthHeaders());
    return response.data.data;
  };

  try {
    return await makeRequest();
  } catch (error) {
    console.error('Error adding test players:', error);
    return await handleAuthError(error, makeRequest);
  }
};

export default {
  createGameSession,
  getGameSessionById,
  getGameSessionByCode,
  startGameSession,
  endGameSession,
  updateGameSession,
  getGameSessionPlayers,
  addTestPlayers
};
