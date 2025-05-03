/**
 * Application Configuration
 * Contains global application settings and configuration
 */

module.exports = {
  // Base URL for the application (used for QR codes and links)
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  
  // API version
  apiVersion: 'v1',
  
  // Default game settings
  defaultGameSettings: {
    timeLimit: 30, // seconds per question
    pointsPerQuestion: 10,
    maxPlayers: 20,
    roundTypes: ['point-builder', 'fastest-finger', 'graduated-points', 'specialist']
  },
  
  // QR Code settings
  qrCode: {
    errorCorrectionLevel: 'M',
    margin: 4,
    scale: 4,
    width: 300,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  }
};
