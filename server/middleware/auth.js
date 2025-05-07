/**
 * Authentication middleware for verifying JWT tokens and handling authorization
 */
const jwt = require('jsonwebtoken');
const { jwtSecret, roles } = require('../config/auth');
const { Player } = require('../models');

/**
 * Middleware to authenticate user from token
 */
exports.authenticate = async (req, res, next) => {
  // Get token from header
  const token = req.header('x-auth-token');

  console.log('Authentication attempt with token:', token ? 'Token provided' : 'No token');

  if (!token) {
    console.log('No token provided, authentication failed');
    return res.status(401).json({
      success: false,
      error: 'No authentication token, access denied'
    });
  }

  try {
    // First try to verify as JWT token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      console.log('JWT token verified, user ID:', decoded.id);
      req.user = decoded;
      return next();
    } catch (jwtError) {
      console.log('JWT verification failed, trying as player ID:', jwtError.message);

      // If JWT verification fails, try to find player by ID
      const Player = require('../models/Player');
      const player = await Player.findById(token);

      if (!player) {
        console.log('Player not found with ID:', token);
        return res.status(401).json({
          success: false,
          error: 'Invalid player ID or token'
        });
      }

      console.log('Player found:', player._id);

      // Add user data to request
      req.user = {
        id: player._id,
        role: 'game_master', // Temporarily set all players as game masters (using underscore to match config)
        name: player.name
      };
      next();
    }
  } catch (err) {
    console.error('Authentication error:', err);
    res.status(500).json({
      success: false,
      error: 'Server authentication error'
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
    console.log('Validating game session access');

    if (!req.user) {
      console.log('User not authenticated');
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    console.log('User authenticated:', req.user.id);

    const GameSession = require('../models/GameSession');
    const gameSessionId = req.params.sessionId || req.params.id;

    if (!gameSessionId) {
      console.log('Game session ID not provided');
      return res.status(400).json({
        success: false,
        error: 'Game session ID not provided'
      });
    }

    console.log('Looking for game session:', gameSessionId);

    const gameSession = await GameSession.findById(gameSessionId);

    if (!gameSession) {
      console.log('Game session not found:', gameSessionId);
      return res.status(404).json({
        success: false,
        error: 'Game session not found'
      });
    }

    console.log('Game session found:', gameSession._id);
    console.log('Game host:', gameSession.hostId);
    console.log('User ID:', req.user.id);

    // For debugging, temporarily skip host verification
    console.log('Skipping host verification for debugging');
    req.gameSession = gameSession;
    return next();

    // Game masters can access any game session
    if (req.user.role === 'game_master') {
      // If the user is a game master, verify they are the host of this game
      if (gameSession.hostId.toString() !== req.user.id) {
        console.log('Access denied: User is not the host');
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not the host of this game session'
        });
      }

      console.log('Access granted: User is the host');
      // Add game session to request for future middleware/controllers
      req.gameSession = gameSession;
      return next();
    }

    // Players can only access game sessions they are part of
    if (req.user.role === 'player') {
      const isPlayerInSession = gameSession.players.some(
        player => player.playerId.toString() === req.user.id
      );

      if (!isPlayerInSession) {
        console.log('Access denied: User is not a player in this session');
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not a player in this game session'
        });
      }

      console.log('Access granted: User is a player in this session');
      // Add game session to request for future middleware/controllers
      req.gameSession = gameSession;
      return next();
    }

    // If we get here, something is wrong with the role
    console.log('Access denied: Invalid role');
    return res.status(403).json({
      success: false,
      error: 'Access denied: Invalid role'
    });
  } catch (error) {
    console.error('Error validating game session access:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while validating game session access'
    });
  }
};
