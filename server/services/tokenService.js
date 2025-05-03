/**
 * Service for JWT token generation and validation
 */
const jwt = require('jsonwebtoken');
const { jwtSecret, expiresIn, roles } = require('../config/auth');

/**
 * Generate a token for a game master
 * @param {string} userId - The user/player ID who is hosting the game
 * @param {string} gameSessionId - The ID of the game session
 * @returns {string} JWT token
 */
exports.generateGameMasterToken = (userId, gameSessionId) => {
  const payload = {
    id: userId,
    sessionId: gameSessionId,
    role: roles.GAME_MASTER
  };

  return jwt.sign(payload, jwtSecret, { expiresIn: expiresIn.gameMaster });
};

/**
 * Generate a token for a player
 * @param {string} playerId - The player's ID
 * @param {string} gameSessionId - The ID of the game session
 * @returns {string} JWT token
 */
exports.generatePlayerToken = (playerId, gameSessionId) => {
  const payload = {
    id: playerId,
    sessionId: gameSessionId,
    role: roles.PLAYER
  };

  return jwt.sign(payload, jwtSecret, { expiresIn: expiresIn.player });
};

/**
 * Verify a token and return the decoded data
 * @param {string} token - JWT token to verify
 * @returns {object|null} Decoded token data or null if invalid
 */
exports.verifyToken = (token) => {
  try {
    return jwt.verify(token, jwtSecret);
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return null;
  }
};

/**
 * Generate a unique game code for session identification
 * @returns {string} 6-character alphanumeric code
 */
exports.generateGameCode = () => {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking characters
  let code = '';
  
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }
  
  return code;
};
