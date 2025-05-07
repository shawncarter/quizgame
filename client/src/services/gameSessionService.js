/**
 * Game Session Service
 * Handles API calls for game session management
 */
import axios from 'axios';
import playerService from './playerService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Get authentication headers with player token
 * @returns {Object} Headers object with auth token
 */
const getAuthHeaders = () => {
  const token = playerService.getPlayerToken();
  const playerId = playerService.getPlayerId();
  
  if (!token && !playerId) {
    console.warn('No authentication token available');
  }
  
  return {
    headers: {
      'x-auth-token': token || playerId || '',
      'Content-Type': 'application/json'
    }
  };
};

/**
 * Create a new game session
 * @param {Object} gameSettings - Game session settings
 * @returns {Promise<Object>} Created game session
 */
const createGameSession = async (gameSettings) => {
  try {
    const response = await axios.post(`${API_URL}/games`, gameSettings, getAuthHeaders());
    return response.data.data;
  } catch (error) {
    console.error('Error creating game session:', error);
    throw error;
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

export default {
  createGameSession,
  getGameSessionById,
  getGameSessionByCode,
  startGameSession,
  endGameSession,
  updateGameSession,
  getGameSessionPlayers
};
