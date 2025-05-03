/**
 * Game Session Routes
 * Handles all game session related endpoints
 */
const express = require('express');
const router = express.Router();
const gameSessionController = require('../controllers/gameSessionController');
const { authenticate, authorizeGameMaster, validateGameSessionAccess } = require('../middleware/auth');

// Public routes
router.get('/active', gameSessionController.getActiveGameSessions);
router.get('/code/:code', gameSessionController.getGameSessionByCode);

// Protected routes - require authentication
router.use(authenticate);

// Create a new game session (Game Master only)
router.post(
  '/', 
  authorizeGameMaster, 
  gameSessionController.createGameSession
);

// Get, update, delete game session by ID (Game Master only)
router.get(
  '/:id', 
  validateGameSessionAccess, 
  gameSessionController.getGameSessionById
);

router.put(
  '/:id', 
  validateGameSessionAccess, 
  authorizeGameMaster, 
  gameSessionController.updateGameSession
);

router.delete(
  '/:id', 
  validateGameSessionAccess, 
  authorizeGameMaster, 
  gameSessionController.deleteGameSession
);

// Game session player management
router.get(
  '/:id/players', 
  validateGameSessionAccess, 
  gameSessionController.getGameSessionPlayers
);

// Join/leave game session
router.post(
  '/:id/join', 
  gameSessionController.joinGameSession
);

router.delete(
  '/:id/leave', 
  gameSessionController.leaveGameSession
);

// Game flow control (Game Master only)
router.put(
  '/:id/start', 
  validateGameSessionAccess, 
  authorizeGameMaster, 
  gameSessionController.startGameSession
);

router.put(
  '/:id/end', 
  validateGameSessionAccess, 
  authorizeGameMaster, 
  gameSessionController.endGameSession
);

module.exports = router;
