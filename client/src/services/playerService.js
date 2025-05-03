/**
 * Service for managing player data in local storage
 * Handles saving, retrieving, and clearing player information
 */

// Constants for localStorage keys
const PLAYER_ID_KEY = 'quizgame_player_id';
const PLAYER_DATA_KEY = 'quizgame_player_data';
const DEVICE_ID_KEY = 'quizgame_device_id';

/**
 * Generate a unique device ID for the current browser
 * @returns {string} A unique device ID
 */
const generateDeviceId = () => {
  return 'device_' + Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};

/**
 * Get the device ID from localStorage or generate a new one
 * @returns {string} The device ID
 */
const getDeviceId = () => {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    deviceId = generateDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  
  return deviceId;
};

/**
 * Save player ID to localStorage
 * @param {string} playerId - The player's MongoDB ID
 */
const savePlayerId = (playerId) => {
  localStorage.setItem(PLAYER_ID_KEY, playerId);
};

/**
 * Get player ID from localStorage
 * @returns {string|null} The player ID or null if not found
 */
const getPlayerId = () => {
  return localStorage.getItem(PLAYER_ID_KEY);
};

/**
 * Save player data to localStorage
 * @param {Object} playerData - The player data to save
 */
const savePlayerData = (playerData) => {
  localStorage.setItem(PLAYER_DATA_KEY, JSON.stringify(playerData));
};

/**
 * Get player data from localStorage
 * @returns {Object|null} The player data or null if not found
 */
const getPlayerData = () => {
  const data = localStorage.getItem(PLAYER_DATA_KEY);
  return data ? JSON.parse(data) : null;
};

/**
 * Check if a player is already registered in localStorage
 * @returns {boolean} True if player is registered, false otherwise
 */
const isPlayerRegistered = () => {
  return !!getPlayerId() && !!getPlayerData();
};

/**
 * Clear all player data from localStorage
 */
const clearPlayerData = () => {
  localStorage.removeItem(PLAYER_ID_KEY);
  localStorage.removeItem(PLAYER_DATA_KEY);
  // Note: We don't clear the device ID to maintain device identity
};

/**
 * Update specific fields in the player data
 * @param {Object} updates - Object containing the fields to update
 */
const updatePlayerData = (updates) => {
  const currentData = getPlayerData() || {};
  const updatedData = { ...currentData, ...updates };
  savePlayerData(updatedData);
};

export default {
  getDeviceId,
  savePlayerId,
  getPlayerId,
  savePlayerData,
  getPlayerData,
  isPlayerRegistered,
  clearPlayerData,
  updatePlayerData
};
