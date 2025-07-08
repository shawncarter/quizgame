/**
 * QR Code Service
 * Handles generation of QR codes for game sessions
 */
const QRCode = require('qrcode');
const { GameSession } = require('../models');
const config = require('../config/app');

/**
 * Generate a QR code for a game session
 * @param {string} gameSessionId - The ID of the game session
 * @param {Object} options - Options for QR code generation
 * @returns {Promise<string>} - Data URL of the generated QR code
 */
async function generateGameSessionQRCode(gameSessionId, options = {}) {
  try {
    // Find the game session to verify it exists and get the code
    const gameSession = await GameSession.findByPk(gameSessionId);
    if (!gameSession) {
      throw new Error(`Game session with ID ${gameSessionId} not found`);
    }

    // Construct the join URL
    const joinUrl = constructJoinUrl(gameSession.code);

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(joinUrl, {
      errorCorrectionLevel: options.errorCorrectionLevel || 'M',
      margin: options.margin || 4,
      scale: options.scale || 4,
      color: {
        dark: options.darkColor || '#000000',
        light: options.lightColor || '#ffffff'
      }
    });

    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error(`Failed to generate QR code: ${error.message}`);
  }
}

/**
 * Generate a QR code for a game session as a Buffer
 * @param {string} gameSessionId - The ID of the game session
 * @param {Object} options - Options for QR code generation
 * @returns {Promise<Buffer>} - Buffer containing the QR code image
 */
async function generateGameSessionQRCodeBuffer(gameSessionId, options = {}) {
  try {
    // Find the game session to verify it exists and get the code
    const gameSession = await GameSession.findByPk(gameSessionId);
    if (!gameSession) {
      throw new Error(`Game session with ID ${gameSessionId} not found`);
    }

    // Construct the join URL
    const joinUrl = constructJoinUrl(gameSession.code);

    // Generate QR code as buffer
    const qrCodeBuffer = await QRCode.toBuffer(joinUrl, {
      errorCorrectionLevel: options.errorCorrectionLevel || 'M',
      margin: options.margin || 4,
      scale: options.scale || 4,
      type: 'png',
      color: {
        dark: options.darkColor || '#000000',
        light: options.lightColor || '#ffffff'
      }
    });

    return qrCodeBuffer;
  } catch (error) {
    console.error('Error generating QR code buffer:', error);
    throw new Error(`Failed to generate QR code buffer: ${error.message}`);
  }
}

/**
 * Generate a QR code string (for SVG rendering)
 * @param {string} gameSessionId - The ID of the game session
 * @param {Object} options - Options for QR code generation
 * @returns {Promise<string>} - String representation of the QR code
 */
async function generateGameSessionQRCodeString(gameSessionId, options = {}) {
  try {
    // Find the game session to verify it exists and get the code
    const gameSession = await GameSession.findByPk(gameSessionId);
    if (!gameSession) {
      throw new Error(`Game session with ID ${gameSessionId} not found`);
    }

    // Construct the join URL
    const joinUrl = constructJoinUrl(gameSession.code);

    // Generate QR code as string
    const qrCodeString = await QRCode.toString(joinUrl, {
      errorCorrectionLevel: options.errorCorrectionLevel || 'M',
      margin: options.margin || 4,
      type: options.stringType || 'svg',
      color: {
        dark: options.darkColor || '#000000',
        light: options.lightColor || '#ffffff'
      }
    });

    return qrCodeString;
  } catch (error) {
    console.error('Error generating QR code string:', error);
    throw new Error(`Failed to generate QR code string: ${error.message}`);
  }
}

/**
 * Generate a QR code directly from a game code
 * @param {string} gameCode - The game session code
 * @param {Object} options - Options for QR code generation
 * @returns {Promise<string>} - Data URL of the generated QR code
 */
async function generateQRCodeFromGameCode(gameCode, options = {}) {
  try {
    // Construct the join URL
    const joinUrl = constructJoinUrl(gameCode);

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(joinUrl, {
      errorCorrectionLevel: options.errorCorrectionLevel || 'M',
      margin: options.margin || 4,
      scale: options.scale || 4,
      color: {
        dark: options.darkColor || '#000000',
        light: options.lightColor || '#ffffff'
      }
    });

    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating QR code from game code:', error);
    throw new Error(`Failed to generate QR code from game code: ${error.message}`);
  }
}

/**
 * Construct the URL for joining a game session
 * @param {string} gameCode - The game session code
 * @returns {string} - The URL for joining the game session
 */
function constructJoinUrl(gameCode) {
  // Get the client URL from config
  const config = require('../config/config');
  const clientUrl = config.CLIENT_URL;

  // Construct the full URL for joining the game
  const joinUrl = `${clientUrl}/join/${gameCode}`;
  console.log('Generated QR code URL:', joinUrl);
  return joinUrl;
}

/**
 * Validate a game code from a QR code
 * @param {string} gameCode - The game code to validate
 * @returns {Promise<boolean>} - Whether the game code is valid
 */
async function validateGameCode(gameCode) {
  try {
    // Check if the game code exists and the session is active
    const { Op } = require('sequelize');
    const gameSession = await GameSession.findOne({
      where: {
        code: gameCode,
        status: {
          [Op.in]: ['waiting', 'lobby', 'active']
        }
      }
    });

    return !!gameSession;
  } catch (error) {
    console.error('Error validating game code:', error);
    return false;
  }
}

module.exports = {
  generateGameSessionQRCode,
  generateGameSessionQRCodeBuffer,
  generateGameSessionQRCodeString,
  generateQRCodeFromGameCode,
  validateGameCode
};
