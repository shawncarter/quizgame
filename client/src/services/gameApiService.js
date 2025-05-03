/**
 * Game API Service
 * Handles API calls for game session management
 */
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Create a new game session
 * @param {Object} gameData - Game configuration data
 * @returns {Promise<Object>} The created game session
 */
const createGameSession = async (gameData) => {
  try {
    const response = await axios.post(`${API_URL}/games`, gameData);
    return response.data.data;
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
    const response = await axios.get(`${API_URL}/games/${gameId}`);
    return response.data.data;
  } catch (error) {
    console.error('Error getting game session:', error);
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
    const response = await axios.get(`${API_URL}/games/code/${gameCode}`);
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
    const response = await axios.get(`${API_URL}/games/active?includePrivate=${includePrivate}`);
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
    const response = await axios.put(`${API_URL}/games/${gameId}`, updates);
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
    const response = await axios.put(`${API_URL}/games/${gameId}/start`, {});
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
    const response = await axios.put(`${API_URL}/games/${gameId}/end`, {});
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
    const response = await axios.get(`${API_URL}/games/${gameId}/players`);
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
    const response = await axios.delete(`${API_URL}/games/${gameId}`);
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
    const response = await axios.post(`${API_URL}/games/${gameId}/join`, playerData);
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
    const response = await axios.delete(`${API_URL}/games/${gameId}/leave`);
    return response.data;
  } catch (error) {
    console.error('Error leaving game session:', error);
    throw error;
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
  leaveGameSession
};
