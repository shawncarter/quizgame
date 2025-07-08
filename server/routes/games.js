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
router.get('/test-game', gameSessionController.createTestGame);

// Protected routes - require authentication
router.use(authenticate);

// Get games hosted by the current player
router.get('/hosted', gameSessionController.getHostedGames);

// Create a new game session (Game Master only)
router.post(
  '/',
  authorizeGameMaster,
  gameSessionController.createGameSession
);

// Get, update, delete game session by ID (Game Master only)
router.get(
  '/:id',
  authenticate,  // Make sure this middleware is correctly applied
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

// Add test players to a game session (for testing purposes)
router.post('/:id/test-players', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { count = 2 } = req.body;
    const { GameSession } = require('../models');

    // Find the game session
    const gameSession = await GameSession.findByPk(id);
    if (!gameSession) {
      return res.status(404).json({ success: false, error: 'Game session not found' });
    }

    // Check if user is the host
    if (gameSession.hostId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Only the host can add test players' });
    }

    // Generate test players
    const testPlayers = [];
    const testNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
    const testSubjects = ['Science', 'History', 'Sports', 'Movies', 'Music', 'Literature', 'Geography', 'Art'];

    for (let i = 0; i < Math.min(count, 8); i++) {
      const testPlayer = {
        id: `test_${Date.now()}_${i}`,
        name: testNames[i] || `TestPlayer${i + 1}`,
        age: 20 + Math.floor(Math.random() * 40),
        specialistSubject: testSubjects[i] || 'General Knowledge',
        avatar: 'test-avatar',
        buzzerSound: 'test-buzzer',
        deviceId: `test_device_${Date.now()}_${i}`,
        isTestPlayer: true,
        requiresSocket: false, // Test players don't need socket connections
        joinedAt: new Date().toISOString(),
        score: 0,
        status: 'connected'
      };
      testPlayers.push(testPlayer);
    }

    // Add test players to the game session
    const currentPlayers = gameSession.players || [];
    const updatedPlayers = [...currentPlayers, ...testPlayers];

    await gameSession.update({
      players: updatedPlayers
    });

    // Emit socket events to notify connected clients
    console.log('Attempting to emit socket events for test players...');
    const io = req.app.get('io');
    if (io) {
      console.log('Socket.io instance found, emitting events...');

      // Notify all clients in the game room
      const gameRoomName = `game-${gameSession.id}`;
      const hostRoomName = `host-${gameSession.hostId}`;

      console.log(`Emitting to game room: ${gameRoomName}`);
      io.to(gameRoomName).emit('playersUpdated', {
        gameSessionId: gameSession.id,
        players: updatedPlayers,
        totalPlayers: updatedPlayers.length
      });

      console.log(`Emitting to host room: ${hostRoomName}`);
      io.to(hostRoomName).emit('gameUpdated', {
        gameSession: gameSession,
        players: updatedPlayers
      });

      // Also emit to the game code room (from logs, I see BXAA68 room)
      const gameCodeRoom = gameSession.code;
      console.log(`Emitting to game code room: ${gameCodeRoom}`);
      io.to(gameCodeRoom).emit('playersUpdated', {
        gameSessionId: gameSession.id,
        players: updatedPlayers,
        totalPlayers: updatedPlayers.length
      });

      console.log('Socket events emitted successfully');
    } else {
      console.error('Socket.io instance not found in req.app');
    }

    res.json({
      success: true,
      data: {
        gameSession: gameSession,
        addedPlayers: testPlayers,
        totalPlayers: updatedPlayers.length
      }
    });

  } catch (error) {
    console.error('Error adding test players:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
