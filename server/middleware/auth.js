/**
 * Authentication middleware for verifying JWT tokens and handling authorization
 */
const jwt = require('jsonwebtoken');
const { jwtSecret, roles } = require('../config/auth');

/**
 * Middleware to verify JWT token
 * Attaches user data to request if valid token is provided
 */
exports.authenticate = (req, res, next) => {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if no token
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'No authentication token, authorization denied' 
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, jwtSecret);
    
    // Add user data to request
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ 
      success: false, 
      error: 'Token is not valid' 
    });
  }
};

/**
 * Middleware to authorize game masters only
 * Must be used after authenticate middleware
 */
exports.authorizeGameMaster = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      error: 'User not authenticated' 
    });
  }

  if (req.user.role !== roles.GAME_MASTER) {
    return res.status(403).json({ 
      success: false, 
      error: 'Access denied: Game Master privileges required' 
    });
  }

  next();
};

/**
 * Middleware to check if user is either game master or the specific player
 * Useful for endpoints that can be accessed by both roles with specific conditions
 */
exports.authorizeGameMasterOrSelf = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      error: 'User not authenticated' 
    });
  }

  // Allow if user is game master
  if (req.user.role === roles.GAME_MASTER) {
    return next();
  }

  // Allow if user is the player themselves (check playerId param)
  const requestedPlayerId = req.params.playerId || req.params.id;
  if (req.user.role === roles.PLAYER && req.user.id === requestedPlayerId) {
    return next();
  }

  // Deny access if neither condition is met
  return res.status(403).json({ 
    success: false, 
    error: 'Access denied: Insufficient privileges' 
  });
};

/**
 * Middleware to validate game session access
 * Ensures the authenticated user has access to the requested game session
 */
exports.validateGameSessionAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not authenticated' 
      });
    }

    const GameSession = require('../models/GameSession');
    const gameSessionId = req.params.sessionId || req.params.id;
    
    if (!gameSessionId) {
      return res.status(400).json({
        success: false,
        error: 'Game session ID not provided'
      });
    }

    const gameSession = await GameSession.findById(gameSessionId);
    
    if (!gameSession) {
      return res.status(404).json({
        success: false,
        error: 'Game session not found'
      });
    }

    // Game masters can access any game session
    if (req.user.role === roles.GAME_MASTER) {
      // If the user is a game master, verify they are the host of this game
      if (gameSession.hostId.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not the host of this game session'
        });
      }
      
      // Add game session to request for future middleware/controllers
      req.gameSession = gameSession;
      return next();
    }

    // Players can only access game sessions they are part of
    if (req.user.role === roles.PLAYER) {
      const isPlayerInSession = gameSession.players.some(
        player => player.playerId.toString() === req.user.id
      );

      if (!isPlayerInSession) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not a player in this game session'
        });
      }
      
      // Add game session to request for future middleware/controllers
      req.gameSession = gameSession;
      return next();
    }

    // If we get here, something is wrong with the role
    return res.status(403).json({
      success: false,
      error: 'Access denied: Invalid role'
    });
    
  } catch (error) {
    console.error('Error validating game session access:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while validating game session access'
    });
  }
};
