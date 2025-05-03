/**
 * Service for interacting with the player API endpoints
 * Handles CRUD operations for player data
 */
import axios from 'axios';
import playerService from './playerService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Create a new player
 * @param {Object} playerData - Player data to register
 * @returns {Promise<Object>} The created player data
 */
const registerPlayer = async (playerData) => {
  try {
    // Add device ID to player data
    const playerWithDevice = {
      ...playerData,
      deviceId: playerService.getDeviceId()
    };
    
    const response = await axios.post(`${API_URL}/players`, playerWithDevice);
    
    // Save player ID and data to localStorage
    playerService.savePlayerId(response.data._id);
    playerService.savePlayerData(response.data);
    
    return response.data;
  } catch (error) {
    console.error('Error registering player:', error);
    throw error;
  }
};

/**
 * Get all players
 * @returns {Promise<Array>} Array of all players
 */
const getAllPlayers = async () => {
  try {
    const response = await axios.get(`${API_URL}/players`);
    return response.data;
  } catch (error) {
    console.error('Error getting all players:', error);
    throw error;
  }
};

/**
 * Get player by ID
 * @param {string} playerId - The player's ID
 * @returns {Promise<Object>} The player data
 */
const getPlayerById = async (playerId) => {
  try {
    const response = await axios.get(`${API_URL}/players/${playerId}`);
    return response.data;
  } catch (error) {
    console.error('Error getting player:', error);
    throw error;
  }
};

/**
 * Get player by device ID
 * @returns {Promise<Object|null>} The player data or null if not found
 */
const getPlayerByDevice = async () => {
  try {
    const deviceId = playerService.getDeviceId();
    const response = await axios.get(`${API_URL}/players/device/${deviceId}`);
    
    // Save player ID and data to localStorage if found
    if (response.data) {
      playerService.savePlayerId(response.data._id);
      playerService.savePlayerData(response.data);
    }
    
    return response.data;
  } catch (error) {
    // If 404, player not found for this device, which is a valid case
    if (error.response && error.response.status === 404) {
      return null;
    }
    console.error('Error getting player by device:', error);
    throw error;
  }
};

/**
 * Update player information
 * @param {string} playerId - The player's ID
 * @param {Object} updates - The data to update
 * @returns {Promise<Object>} The updated player data
 */
const updatePlayer = async (playerId, updates) => {
  try {
    const response = await axios.patch(`${API_URL}/players/${playerId}`, updates);
    
    // Update local storage with new data
    playerService.updatePlayerData(response.data);
    
    return response.data;
  } catch (error) {
    console.error('Error updating player:', error);
    throw error;
  }
};

/**
 * Delete a player
 * @param {string} playerId - The player's ID
 * @returns {Promise<Object>} The response data
 */
const deletePlayer = async (playerId) => {
  try {
    const response = await axios.delete(`${API_URL}/players/${playerId}`);
    
    // Clear player data from localStorage
    playerService.clearPlayerData();
    
    return response.data;
  } catch (error) {
    console.error('Error deleting player:', error);
    throw error;
  }
};

/**
 * Get player statistics
 * @param {string} playerId - The player's ID
 * @returns {Promise<Object>} The player statistics
 */
const getPlayerStats = async (playerId) => {
  try {
    const response = await axios.get(`${API_URL}/players/${playerId}/stats`);
    return response.data;
  } catch (error) {
    console.error('Error getting player stats:', error);
    throw error;
  }
};

/**
 * Get top players for leaderboard
 * @param {number} limit - Number of top players to retrieve
 * @returns {Promise<Array>} Array of top players
 */
const getTopPlayers = async (limit = 10) => {
  try {
    const response = await axios.get(`${API_URL}/players/leaderboard/top?limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Error getting top players:', error);
    throw error;
  }
};

/**
 * Check if player exists for current device and load if found
 * @returns {Promise<boolean>} True if player exists, false otherwise
 */
const loadExistingPlayer = async () => {
  try {
    // First check localStorage
    if (playerService.isPlayerRegistered()) {
      return true;
    }
    
    // Then check API by device ID
    const player = await getPlayerByDevice();
    return !!player;
  } catch (error) {
    console.error('Error loading existing player:', error);
    return false;
  }
};

export default {
  registerPlayer,
  getAllPlayers,
  getPlayerById,
  getPlayerByDevice,
  updatePlayer,
  deletePlayer,
  getPlayerStats,
  getTopPlayers,
  loadExistingPlayer
};
