/**
 * Game utility functions
 * Includes helpers for game code generation, game session management, etc.
 */
const { GameSession } = require('../models');

/**
 * Generate a random game code
 * @param {number} length - Length of the code to generate
 * @returns {string} - Random alphanumeric code
 */
function generateRandomCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar looking characters like O/0, I/1
  let code = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars.charAt(randomIndex);
  }
  
  return code;
}

/**
 * Generate a unique game code that doesn't exist in the database
 * @param {number} length - Length of the code to generate
 * @param {number} maxAttempts - Maximum number of attempts to generate a unique code
 * @returns {Promise<string>} - Unique game code
 */
async function generateUniqueGameCode(length = 6, maxAttempts = 10) {
  let attempts = 0;
  let code;
  let existingGame;
  
  do {
    if (attempts >= maxAttempts) {
      throw new Error('Failed to generate a unique game code after maximum attempts');
    }
    
    code = generateRandomCode(length);
    existingGame = await GameSession.findByCode(code);
    attempts++;
  } while (existingGame);
  
  return code;
}

/**
 * Calculate score for a player's answer based on round type and time taken
 * @param {string} roundType - Type of the round (pointBuilder, graduatedPoints, fastestFinger, specialist)
 * @param {boolean} isCorrect - Whether the answer is correct
 * @param {number} timeElapsed - Time taken to answer in milliseconds
 * @param {number} timeLimit - Time limit for the question in seconds
 * @returns {number} - Score to award
 */
function calculateScore(roundType, isCorrect, timeElapsed, timeLimit) {
  if (!isCorrect) return 0;
  
  const timeRatio = 1 - (timeElapsed / (timeLimit * 1000));
  
  switch (roundType) {
    case 'pointBuilder':
      return 100; // Fixed points for correct answers
      
    case 'graduatedPoints':
      // More points for faster answers (100-500)
      return Math.round(100 + Math.max(0, timeRatio * 400));
      
    case 'fastestFinger':
      // Only first correct answer gets points (1000)
      return 1000;
      
    case 'specialist':
      // Specialist questions are worth more (200-1000)
      return Math.round(200 + Math.max(0, timeRatio * 800));
      
    default:
      return 100;
  }
}

module.exports = {
  generateRandomCode,
  generateUniqueGameCode,
  calculateScore
};
