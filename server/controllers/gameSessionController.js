/**
 * Game Session Controller
 * Handles all game session related operations including creation, retrieval, updates, and deletion
 */
const { GameSession, Player } = require('../models');
const { generateUniqueGameCode } = require('../utils/gameUtils');
const mongoose = require('mongoose');

/**
 * Create a new game session
 * @route POST /api/games
 * @access Private (Game Master only)
 */
exports.createGameSession = async (req, res) => {
  try {
    const { maxPlayers, publicGame, allowJoinAfterStart, questionPoolSize } = req.body;
    
    // Host ID should come from authenticated user
    const hostId = req.user.id;
    
    // Generate a unique game code
    const gameCode = await generateUniqueGameCode();
    
    // Create new game session
    const gameSession = new GameSession({
      code: gameCode,
      hostId,
      settings: {
        maxPlayers: maxPlayers || 10,
        publicGame: publicGame !== undefined ? publicGame : true,
        allowJoinAfterStart: allowJoinAfterStart !== undefined ? allowJoinAfterStart : false,
        questionPoolSize: questionPoolSize || 30
      },
      status: 'created'
    });
    
    await gameSession.save();
    
    res.status(201).json({
      success: true,
      data: gameSession
    });
  } catch (error) {
    console.error('Error creating game session:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while creating game session'
    });
  }
};

/**
 * Get a game session by ID
 * @route GET /api/games/:id
 * @access Private (Game Master or active player)
 */
exports.getGameSessionById = async (req, res) => {
  try {
    console.log(`Attempting to fetch game session with ID: ${req.params.id}`);
    console.log(`Request headers:`, req.headers);
    console.log(`User in request:`, req.user);
    
    // Check if the ID is valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log(`Invalid MongoDB ObjectId: ${req.params.id}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid game session ID format'
      });
    }
    
    const gameSession = await GameSession.findById(req.params.id)
      .populate('hostId', 'name avatar')
      .populate('players.playerId', 'name avatar');
    
    if (!gameSession) {
      console.log(`Game session not found with ID: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        error: 'Game session not found'
      });
    }
    
    console.log(`Game session found: ${gameSession._id}, host: ${gameSession.hostId}`);
    
    res.status(200).json({
      success: true,
      data: gameSession
    });
  } catch (error) {
    console.error('Error retrieving game session:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while retrieving game session'
    });
  }
};

/**
 * Get a game session by code
 * @route GET /api/games/code/:code
 * @access Public (for joining games)
 */
exports.getGameSessionByCode = async (req, res) => {
  try {
    const gameSession = await GameSession.findByCode(req.params.code)
      .populate('hostId', 'name avatar');
    
    if (!gameSession) {
      return res.status(404).json({
        success: false,
        error: 'Game session not found'
      });
    }
    
    // Only return limited data for public access
    const sessionData = {
      id: gameSession._id,
      code: gameSession.code,
      host: gameSession.hostId,
      status: gameSession.status,
      playerCount: gameSession.players.length,
      maxPlayers: gameSession.settings.maxPlayers,
      publicGame: gameSession.settings.publicGame,
      allowJoinAfterStart: gameSession.settings.allowJoinAfterStart
    };
    
    res.status(200).json({
      success: true,
      data: sessionData
    });
  } catch (error) {
    console.error('Error retrieving game session by code:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while retrieving game session'
    });
  }
};

/**
 * Get all active game sessions (lobby, active, paused)
 * @route GET /api/games/active
 * @access Public (for browse functionality)
 */
exports.getActiveGameSessions = async (req, res) => {
  try {
    const gameSessions = await GameSession.getActiveGames()
      .populate('hostId', 'name avatar')
      .select('code hostId status players settings.maxPlayers settings.publicGame createdAt');
    
    // Filter out private games unless the request explicitly includes them
    const includePrivate = req.query.includePrivate === 'true';
    const filteredSessions = includePrivate 
      ? gameSessions 
      : gameSessions.filter(session => session.settings.publicGame);
    
    // Transform data for response
    const sessionData = filteredSessions.map(session => ({
      id: session._id,
      code: session.code,
      host: session.hostId,
      status: session.status,
      playerCount: session.players.length,
      maxPlayers: session.settings.maxPlayers,
      createdAt: session.createdAt
    }));
    
    res.status(200).json({
      success: true,
      count: sessionData.length,
      data: sessionData
    });
  } catch (error) {
    console.error('Error retrieving active game sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while retrieving active game sessions'
    });
  }
};

/**
 * Update game session status and settings
 * @route PUT /api/games/:id
 * @access Private (Game Master only)
 */
exports.updateGameSession = async (req, res) => {
  try {
    // Use the gameSession from validateGameSessionAccess middleware
    const gameSession = req.gameSession;
    
    const { status, settings } = req.body;
    
    // Update status if provided and valid
    if (status && ['created', 'lobby', 'active', 'paused', 'completed'].includes(status)) {
      gameSession.status = status;
      
      // Set timestamps based on status changes
      if (status === 'active' && !gameSession.startedAt) {
        gameSession.startedAt = new Date();
      } else if (status === 'completed' && !gameSession.endedAt) {
        gameSession.endedAt = new Date();
      }
    }
    
    // Update settings if provided
    if (settings) {
      if (settings.maxPlayers !== undefined) {
        gameSession.settings.maxPlayers = settings.maxPlayers;
      }
      if (settings.publicGame !== undefined) {
        gameSession.settings.publicGame = settings.publicGame;
      }
      if (settings.allowJoinAfterStart !== undefined) {
        gameSession.settings.allowJoinAfterStart = settings.allowJoinAfterStart;
      }
      if (settings.questionPoolSize !== undefined) {
        gameSession.settings.questionPoolSize = settings.questionPoolSize;
      }
    }
    
    await gameSession.save();
    
    res.status(200).json({
      success: true,
      data: gameSession
    });
  } catch (error) {
    console.error('Error updating game session:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating game session'
    });
  }
};

/**
 * Start a game session (change status to active)
 * @route PUT /api/games/:id/start
 * @access Private (Game Master only)
 */
exports.startGameSession = async (req, res) => {
  try {
    // Use the gameSession from validateGameSessionAccess middleware
    const gameSession = req.gameSession;
    
    // Check if game is in valid state to start
    if (gameSession.status !== 'lobby') {
      return res.status(400).json({
        success: false,
        error: 'Game must be in lobby status to start'
      });
    }
    
    // Check if there are enough players
    if (gameSession.players.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least 2 players are required to start the game'
      });
    }
    
    // Start the game
    await gameSession.startGame();
    
    res.status(200).json({
      success: true,
      data: gameSession
    });
  } catch (error) {
    console.error('Error starting game session:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while starting game session'
    });
  }
};

/**
 * End a game session (change status to completed)
 * @route PUT /api/games/:id/end
 * @access Private (Game Master only)
 */
exports.endGameSession = async (req, res) => {
  try {
    // Use the gameSession from validateGameSessionAccess middleware
    const gameSession = req.gameSession;
    
    // Check if game is in valid state to end
    if (!['active', 'paused'].includes(gameSession.status)) {
      return res.status(400).json({
        success: false,
        error: 'Game must be active or paused to end'
      });
    }
    
    // End the game
    await gameSession.endGame();
    
    res.status(200).json({
      success: true,
      data: gameSession
    });
  } catch (error) {
    console.error('Error ending game session:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while ending game session'
    });
  }
};

/**
 * Join a game session (add player to session)
 * @route POST /api/games/:id/join
 * @access Private (Authenticated players)
 */
exports.joinGameSession = async (req, res) => {
  try {
    const gameSession = await GameSession.findById(req.params.id);
    
    if (!gameSession) {
      return res.status(404).json({
        success: false,
        error: 'Game session not found'
      });
    }
    
    // Check if game is joinable
    if (gameSession.status !== 'created' && gameSession.status !== 'lobby') {
      if (gameSession.status === 'active' && gameSession.settings.allowJoinAfterStart) {
        // Allow joining if the game allows joining after start
      } else {
        return res.status(400).json({
          success: false,
          error: 'This game session cannot be joined at this time'
        });
      }
    }
    
    // Check if game is full
    if (gameSession.players.length >= gameSession.settings.maxPlayers) {
      return res.status(400).json({
        success: false,
        error: 'Game session is full'
      });
    }
    
    // Check if player is already in the game
    const playerId = req.user.id;
    const playerInGame = gameSession.players.some(p => 
      p.playerId.toString() === playerId
    );
    
    if (playerInGame) {
      return res.status(400).json({
        success: false,
        error: 'Player is already in this game session'
      });
    }
    
    // Add player to game session
    gameSession.players.push({
      playerId,
      score: 0,
      position: gameSession.players.length + 1,
      joinedAt: new Date(),
      active: true
    });
    
    // If this is the first player, change status to lobby
    if (gameSession.players.length === 1 && gameSession.status === 'created') {
      gameSession.status = 'lobby';
    }
    
    await gameSession.save();
    
    // Populate player details for the response
    const updatedSession = await GameSession.findById(gameSession._id)
      .populate('hostId', 'name avatar')
      .populate('players.playerId', 'name avatar');
    
    res.status(200).json({
      success: true,
      data: updatedSession
    });
  } catch (error) {
    console.error('Error joining game session:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while joining game session'
    });
  }
};

/**
 * Leave a game session (remove player from session)
 * @route DELETE /api/games/:id/leave
 * @access Private (Authenticated players)
 */
exports.leaveGameSession = async (req, res) => {
  try {
    const gameSession = await GameSession.findById(req.params.id);
    
    if (!gameSession) {
      return res.status(404).json({
        success: false,
        error: 'Game session not found'
      });
    }
    
    const playerId = req.user.id;
    
    // Find the player in the session
    const playerIndex = gameSession.players.findIndex(p => 
      p.playerId.toString() === playerId
    );
    
    if (playerIndex === -1) {
      return res.status(400).json({
        success: false,
        error: 'Player is not in this game session'
      });
    }
    
    // If game is active, mark player as inactive instead of removing
    if (gameSession.status === 'active') {
      gameSession.players[playerIndex].active = false;
    } else {
      // Remove player from session
      gameSession.players.splice(playerIndex, 1);
    }
    
    // If all players left and game isn't active, delete the session
    if (gameSession.players.length === 0 && gameSession.status !== 'active') {
      await GameSession.findByIdAndDelete(gameSession._id);
      return res.status(200).json({
        success: true,
        message: 'Game session deleted as all players left'
      });
    }
    
    // Update player positions
    gameSession.updatePlayerPositions();
    
    await gameSession.save();
    
    res.status(200).json({
      success: true,
      message: 'Successfully left game session'
    });
  } catch (error) {
    console.error('Error leaving game session:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while leaving game session'
    });
  }
};

/**
 * Get all players in a game session
 * @route GET /api/games/:id/players
 * @access Private (Game Master or active player)
 */
exports.getGameSessionPlayers = async (req, res) => {
  try {
    const gameSession = await GameSession.findById(req.params.id)
      .populate('players.playerId', 'name age specialistSubject avatar');
    
    if (!gameSession) {
      return res.status(404).json({
        success: false,
        error: 'Game session not found'
      });
    }
    
    // Sort by position
    const players = gameSession.players.sort((a, b) => a.position - b.position);
    
    res.status(200).json({
      success: true,
      count: players.length,
      data: players
    });
  } catch (error) {
    console.error('Error retrieving game session players:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while retrieving game session players'
    });
  }
};

/**
 * Delete a game session
 * @route DELETE /api/games/:id
 * @access Private (Game Master only)
 */
exports.deleteGameSession = async (req, res) => {
  try {
    const gameSession = req.gameSession;
    
    await GameSession.findByIdAndDelete(gameSession._id);
    
    res.status(200).json({
      success: true,
      message: 'Game session successfully deleted'
    });
  } catch (error) {
    console.error('Error deleting game session:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting game session'
    });
  }
};
