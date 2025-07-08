/**
 * Authentication configuration
 */
module.exports = {
  // JWT configuration
  jwtSecret: process.env.JWT_SECRET || 'quiz-game-temporary-secret-key',
  jwtExpiration: process.env.JWT_EXPIRATION || '1d',
  
  // JWT expiration times by role
  expiresIn: {
    gameMaster: process.env.JWT_EXPIRATION || '1d',
    player: process.env.JWT_EXPIRATION || '1d'
  },
  
  // User roles
  roles: {
    GAME_MASTER: 'game_master',
    PLAYER: 'player'
  }
};
