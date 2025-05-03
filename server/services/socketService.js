/**
 * Socket.io Service
 * Handles all real-time communication for game sessions
 */
const { GameSession, Player } = require('../models');
const { handleTestConnection } = require('./testSocketService');
const { 
  handleStartGame,
  handleNextQuestion,
  handleEndQuestion,
  handlePauseGame,
  handleResumeGame,
  handleEndGame,
  questionTimers,
  roundTimers
} = require('./hostEventHandlers');
const {
  handleRoundStart,
  handleRoundEnd,
  handlePointBuilderRound,
  handleFastestFingerRound,
  handleGraduatedPointsRound
} = require('./roundEventHandlers');
const {
  handleQuestionNext,
  handleQuestionReveal,
  handleAnswerSubmit,
  handleAnswerCorrect,
  handleAnswerIncorrect
} = require('./questionEventHandlers');
const { withErrorHandling } = require('./socketErrorHandler');
const socketMonitoring = require('./socketMonitoring');
const socketRecovery = require('./socketRecovery');

// Socket.io connection store to track users
const connectedUsers = new Map(); // Maps playerId to Set of socket IDs
const userSockets = new Map();    // Maps socket ID to playerId
const gameRooms = new Map();      // Maps gameCode to game session info
const buzzerQueue = new Map();    // Maps gameCode to array of buzzer activations
const activeQuestions = new Map(); // Maps gameCode to current active question
const playerAnswers = new Map();   // Maps gameCode_questionId to Map of playerId -> answer
const playerStatuses = new Map();  // Maps playerId to current status (active, away, etc.)

/**
 * Initialize Socket.io server
 * @param {Server} io - Socket.io server instance
 */
function initialize(io) {
  // Middleware for authentication - bypass for test namespace
  io.use(async (socket, next) => {
    try {
      // Skip auth for testing namespace
      if (socket.nsp.name === '/test') {
        return next();
      }
      
      const playerId = socket.handshake.auth.playerId;
      const gameSessionId = socket.handshake.auth.gameSessionId;
      const isHost = socket.handshake.auth.isHost || false;
      
      if (!playerId) {
        return next(new Error('Authentication error: Player ID required'));
      }
      
      // Store the player ID in the socket for later use
      socket.playerId = playerId;
      socket.gameSessionId = gameSessionId;
      socket.isHost = isHost;
      
      // If game session specified, verify player is in the session
      if (gameSessionId) {
        const gameSession = await GameSession.findById(gameSessionId);
        if (!gameSession) {
          return next(new Error('Game session not found'));
        }
        
        // Hosts don't need to be in the player list
        if (!isHost) {
          const isPlayerInSession = gameSession.players.some(
            player => player.playerId.toString() === playerId
          );
          
          if (!isPlayerInSession) {
            return next(new Error('Player not in this game session'));
          }
        }
        
        socket.gameSessionCode = gameSession.code;
      }
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Internal server error'));
    }
  });

  // Initialize monitoring
  socketMonitoring.initializeMonitoring(io);

  // Handle new connections
  io.on('connection', (socket) => {
    // Check if this is a reconnection
    socketRecovery.handleReconnection(socket, io);
    
    // Continue with normal connection handling
    handleConnection(socket);
    
    // Handle disconnection with recovery
    socket.on('disconnect', () => {
      socketRecovery.handleDisconnection(socket, io);
      handleDisconnect(socket);
    });
  });
  
  // Set up game namespace for game-specific events
  const gameNamespace = io.of('/game');
  gameNamespace.use(authMiddleware);
  gameNamespace.on('connection', handleGameConnection);
  
  // Set up player namespace for player-specific events
  const playerNamespace = io.of('/player');
  playerNamespace.use(authMiddleware);
  playerNamespace.on('connection', handlePlayerConnection);
  
  // Set up host namespace for game master events
  const hostNamespace = io.of('/host');
  hostNamespace.use(authMiddleware);
  hostNamespace.on('connection', handleHostConnection);
  
  // Set up admin namespace for administrative tasks
  const adminNamespace = io.of('/admin');
  adminNamespace.use(adminAuthMiddleware);
  adminNamespace.on('connection', handleAdminConnection);
  
  // Set up test namespace for development testing
  const testNamespace = io.of('/test');
  testNamespace.on('connection', handleTestConnection);
  
  // Setup heartbeat to detect disconnections
  setInterval(() => checkConnections(io), 30000);
  
  console.log('Socket.io initialized with all namespaces');
  return io;
}

/**
 * Authentication middleware for Socket.io namespaces
 * @param {Socket} socket - Socket.io socket instance
 * @param {Function} next - Next function
 */
async function authMiddleware(socket, next) {
  try {
    const playerId = socket.handshake.auth.playerId;
    const gameSessionId = socket.handshake.auth.gameSessionId;
    
    if (!playerId) {
      return next(new Error('Authentication error: Player ID required'));
    }
    
    // Store the player ID in the socket for later use
    socket.playerId = playerId;
    socket.gameSessionId = gameSessionId;
    
    // Additional namespace-specific validation could be added here
    
    next();
  } catch (error) {
    console.error('Socket namespace authentication error:', error);
    next(new Error('Internal server error'));
  }
}

/**
 * Admin authentication middleware
 * @param {Socket} socket - Socket.io socket instance
 * @param {Function} next - Next function
 */
async function adminAuthMiddleware(socket, next) {
  try {
    const adminToken = socket.handshake.auth.adminToken;
    
    if (!adminToken || adminToken !== process.env.ADMIN_SECRET) {
      return next(new Error('Admin authentication failed'));
    }
    
    next();
  } catch (error) {
    console.error('Admin socket authentication error:', error);
    next(new Error('Internal server error'));
  }
}

/**
 * Check active connections and clean up stale ones
 * @param {Server} io - Socket.io server instance
 */
function checkConnections(io) {
  for (const [playerId, sockets] of connectedUsers.entries()) {
    // If player has no active sockets, clean up
    if (sockets.size === 0) {
      connectedUsers.delete(playerId);
      continue;
    }
    
    // Check each socket for connection
    for (const socketId of sockets) {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket || !socket.connected) {
        sockets.delete(socketId);
        userSockets.delete(socketId);
      }
    }
    
    // Remove player if all sockets disconnected
    if (sockets.size === 0) {
      connectedUsers.delete(playerId);
    }
  }
}

/**
 * Handle general socket connections
 * @param {Socket} socket - Socket.io socket instance
 */
function handleConnection(socket) {
  const playerId = socket.playerId;
  console.log(`Player connected: ${playerId} (Socket ID: ${socket.id})`);
  
  // Store socket in connected users map
  if (!connectedUsers.has(playerId)) {
    connectedUsers.set(playerId, new Set());
  }
  connectedUsers.get(playerId).add(socket.id);
  
  // Store mapping from socket ID to player ID
  userSockets.set(socket.id, playerId);
}

/**
 * Handle game-specific socket connections
 * @param {Socket} socket - Socket.io socket instance
 */
function handleGameConnection(socket) {
  const playerId = socket.playerId;
  const gameSessionId = socket.gameSessionId;
  const gameSessionCode = socket.gameSessionCode;
  
  console.log(`Player ${playerId} connected to game session ${gameSessionId}`);
  
  // Join the game room
  if (gameSessionCode) {
    socket.join(gameSessionCode);
    
    // Notify other players in the room
    socket.to(gameSessionCode).emit('player:joined', { playerId });
    
    // Welcome message to the player
    socket.emit('game:welcome', { message: `Welcome to game ${gameSessionCode}` });
  }
  
  // Game event handlers
  socket.on('game:join', (data) => handleGameJoin(socket, data));
  socket.on('game:leave', (data) => handleGameLeave(socket, data));
  socket.on('buzzer:activate', (data) => handleBuzzerActivate(socket, data));
  socket.on('chat:message', (data) => handleChatMessage(socket, data));
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Player ${playerId} disconnected from game session ${gameSessionId}`);
    
    if (gameSessionCode) {
      socket.to(gameSessionCode).emit('player:left', { playerId });
      socket.leave(gameSessionCode);
    }
  });
}

/**
 * Handle player connection to the player namespace
 * @param {Socket} socket - Socket.io socket instance
 */
function handlePlayerConnection(socket) {
  try {
    console.log(`Player connected to player namespace: ${socket.playerId}`);
    
    // Add socket to player's room
    socket.join(socket.playerId);
    
    // Add socket to game room if in a game
    if (socket.gameSessionCode) {
      socket.join(socket.gameSessionCode);
    }
    
    // Track connection
    addPlayerConnection(socket);
    
    // Send initial player data
    sendPlayerData(socket);
    
    // Set up event listeners
    socket.on('player:ready', withErrorHandling(socket, handlePlayerReady));
    socket.on('player:buzzer', withErrorHandling(socket, handlePlayerBuzzer));
    socket.on('player:answer', withErrorHandling(socket, handlePlayerAnswer));
    socket.on('player:status', withErrorHandling(socket, handlePlayerStatus));
    socket.on('game:join', withErrorHandling(socket, handleGameJoin));
    socket.on('game:leave', withErrorHandling(socket, handleGameLeave));
    socket.on('chat:message', withErrorHandling(socket, handleChatMessage));
    
    // Add new event handlers for questions and answers
    socket.on('answer:submit', withErrorHandling(socket, handleAnswerSubmit));
    
    // Handle disconnection
    socket.on('disconnect', () => {
      handlePlayerDisconnect(socket);
    });
  } catch (error) {
    console.error('Error in player connection handler:', error);
  }
}

/**
 * Handle host connection to the host namespace
 * @param {Socket} socket - Socket.io socket instance
 */
function handleHostConnection(socket) {
  try {
    console.log(`Host connected to host namespace: ${socket.playerId}`);
    
    // Add socket to host's room
    socket.join(`host:${socket.playerId}`);
    
    // Add socket to game room if in a game
    if (socket.gameSessionCode) {
      socket.join(socket.gameSessionCode);
    }
    
    // Track connection
    addPlayerConnection(socket);
    
    // Send initial game data if in a game
    if (socket.gameSessionId) {
      sendGameData(socket, socket.gameSessionId);
    }
    
    // Set up event listeners for host actions
    socket.on('host:startGame', withErrorHandling(socket, handleStartGame));
    socket.on('host:nextQuestion', withErrorHandling(socket, handleNextQuestion));
    socket.on('host:endQuestion', withErrorHandling(socket, handleEndQuestion));
    socket.on('host:pauseGame', withErrorHandling(socket, handlePauseGame));
    socket.on('host:resumeGame', withErrorHandling(socket, handleResumeGame));
    socket.on('host:endGame', withErrorHandling(socket, handleEndGame));
    
    // Round management
    socket.on('round:start', withErrorHandling(socket, handleRoundStart));
    socket.on('round:end', withErrorHandling(socket, handleRoundEnd));
    
    // Special round handlers
    socket.on('round:pointBuilder', withErrorHandling(socket, handlePointBuilderRound));
    socket.on('round:fastestFinger', withErrorHandling(socket, handleFastestFingerRound));
    socket.on('round:graduatedPoints', withErrorHandling(socket, handleGraduatedPointsRound));
    
    // Add new event handlers for questions and answers
    socket.on('question:next', withErrorHandling(socket, handleQuestionNext));
    socket.on('question:reveal', withErrorHandling(socket, handleQuestionReveal));
    socket.on('answer:correct', withErrorHandling(socket, handleAnswerCorrect));
    socket.on('answer:incorrect', withErrorHandling(socket, handleAnswerIncorrect));
    
    // General game management
    socket.on('game:join', withErrorHandling(socket, handleGameJoin));
    socket.on('game:leave', withErrorHandling(socket, handleGameLeave));
    socket.on('chat:message', withErrorHandling(socket, handleChatMessage));
    
    // Handle disconnection
    socket.on('disconnect', () => {
      handleDisconnect(socket);
    });
  } catch (error) {
    console.error('Error in host connection handler:', error);
  }
}

/**
 * Handle admin connection to the admin namespace
 * @param {Socket} socket - Socket.io socket instance
 */
function handleAdminConnection(socket) {
  console.log('Admin connected to admin namespace');
  
  // Admin-specific event handlers
  socket.on('admin:stats', (data) => handleAdminStats(socket, data));
  socket.on('admin:games', (data) => handleAdminGames(socket, data));
  socket.on('admin:players', (data) => handleAdminPlayers(socket, data));
  socket.on('admin:terminate', (data) => handleAdminTerminate(socket, data));
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Admin disconnected from admin namespace');
  });
  
  // Send initial admin data
  sendAdminStats(socket);
}

/**
 * Send player data to the connected player
 * @param {Socket} socket - Socket.io socket instance
 */
async function sendPlayerData(socket) {
  try {
    const playerId = socket.playerId;
    const gameSessionId = socket.gameSessionId;
    
    // Get player data
    const player = await Player.findById(playerId);
    if (!player) {
      return socket.emit('error', { message: 'Player not found' });
    }
    
    // Get game data if in a game
    let gameData = null;
    if (gameSessionId) {
      const gameSession = await GameSession.findById(gameSessionId);
      if (gameSession) {
        gameData = {
          id: gameSession._id,
          code: gameSession.code,
          status: gameSession.status,
          currentRound: gameSession.currentRound,
          hostId: gameSession.hostId
        };
      }
    }
    
    // Send player data
    socket.emit('player:data', {
      player: {
        id: player._id,
        name: player.name,
        avatar: player.avatar,
        score: player.score
      },
      game: gameData
    });
  } catch (error) {
    console.error('Error sending player data:', error);
    socket.emit('error', { message: 'Failed to load player data' });
  }
}

/**
 * Send game data to the connected host
 * @param {Socket} socket - Socket.io socket instance
 * @param {string} gameSessionId - Game session ID
 */
async function sendGameData(socket, gameSessionId) {
  try {
    // Get game data
    const gameSession = await GameSession.findById(gameSessionId)
      .populate('players.playerId', 'name avatar');
    
    if (!gameSession) {
      return socket.emit('error', { message: 'Game session not found' });
    }
    
    // Format player data
    const players = gameSession.players.map(p => ({
      id: p.playerId._id,
      name: p.playerId.name,
      avatar: p.playerId.avatar,
      score: p.score,
      active: p.active,
      position: p.position,
      isOnline: isPlayerOnline(p.playerId._id.toString())
    }));
    
    // Send game data
    socket.emit('game:data', {
      id: gameSession._id,
      code: gameSession.code,
      status: gameSession.status,
      currentRound: gameSession.currentRound,
      rounds: gameSession.rounds,
      players,
      startedAt: gameSession.startedAt,
      lastUpdatedAt: gameSession.lastUpdatedAt
    });
  } catch (error) {
    console.error('Error sending game data:', error);
    socket.emit('error', { message: 'Failed to load game data' });
  }
}

/**
 * Send admin stats to the connected admin
 * @param {Socket} socket - Socket.io socket instance
 */
async function sendAdminStats(socket) {
  try {
    // Get active game count
    const activeGameCount = await GameSession.countDocuments({ status: 'active' });
    
    // Get player count
    const playerCount = await Player.countDocuments();
    
    // Get active player count (players in active games)
    const activePlayerCount = connectedUsers.size;
    
    // Send admin stats
    socket.emit('admin:stats', {
      activeGames: activeGameCount,
      totalPlayers: playerCount,
      onlinePlayers: activePlayerCount,
      activeSockets: userSockets.size,
      serverTimestamp: Date.now()
    });
  } catch (error) {
    console.error('Error sending admin stats:', error);
    socket.emit('error', { message: 'Failed to load admin stats' });
  }
}

/**
 * Handle player ready event
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Ready data
 */
async function handlePlayerReady(socket, data) {
  try {
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    
    if (!gameSessionId) {
      return socket.emit('error', { message: 'Not in a game session' });
    }
    
    // Update player ready status in the game
    const gameSession = await GameSession.findById(gameSessionId);
    if (!gameSession) {
      return socket.emit('error', { message: 'Game session not found' });
    }
    
    // Find the player in the session
    const playerIndex = gameSession.players.findIndex(p => 
      p.playerId.toString() === playerId
    );
    
    if (playerIndex === -1) {
      return socket.emit('error', { message: 'Player not in this game session' });
    }
    
    // Update ready status
    gameSession.players[playerIndex].ready = true;
    await gameSession.save();
    
    // Notify the game host
    socket.to(gameSession.code + ':host').emit('player:ready', {
      playerId,
      timestamp: Date.now()
    });
    
    // Confirm to the player
    socket.emit('ready:confirmed', {
      gameSessionId,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error handling player ready:', error);
    socket.emit('error', { message: 'Failed to update ready status' });
  }
}

/**
 * Handle player buzzer event
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Buzzer data
 */
async function handlePlayerBuzzer(socket, data) {
  try {
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    const gameSessionCode = socket.gameSessionCode;
    
    if (!gameSessionCode) {
      return socket.emit('error', { message: 'Not in a game session' });
    }
    
    const timestamp = Date.now();
    const questionId = data?.questionId;
    
    // Check if there's an active question for this game
    const currentQuestion = activeQuestions.get(gameSessionCode);
    if (!currentQuestion && questionId) {
      // Add check to make sure the buzzer is for the current question
      if (questionId !== currentQuestion?.id) {
        return socket.emit('error', { message: 'Invalid question or buzzer timing' });
      }
    }
    
    // Add to buzzer queue if not already in it
    if (!buzzerQueue.has(gameSessionCode)) {
      buzzerQueue.set(gameSessionCode, []);
    }
    
    const queue = buzzerQueue.get(gameSessionCode);
    const playerAlreadyBuzzed = queue.some(item => item.playerId === playerId);
    
    if (!playerAlreadyBuzzed) {
      queue.push({
        playerId,
        timestamp,
        questionId
      });
      
      // Sort queue by timestamp (earliest first)
      queue.sort((a, b) => a.timestamp - b.timestamp);
      
      // Update the player's position in the queue after sorting
      const playerPosition = queue.findIndex(item => item.playerId === playerId) + 1;
      
      // Log the buzzer activation for debugging
      console.log(`Player ${playerId} buzzed in at position ${playerPosition} for game ${gameSessionCode}`);
      
      // Notify the game host - use the host namespace specifically
      socket.to(gameSessionCode + ':host').emit('buzzer:activated', {
        playerId,
        position: playerPosition,
        timestamp,
        questionId
      });
      
      // Notify all players in the game
      socket.to(gameSessionCode).emit('buzzer:player-activated', {
        playerId,
        position: playerPosition,
        timestamp
      });
      
      // Confirm to the player who buzzed
      socket.emit('buzzer:confirmed', {
        position: playerPosition,
        timestamp,
        questionId
      });
      
      // If this is the first buzzer, we might want to handle it specially
      if (playerPosition === 1) {
        socket.to(gameSessionCode + ':host').emit('buzzer:first', {
          playerId,
          timestamp,
          questionId
        });
      }
    } else {
      // Player already buzzed, just send their current position
      const playerPosition = queue.findIndex(item => item.playerId === playerId) + 1;
      socket.emit('buzzer:confirmed', {
        position: playerPosition,
        timestamp,
        questionId,
        alreadyBuzzed: true
      });
    }
  } catch (error) {
    console.error('Error handling buzzer activation:', error);
    socket.emit('error', { message: 'Failed to activate buzzer' });
  }
}

/**
 * Handle player answer event
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Answer data
 */
async function handlePlayerAnswer(socket, data) {
  try {
    const { questionId, answer, answerIndex, timeToAnswer, roundType, timestamp, timedOut } = data;
    const gameSessionCode = socket.gameSessionCode;
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    
    if (!gameSessionCode) {
      return socket.emit('error', { message: 'Not in a game session' });
    }
    
    if (!questionId) {
      return socket.emit('error', { message: 'Question ID is required' });
    }
    
    if (answer === undefined && answerIndex === undefined && !timedOut) {
      return socket.emit('error', { message: 'Answer is required' });
    }
    
    const currentTimestamp = timestamp || Date.now();
    
    // Check if there's an active question for this game
    const currentQuestion = activeQuestions.get(gameSessionCode);
    
    // Make sure the answer is for the current question
    if (currentQuestion && questionId && currentQuestion.id !== questionId) {
      return socket.emit('error', { message: 'Answer submitted for incorrect question' });
    }
    
    // Store the player's answer in the in-memory map
    const answerKey = `${gameSessionCode}_${questionId}`;
    if (!playerAnswers.has(answerKey)) {
      playerAnswers.set(answerKey, new Map());
    }
    
    const questionAnswers = playerAnswers.get(answerKey);
    const playerHasAnswered = questionAnswers.has(playerId);
    
    // Check if player has already answered this question (except for open rounds)
    if (playerHasAnswered && roundType !== 'open') {
      return socket.emit('error', { 
        message: 'You have already submitted an answer for this question',
        questionId
      });
    }
    
    // Store the answer with metadata
    questionAnswers.set(playerId, {
      answer,
      answerIndex,
      timeToAnswer,
      timestamp: currentTimestamp,
      roundType,
      timedOut: timedOut || false
    });
    
    try {
      // Handle different round types
      if (roundType === 'point-builder' || roundType === 'pointBuilder') {
        // Use the Point Builder round handler
        const pointBuilderHandler = require('./pointBuilderRoundHandler');
        const result = await pointBuilderHandler.processPointBuilderAnswer(socket, {
          questionId,
          answerIndex: answerIndex !== undefined ? answerIndex : -1,
          timestamp: currentTimestamp,
          timedOut: timedOut || false
        });
        
        // If the answer was already submitted, return early
        if (result.alreadyAnswered) {
          return socket.emit('error', { 
            message: result.message,
            questionId
          });
        }
        
        // Update the player's score in real-time
        if (result.success) {
          socket.emit('player:score', {
            score: result.totalScore,
            pointsEarned: result.pointsEarned,
            isCorrect: result.isCorrect
          });
        }
      }
      // Handle Graduated Points round
      else if (roundType === 'graduated-points') {
        // Use the Graduated Points round handler
        const graduatedPointsHandler = require('./graduatedPointsRoundHandler');
        const result = await graduatedPointsHandler.processGraduatedPointsAnswer(socket, {
          questionId,
          answerIndex: answerIndex !== undefined ? answerIndex : -1,
          timestamp: currentTimestamp,
          responseTime: data.responseTime,
          timedOut: timedOut || false
        });
        
        // If the answer was already submitted, return early
        if (result.alreadyAnswered) {
          return socket.emit('error', { 
            message: result.message,
            questionId
          });
        }
        
        // Update the player's score in real-time
        if (result.success) {
          socket.emit('player:score', {
            score: result.totalScore,
            pointsEarned: result.pointsEarned,
            isCorrect: result.isCorrect
          });
        }
      }
      // For buzzer-based rounds, check if the player is allowed to answer
      else if (roundType === 'fastest-finger' || roundType === 'buzzer') {
        // Get the buzzer queue for this game
        const queue = buzzerQueue.get(gameSessionCode) || [];
        
        // Check if the player is at the top of the queue
        const playerPosition = queue.findIndex(item => item.playerId === playerId) + 1;
        
        // Only process answers from the first player in the buzzer queue for fastest-finger rounds
        if (roundType === 'fastest-finger' && playerPosition !== 1) {
          return socket.emit('error', { 
            message: 'Only the first player to buzz can answer in this round',
            questionId
          });
        }
        
        // For buzzer rounds, make sure the player has buzzed in
        if (roundType === 'buzzer' && playerPosition === 0) {
          return socket.emit('error', { 
            message: 'You must buzz in before answering this question',
            questionId
          });
        }
      }
      
      // Get player data for the response
      const player = await Player.findById(playerId).select('name avatar');
      
      // Notify the game host
      socket.to(gameSessionCode + ':host').emit('answer:submitted', {
        playerId,
        playerName: player?.name || 'Unknown Player',
        playerAvatar: player?.avatar,
        questionId,
        answer,
        answerIndex,
        timeToAnswer,
        timestamp: currentTimestamp,
        roundType,
        timedOut: timedOut || false
      });
      
      // Notify all players in the game (without showing the answer)
      socket.to(gameSessionCode).emit('player:answered', {
        playerId,
        playerName: player?.name || 'Unknown Player',
        timeToAnswer,
        timestamp: currentTimestamp
      });
      
      // Confirm to the player
      socket.emit('answer:received', {
        questionId,
        answer,
        answerIndex,
        timestamp: currentTimestamp
      });
      
      console.log(`Player ${playerId} submitted answer for question ${questionId} in game ${gameSessionCode}`);
    } catch (dbError) {
      console.error('Database error while processing answer:', dbError);
      // Continue with the function even if the database operation fails
      socket.emit('error', { message: 'Error processing answer', error: dbError.message });
    }
  } catch (error) {
    console.error('Error handling player answer:', error);
    socket.emit('error', { message: 'Failed to submit answer' });
  }
}

/**
 * Handle player status updates
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Status data
 */
async function handlePlayerStatus(socket, data) {
  try {
    const { status } = data;
    const playerId = socket.playerId;
    const gameSessionCode = socket.gameSessionCode;
    
    // Update player status in database if needed
    if (status === 'active') {
      await Player.findByIdAndUpdate(playerId, { lastActive: new Date() });
    }
    
    // Broadcast status to relevant clients
    if (gameSessionCode) {
      socket.to(gameSessionCode).emit('player:status', { playerId, status });
      socket.to(gameSessionCode + ':host').emit('player:status', { playerId, status });
    }
  } catch (error) {
    console.error('Error handling player status:', error);
    socket.emit('error', { message: 'Failed to update status' });
  }
}

/**
 * Handle game join events
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Join data
 */
async function handleGameJoin(socket, data) {
  try {
    const { gameSessionId, gameCode } = data;
    const playerId = socket.playerId;
    
    // Find game session by ID or code
    const gameSession = gameSessionId 
      ? await GameSession.findById(gameSessionId)
      : await GameSession.findByCode(gameCode);
    
    if (!gameSession) {
      return socket.emit('error', { message: 'Game session not found' });
    }
    
    // Add player to game session
    const player = await Player.findById(playerId);
    if (!player) {
      return socket.emit('error', { message: 'Player not found' });
    }
    
    // Check if player is already in the session
    const playerInGame = gameSession.players.some(p => 
      p.playerId.toString() === playerId
    );
    
    if (!playerInGame) {
      // Check if game has maximum player limit
      if (gameSession.maxPlayers && gameSession.players.length >= gameSession.maxPlayers) {
        return socket.emit('error', { 
          message: 'Game session is full', 
          code: 'GAME_FULL' 
        });
      }
      
      // Add player to game via the controller/model
      gameSession.players.push({
        playerId,
        name: player.name,
        avatar: player.avatar,
        score: 0,
        position: gameSession.players.length + 1,
        joinedAt: new Date(),
        active: true,
        ready: false
      });
      
      await gameSession.save();
    }
    
    // Update socket with game info
    socket.gameSessionId = gameSession._id.toString();
    socket.gameSessionCode = gameSession.code;
    
    // Join the game room
    socket.join(gameSession.code);
    
    // Notify other players in the room
    socket.to(gameSession.code).emit('player:joined', { 
      playerId,
      playerName: player.name,
      playerAvatar: player.avatar
    });
    
    // Send game state to the player
    socket.emit('game:state', {
      gameSessionId: gameSession._id,
      gameCode: gameSession.code,
      status: gameSession.status,
      players: gameSession.players,
      hostId: gameSession.hostId
    });
  } catch (error) {
    console.error('Error handling game join:', error);
    socket.emit('error', { message: 'Failed to join game' });
  }
}

/**
 * Handle game leave events
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Leave data
 */
async function handleGameLeave(socket, data) {
  try {
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    
    if (!gameSessionId) {
      return socket.emit('error', { message: 'Not in a game session' });
    }
    
    const gameSession = await GameSession.findById(gameSessionId);
    if (!gameSession) {
      return socket.emit('error', { message: 'Game session not found' });
    }
    
    // Find the player in the session
    const playerIndex = gameSession.players.findIndex(p => 
      p.playerId.toString() === playerId
    );
    
    if (playerIndex === -1) {
      return socket.emit('error', { message: 'Player not in this game session' });
    }
    
    // If game is active, mark player as inactive instead of removing
    if (gameSession.status === 'active') {
      gameSession.players[playerIndex].active = false;
    } else {
      // Remove player from session
      gameSession.players.splice(playerIndex, 1);
    }
    
    // Update player positions
    gameSession.updatePlayerPositions();
    
    await gameSession.save();
    
    // Leave the game room
    socket.leave(gameSession.code);
    
    // Notify other players in the room
    socket.to(gameSession.code).emit('player:left', { playerId });
    
    // Reset socket game info
    socket.gameSessionId = null;
    socket.gameSessionCode = null;
    
    // Confirm to the player
    socket.emit('game:left', { gameSessionId });
  } catch (error) {
    console.error('Error handling game leave:', error);
    socket.emit('error', { message: 'Failed to leave game' });
  }
}

/**
 * Handle buzzer activation
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Buzzer data
 */
function handleBuzzerActivate(socket, data) {
  try {
    const gameSessionCode = socket.gameSessionCode;
    const playerId = socket.playerId;
    
    if (!gameSessionCode) {
      return socket.emit('error', { message: 'Not in a game session' });
    }
    
    // Broadcast buzzer activation to all players in the game
    socket.to(gameSessionCode).emit('buzzer:activated', { 
      playerId,
      timestamp: Date.now()
    });
    
    // Also let the buzzer activator know it was registered
    socket.emit('buzzer:confirmed', {
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error handling buzzer activation:', error);
    socket.emit('error', { message: 'Failed to activate buzzer' });
  }
}

/**
 * Handle game start event
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Game start data
 */
async function handleGameStart(socket, data) {
  try {
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    
    if (!gameSessionId) {
      return socket.emit('error', { message: 'No game session ID provided' });
    }
    
    // Find game session
    const gameSession = await GameSession.findById(gameSessionId);
    if (!gameSession) {
      return socket.emit('error', { message: 'Game session not found' });
    }
    
    // Verify user is the host of this game
    if (gameSession.hostId.toString() !== playerId) {
      return socket.emit('error', { message: 'Only the host can start the game' });
    }
    
    // Check if game can be started (must be in waiting/lobby state)
    if (gameSession.status !== 'waiting' && gameSession.status !== 'lobby') {
      return socket.emit('error', { 
        message: `Cannot start game in '${gameSession.status}' status`,
        code: 'INVALID_GAME_STATE'
      });
    }
    
    // Update game state in database
    gameSession.status = 'active';
    gameSession.startedAt = new Date();
    gameSession.lastUpdatedAt = new Date();
    
    // Set initial round if provided
    if (data.initialRound) {
      gameSession.currentRound = data.initialRound;
    } else if (!gameSession.currentRound) {
      gameSession.currentRound = 1;
    }
    
    // Set initial round type if provided
    if (data.roundType) {
      gameSession.currentRoundType = data.roundType;
    }
    
    await gameSession.save();
    
    // Notify all players in the game room
    socket.to(gameSession.code).emit('game:started', {
      gameSessionId: gameSession._id,
      status: gameSession.status,
      currentRound: gameSession.currentRound,
      roundType: gameSession.currentRoundType,
      startedAt: gameSession.startedAt,
      config: data.config || {},
      timestamp: Date.now()
    });
    
    // Confirm to the host
    socket.emit('game:started', {
      gameSessionId: gameSession._id,
      status: gameSession.status,
      currentRound: gameSession.currentRound,
      roundType: gameSession.currentRoundType,
      startedAt: gameSession.startedAt,
      config: data.config || {},
      timestamp: Date.now()
    });
    
    console.log(`Game ${gameSession.code} started by host ${playerId}`);
  } catch (error) {
    console.error('Error handling game start:', error);
    socket.emit('error', { 
      message: 'Failed to start game', 
      details: error.message 
    });
  }
}

/**
 * Handle game pause event
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Game pause data
 */
async function handleGamePause(socket, data) {
  try {
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    
    if (!gameSessionId) {
      return socket.emit('error', { message: 'No game session ID provided' });
    }
    
    // Find game session
    const gameSession = await GameSession.findById(gameSessionId);
    if (!gameSession) {
      return socket.emit('error', { message: 'Game session not found' });
    }
    
    // Verify user is the host
    if (gameSession.hostId.toString() !== playerId) {
      return socket.emit('error', { message: 'Only the host can pause the game' });
    }
    
    // Check if game can be paused (must be in active state)
    if (gameSession.status !== 'active') {
      return socket.emit('error', { 
        message: `Cannot pause game in '${gameSession.status}' status`,
        code: 'INVALID_GAME_STATE'
      });
    }
    
    // Get current timestamp for pause time calculation
    const pausedAt = new Date();
    
    // Update game state in database
    gameSession.status = 'paused';
    gameSession.pausedAt = pausedAt;
    gameSession.lastUpdatedAt = pausedAt;
    await gameSession.save();
    
    // Store any active timers that need to be paused
    const pauseData = {
      pausedAt,
      currentQuestion: activeQuestions.get(gameSession.code),
      reason: data?.reason || 'Host paused the game'
    };
    
    // Notify all players in the game room
    socket.to(gameSession.code).emit('game:paused', {
      gameSessionId: gameSession._id,
      pausedAt,
      reason: pauseData.reason,
      timestamp: Date.now()
    });
    
    // Confirm to the host
    socket.emit('game:paused', {
      gameSessionId: gameSession._id,
      pausedAt,
      reason: pauseData.reason,
      timestamp: Date.now()
    });
    
    console.log(`Game ${gameSession.code} paused by host ${playerId}`);
  } catch (error) {
    console.error('Error handling game pause:', error);
    socket.emit('error', { 
      message: 'Failed to pause game', 
      details: error.message 
    });
  }
}

/**
 * Handle game resume event
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Game resume data
 */
async function handleGameResume(socket, data) {
  try {
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    
    if (!gameSessionId) {
      return socket.emit('error', { message: 'No game session ID provided' });
    }
    
    // Find game session
    const gameSession = await GameSession.findById(gameSessionId);
    if (!gameSession) {
      return socket.emit('error', { message: 'Game session not found' });
    }
    
    // Verify user is the host
    if (gameSession.hostId.toString() !== playerId) {
      return socket.emit('error', { message: 'Only the host can resume the game' });
    }
    
    // Check if game can be resumed (must be in paused state)
    if (gameSession.status !== 'paused') {
      return socket.emit('error', { 
        message: `Cannot resume game in '${gameSession.status}' status`,
        code: 'INVALID_GAME_STATE'
      });
    }
    
    // Calculate pause duration
    const resumedAt = new Date();
    const pauseDuration = gameSession.pausedAt ? resumedAt - gameSession.pausedAt : 0;
    
    // Update game state in database
    gameSession.status = 'active';
    gameSession.pausedAt = null;
    gameSession.lastUpdatedAt = resumedAt;
    await gameSession.save();
    
    // Notify all players in the game room
    socket.to(gameSession.code).emit('game:resumed', {
      gameSessionId: gameSession._id,
      resumedAt,
      pauseDuration,
      timestamp: Date.now()
    });
    
    // Confirm to the host
    socket.emit('game:resumed', {
      gameSessionId: gameSession._id,
      resumedAt,
      pauseDuration,
      timestamp: Date.now()
    });
    
    console.log(`Game ${gameSession.code} resumed by host ${playerId} after ${pauseDuration}ms pause`);
  } catch (error) {
    console.error('Error handling game resume:', error);
    socket.emit('error', { 
      message: 'Failed to resume game', 
      details: error.message 
    });
  }
}

/**
 * Handle game end event
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Game end data
 */
async function handleGameEnd(socket, data) {
  try {
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    
    if (!gameSessionId) {
      return socket.emit('error', { message: 'No game session ID provided' });
    }
    
    // Find game session
    const gameSession = await GameSession.findById(gameSessionId);
    if (!gameSession) {
      return socket.emit('error', { message: 'Game session not found' });
    }
    
    // Verify user is the host
    if (gameSession.hostId.toString() !== playerId) {
      return socket.emit('error', { message: 'Only the host can end the game' });
    }
    
    // Check if game can be ended (must be in active or paused state)
    if (gameSession.status !== 'active' && gameSession.status !== 'paused') {
      return socket.emit('error', { 
        message: `Cannot end game in '${gameSession.status}' status`,
        code: 'INVALID_GAME_STATE'
      });
    }
    
    const endedAt = new Date();
    
    // Get final scores and player rankings
    const playerScores = gameSession.players
      .map(p => ({
        playerId: p.playerId,
        score: p.score,
        position: p.position
      }))
      .sort((a, b) => b.score - a.score);
      
    // Find winners (can be multiple in case of tie)
    const topScore = playerScores.length > 0 ? playerScores[0].score : 0;
    const winners = playerScores
      .filter(p => p.score === topScore)
      .map(p => p.playerId);
    
    // Create game summary
    const gameSummary = {
      duration: endedAt - gameSession.startedAt,
      playerCount: gameSession.players.length,
      scores: playerScores,
      winners,
      rounds: gameSession.rounds,
      endReason: data?.reason || 'Host ended the game'
    };
    
    // Save game history
    try {
      const { GameHistory } = require('../models');
      await GameHistory.create({
        gameId: gameSession._id,
        code: gameSession.code,
        startedAt: gameSession.startedAt,
        endedAt,
        players: gameSession.players.map(p => ({
          playerId: p.playerId,
          score: p.score,
          position: p.position
        })),
        rounds: gameSession.rounds,
        summary: gameSummary
      });
    } catch (historyError) {
      console.error('Error saving game history:', historyError);
      // Continue even if history save fails
    }
    
    // Update game state in database
    gameSession.status = 'completed';
    gameSession.endedAt = endedAt;
    gameSession.lastUpdatedAt = endedAt;
    gameSession.summary = gameSummary;
    await gameSession.save();
    
    // Notify all players in the game room
    socket.to(gameSession.code).emit('game:ended', {
      gameSessionId: gameSession._id,
      endedAt,
      summary: gameSummary,
      timestamp: Date.now()
    });
    
    // Confirm to the host
    socket.emit('game:ended', {
      gameSessionId: gameSession._id,
      endedAt,
      summary: gameSummary,
      timestamp: Date.now()
    });
    
    console.log(`Game ${gameSession.code} ended by host ${playerId}`);
    
    // Clean up game resources
    if (buzzerQueue.has(gameSession.code)) {
      buzzerQueue.delete(gameSession.code);
    }
    
    if (activeQuestions.has(gameSession.code)) {
      activeQuestions.delete(gameSession.code);
    }
    
  } catch (error) {
    console.error('Error handling game end:', error);
    socket.emit('error', { 
      message: 'Failed to end game', 
      details: error.message 
    });
  }
}

/**
 * Handle chat messages
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Chat message data
 */
function handleChatMessage(socket, data) {
  try {
    const { message } = data;
    const gameSessionCode = socket.gameSessionCode;
    const playerId = socket.playerId;
    
    if (!gameSessionCode) {
      return socket.emit('error', { message: 'Not in a game session' });
    }
    
    // Broadcast message to all players in the game
    socket.to(gameSessionCode).emit('chat:message', {
      playerId,
      message,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error handling chat message:', error);
    socket.emit('error', { message: 'Failed to send message' });
  }
}

/**
 * Handle socket disconnection
 * @param {Socket} socket - Socket.io socket instance
 */
function handleDisconnect(socket) {
  const socketId = socket.id;
  const playerId = userSockets.get(socketId);
  
  console.log(`Socket disconnected: ${socketId} (Player: ${playerId})`);
  
  // Remove socket from tracking maps
  if (playerId && connectedUsers.has(playerId)) {
    const userSockets = connectedUsers.get(playerId);
    userSockets.delete(socketId);
    
    // Remove player entry if no sockets left
    if (userSockets.size === 0) {
      connectedUsers.delete(playerId);
    }
  }
  
  userSockets.delete(socketId);
}

/**
 * Get all connected sockets for a player
 * @param {string} playerId - Player ID
 * @returns {Array} Array of socket IDs
 */
function getPlayerSockets(playerId) {
  return connectedUsers.has(playerId) 
    ? Array.from(connectedUsers.get(playerId))
    : [];
}

/**
 * Check if a player is online
 * @param {string} playerId - Player ID
 * @returns {boolean} True if player is online
 */
function isPlayerOnline(playerId) {
  return connectedUsers.has(playerId) && connectedUsers.get(playerId).size > 0;
}

/**
 * Handle player join event
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Join data including gameCode and optional playerName, avatar
 */
async function handlePlayerJoin(socket, data) {
  try {
    const { gameCode, playerName, avatar } = data;
    const playerId = socket.playerId;
    
    // Validate inputs
    if (!gameCode) {
      return socket.emit('error', { message: 'Game code is required to join a game' });
    }
    
    if (!playerId) {
      return socket.emit('error', { message: 'Player ID is required' });
    }
    
    // Find game session by code
    const gameSession = await GameSession.findOne({ code: gameCode });
    if (!gameSession) {
      return socket.emit('error', { message: 'Game session not found', code: 'GAME_NOT_FOUND' });
    }
    
    // Check if game is accepting new players
    if (gameSession.status !== 'waiting' && gameSession.status !== 'lobby') {
      return socket.emit('error', { 
        message: 'Cannot join game that has already started or ended',
        code: 'GAME_NOT_JOINABLE' 
      });
    }
    
    // Get player details from database
    const player = await Player.findById(playerId);
    if (!player) {
      return socket.emit('error', { message: 'Player not found', code: 'PLAYER_NOT_FOUND' });
    }
    
    // Update player details if provided
    if (playerName || avatar) {
      if (playerName) player.name = playerName;
      if (avatar) player.avatar = avatar;
      await player.save();
    }
    
    // Check if player is already in the session
    const playerInGame = gameSession.players.some(p => 
      p.playerId.toString() === playerId
    );
    
    let isRejoining = false;
    
    if (!playerInGame) {
      // Check if game has maximum player limit
      if (gameSession.maxPlayers && gameSession.players.length >= gameSession.maxPlayers) {
        return socket.emit('error', { 
          message: 'Game session is full', 
          code: 'GAME_FULL' 
        });
      }
      
      // Add player to game
      gameSession.players.push({
        playerId,
        score: 0,
        position: gameSession.players.length + 1,
        joinedAt: new Date(),
        active: true
      });
      
      await gameSession.save();
      
      console.log(`Player ${playerId} (${player.name}) joined game ${gameCode}`);
    } else {
      // Update player status to active if they're rejoining
      const playerIndex = gameSession.players.findIndex(p => 
        p.playerId.toString() === playerId
      );
      
      if (playerIndex !== -1) {
        gameSession.players[playerIndex].active = true;
        gameSession.players[playerIndex].lastActive = new Date();
        await gameSession.save();
        
        isRejoining = true;
        console.log(`Player ${playerId} (${player.name}) rejoined game ${gameCode}`);
      }
    }
    
    // Update socket with game info
    socket.gameSessionId = gameSession._id.toString();
    socket.gameSessionCode = gameCode;
    
    // Join the game room
    socket.join(gameCode);
    
    // If part of a team, also join team room
    if (gameSession.teams && player.teamId) {
      socket.join(`${gameCode}:team:${player.teamId}`);
    }
    
    // Join player specific room for direct messages
    socket.join(`${gameCode}:player:${playerId}`);
    
    // Notify host of the new player
    socket.to(gameCode + ':host').emit('player:joined', {
      playerId,
      playerName: player.name,
      playerAvatar: player.avatar,
      isRejoining,
      timestamp: Date.now()
    });
    
    // Notify other players in the room
    socket.to(gameCode).emit('player:joined', { 
      playerId,
      playerName: player.name,
      playerAvatar: player.avatar,
      isRejoining
    });
    
    // Send game state to the player
    socket.emit('game:joined', {
      gameSessionId: gameSession._id,
      gameCode,
      status: gameSession.status,
      currentRound: gameSession.currentRound,
      roundType: gameSession.currentRoundType,
      players: gameSession.players.map(p => ({
        id: p.playerId,
        score: p.score,
        active: p.active,
        ready: p.ready
      })),
      hostId: gameSession.hostId,
      timestamp: Date.now()
    });
    
    // Update player status to online
    await playerStatuses.set(playerId, 'active');
    
    // Store connection in the connected users map
    if (!connectedUsers.has(playerId)) {
      connectedUsers.set(playerId, new Set());
    }
    connectedUsers.get(playerId).add(socket.id);
    
    // Store mapping from socket ID to player ID
    userSockets.set(socket.id, playerId);
    
  } catch (error) {
    console.error('Error handling player join:', error);
    socket.emit('error', { 
      message: 'Failed to join game', 
      details: error.message,
      code: 'JOIN_ERROR' 
    });
  }
}

/**
 * Handle player leave event
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Optional leave data
 */
async function handlePlayerLeave(socket, data) {
  try {
    const gameSessionCode = socket.gameSessionCode;
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    
    // Validate inputs
    if (!gameSessionCode || !gameSessionId) {
      return socket.emit('error', { message: 'Not in a game session', code: 'NOT_IN_GAME' });
    }
    
    if (!playerId) {
      return socket.emit('error', { message: 'Player ID is required', code: 'PLAYER_REQUIRED' });
    }
    
    // Find the game session
    const gameSession = await GameSession.findById(gameSessionId);
    if (!gameSession) {
      return socket.emit('error', { message: 'Game session not found', code: 'GAME_NOT_FOUND' });
    }
    
    // Find the player in the session
    const playerIndex = gameSession.players.findIndex(p => 
      p.playerId.toString() === playerId
    );
    
    if (playerIndex === -1) {
      return socket.emit('error', { message: 'Player not in this game session', code: 'PLAYER_NOT_IN_GAME' });
    }
    
    const player = await Player.findById(playerId).select('name teamId');
    const playerName = player ? player.name : 'Unknown Player';
    const leaveReason = data?.reason || 'left';
    
    // If game is active, mark player as inactive instead of removing
    if (gameSession.status === 'active') {
      gameSession.players[playerIndex].active = false;
      gameSession.players[playerIndex].lastActive = new Date();
      
      // Check if this affects team-based gameplay
      if (gameSession.isTeamBased && player?.teamId) {
        // Update team status if needed
        const teamMembersStillActive = gameSession.players.some(p => 
          p.playerId.toString() !== playerId && 
          p.active &&
          p.teamId && 
          p.teamId.toString() === player.teamId.toString()
        );
        
        if (!teamMembersStillActive) {
          // Notify that this team is now inactive
          socket.to(gameSessionCode).emit('team:inactive', {
            teamId: player.teamId,
            timestamp: Date.now()
          });
        }
      }
    } else {
      // Remove player from session
      gameSession.players.splice(playerIndex, 1);
      
      // Update player positions after removal
      gameSession.players.forEach((p, idx) => {
        p.position = idx + 1;
      });
    }
    
    await gameSession.save();
    
    // Leave all game-related rooms
    socket.leave(gameSessionCode);
    socket.leave(`${gameSessionCode}:player:${playerId}`);
    
    // Leave team room if applicable
    if (player?.teamId) {
      socket.leave(`${gameSessionCode}:team:${player.teamId}`);
    }
    
    // Clear game session info from socket
    socket.gameSessionId = null;
    socket.gameSessionCode = null;
    
    // Remove from buzzer queue if present
    if (buzzerQueue.has(gameSessionCode)) {
      const queue = buzzerQueue.get(gameSessionCode);
      const playerQueueIndex = queue.findIndex(item => item.playerId === playerId);
      
      if (playerQueueIndex !== -1) {
        queue.splice(playerQueueIndex, 1);
        
        // Notify host and players that buzzer queue has changed
        socket.to(gameSessionCode + ':host').emit('buzzer:queue-updated', {
          queue: queue.map(item => ({
            playerId: item.playerId,
            position: queue.indexOf(item) + 1,
            timestamp: item.timestamp
          })),
          timestamp: Date.now()
        });
      }
    }
    
    // Notify host with detailed info
    socket.to(gameSessionCode + ':host').emit('player:left', { 
      playerId,
      playerName,
      reason: leaveReason,
      timestamp: Date.now(),
      wasRemoved: data?.wasRemoved || false
    });
    
    // Notify other players with less detail
    socket.to(gameSessionCode).emit('player:left', { 
      playerId,
      playerName,
      reason: leaveReason
    });
    
    // Confirm to the player
    socket.emit('game:left', { 
      gameSessionId,
      gameCode: gameSessionCode,
      timestamp: Date.now()
    });
    
    // Update player status
    playerStatuses.set(playerId, 'inactive');
    
    console.log(`Player ${playerId} (${playerName}) left game ${gameSessionCode}: ${leaveReason}`);
  } catch (error) {
    console.error('Error handling player leave:', error);
    socket.emit('error', { 
      message: 'Failed to leave game', 
      details: error.message,
      code: 'LEAVE_ERROR'
    });
  }
}

/**
 * Handle player disconnect from the socket
 * @param {Socket} socket - Socket.io socket instance
 */
async function handlePlayerDisconnect(socket) {
  try {
    const gameSessionCode = socket.gameSessionCode;
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    
    if (!gameSessionCode || !gameSessionId) {
      return; // Not in a game session, nothing to clean up
    }
    
    // Find the game session
    const gameSession = await GameSession.findById(gameSessionId);
    if (!gameSession) {
      return; // Game session not found
    }
    
    // Find the player in the session
    const playerIndex = gameSession.players.findIndex(p => 
      p.playerId.toString() === playerId
    );
    
    if (playerIndex === -1) {
      return; // Player not in this game session
    }
    
    // If other connections still active for this player, don't mark as inactive
    if (connectedUsers.has(playerId) && connectedUsers.get(playerId).size > 0) {
      return; // Player still has active connections
    }
    
    // Mark player as inactive in the game
    gameSession.players[playerIndex].active = false;
    gameSession.players[playerIndex].lastActive = new Date();
    await gameSession.save();
    
    // Notify host and other players
    socket.to(gameSessionCode + ':host').emit('player:disconnected', { 
      playerId,
      temporary: true // Flag as temporary disconnect
    });
    
    socket.to(gameSessionCode).emit('player:disconnected', { 
      playerId,
      temporary: true
    });
    
    console.log(`Player ${playerId} disconnected from game ${gameSessionCode}`);
  } catch (error) {
    console.error('Error handling player disconnect:', error);
  }
}

/**
 * Expose the socket service API
 */
module.exports = {
  initialize,
  getPlayerSockets,
  isPlayerOnline
};
