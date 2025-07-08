/**
 * Round Event Handlers
 * Implements Socket.io event handlers for round management and game round transitions
 */
const { GameSession, Question } = require('../models');
const { createSocketError } = require('./socketErrorHandler');
const { questionTimers, roundTimers } = require('./hostEventHandlers');
const { processGraduatedPointsAnswer, revealGraduatedPointsAnswer } = require('./graduatedPointsRoundHandler');

/**
 * Handle round:start event
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Round start data
 */
async function handleRoundStart(socket, data) {
  try {
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    const gameSessionCode = socket.gameSessionCode;

    if (!gameSessionId) {
      throw createSocketError('No game session ID provided', 'MISSING_GAME_SESSION');
    }
    
    // Extract round data
    const { roundNumber, roundType } = data;
    if (!roundNumber || !roundType) {
      throw createSocketError('Round number and type are required', 'INVALID_REQUEST');
    }
    
    // Find game session
    const gameSession = await GameSession.findById(gameSessionId);
    if (!gameSession) {
      throw createSocketError('Game session not found', 'GAME_NOT_FOUND');
    }
    
    // Verify user is the host
    if (gameSession.hostId.toString() !== playerId) {
      throw createSocketError('Only the host can start rounds', 'PERMISSION_DENIED');
    }
    
    // Check if game is active
    if (gameSession.status !== 'active' && gameSession.status !== 'ready') {
      throw createSocketError(
        `Cannot start round in '${gameSession.status}' status`,
        'INVALID_GAME_STATE'
      );
    }
    
    // Check if round type is valid
    const validRoundTypes = ['point-builder', 'fastest-finger', 'graduated-points', 'specialist', 'standard'];
    if (!validRoundTypes.includes(roundType)) {
      throw createSocketError(`Invalid round type: ${roundType}`, 'INVALID_ROUND_TYPE');
    }
    
    // Update game session with new round
    gameSession.currentRound = roundNumber;
    gameSession.currentRoundType = roundType;
    gameSession.lastUpdatedAt = new Date();
    
    // Initialize round settings based on type
    const roundSettings = getRoundSettings(roundType, data);
    
    // Map round type to database enum values
    const roundTypeMap = {
      'point-builder': 'pointBuilder',
      'fastest-finger': 'fastestFinger',
      'graduated-points': 'graduatedPoints',
      'specialist': 'specialist'
    };
    
    const dbRoundType = roundTypeMap[roundType];
    if (!dbRoundType) {
      throw createSocketError(`Invalid round type: ${roundType}`, 'INVALID_ROUND_TYPE');
    }
    
    // Generate title based on round type
    const roundTitles = {
      'point-builder': 'Point Builder Round',
      'fastest-finger': 'Fastest Finger First',
      'graduated-points': 'Graduated Points Round',
      'specialist': 'Specialist Round'
    };
    
    // Find or create round in rounds array
    let currentRound = gameSession.rounds.find(r => r.roundNumber === roundNumber);
    if (!currentRound) {
      currentRound = {
        roundNumber: roundNumber,
        type: dbRoundType,
        title: roundTitles[roundType] || `Round ${roundNumber}`,
        description: `${roundTitles[roundType]} - ${roundNumber}`,
        questions: [],
        timeLimit: roundSettings.timeLimit || 30,
        completed: false,
        startTime: new Date()
      };
      gameSession.rounds.push(currentRound);
    } else {
      // Update existing round
      currentRound.type = dbRoundType;
      currentRound.title = roundTitles[roundType] || `Round ${roundNumber}`;
      currentRound.description = `${roundTitles[roundType]} - ${roundNumber}`;
      currentRound.timeLimit = roundSettings.timeLimit || 30;
      currentRound.completed = false;
      currentRound.startTime = new Date();
    }
    
    await gameSession.save();
    
    // Set up round timer if applicable
    if (roundSettings.timeLimit) {
      setupRoundTimer(gameSessionCode, roundSettings.timeLimit, socket, gameSession._id, roundNumber);
    }
    
    // Broadcast round start to all players across namespaces
    const roundStartData = {
      roundNumber,
      roundType,
      settings: roundSettings,
      timestamp: Date.now()
    };

    // Broadcast to host namespace
    socket.to(gameSessionCode).emit('round:started', roundStartData);

    // Broadcast to player namespace (cross-namespace broadcasting)
    if (socket.nsp && socket.nsp.server) {
      socket.nsp.server.of('/player').to(gameSessionCode).emit('round:started', roundStartData);
    }

    // Confirm to host
    socket.emit('round:started', {
      roundNumber,
      roundType,
      settings: roundSettings,
      timestamp: Date.now()
    });
    
    console.log(`Round ${roundNumber} (${roundType}) started in game ${gameSessionCode}`);
    
    // Return success status
    return {
      success: true,
      roundNumber,
      roundType,
      settings: roundSettings
    };
  } catch (error) {
    console.error('Error handling round:start:', error);
    throw error;
  }
}

/**
 * Get settings for a specific round type
 * @param {string} roundType - Type of round
 * @param {Object} data - Additional round data
 * @returns {Object} Round settings
 */
function getRoundSettings(roundType, data = {}) {
  // Default settings
  const defaultSettings = {
    timeLimit: null,
    pointsPerQuestion: 10,
    questionCount: 5,
    allowNegativePoints: false
  };
  
  // Override with provided settings
  const overrideSettings = {
    timeLimit: data.timeLimit,
    pointsPerQuestion: data.pointsPerQuestion,
    questionCount: data.questionCount,
    allowNegativePoints: data.allowNegativePoints
  };
  
  // Round type specific settings
  const typeSettings = {
    'point-builder': {
      pointsPerQuestion: 10,
      allowNegativePoints: false
    },
    'fastest-finger': {
      buzzerEnabled: true,
      firstAnswerOnly: true,
      lockoutEnabled: true,
      penaltyPoints: 2
    },
    'graduated-points': {
      maxPoints: 20,
      minPoints: 5,
      decreaseRate: 0.5, // points per second
      allowNegativePoints: false
    },
    'specialist': {
      specialistTime: 60, // seconds
      generalTime: 90, // seconds
      specialistPoints: 20,
      generalPoints: 10,
      allowNegativePoints: false
    },
    'standard': {
      pointsPerQuestion: 10,
      allowNegativePoints: false
    }
  };
  
  // Merge settings
  return {
    ...defaultSettings,
    ...typeSettings[roundType] || {},
    ...Object.fromEntries(
      Object.entries(overrideSettings).filter(([_, v]) => v !== undefined)
    )
  };
}

/**
 * Set up round timer
 * @param {string} gameSessionCode - Game session code
 * @param {number} timeLimit - Time limit in seconds
 * @param {Socket} socket - Socket.io socket instance
 * @param {string} gameSessionId - Game session ID
 * @param {number} roundNumber - Round number
 */
function setupRoundTimer(gameSessionCode, timeLimit, socket, gameSessionId, roundNumber) {
  // Clean up any existing timer
  if (roundTimers.has(gameSessionCode)) {
    clearTimeout(roundTimers.get(gameSessionCode));
  }
  
  // Set up timer for round duration
  const timerId = setTimeout(async () => {
    try {
      // Notify host that round time is up
      socket.emit('round:timeup', {
        gameSessionId,
        roundNumber,
        timestamp: Date.now()
      });
      
      // Broadcast to players
      socket.to(gameSessionCode).emit('round:timeup', {
        roundNumber,
        timestamp: Date.now()
      });
      
      // Update game session
      const gameSession = await GameSession.findById(gameSessionId);
      if (gameSession) {
        const roundIndex = gameSession.rounds.findIndex(r => r.roundNumber === roundNumber);
        if (roundIndex !== -1) {
          gameSession.rounds[roundIndex].status = 'completed';
          gameSession.rounds[roundIndex].endTime = new Date();
          await gameSession.save();
        }
      }
      
      // Clean up timer
      roundTimers.delete(gameSessionCode);
    } catch (error) {
      console.error('Error handling round timer expiration:', error);
    }
  }, timeLimit * 1000);
  
  // Store timer reference
  roundTimers.set(gameSessionCode, timerId);
}

/**
 * Handle round:end event
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Round end data
 */
async function handleRoundEnd(socket, data) {
  try {
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    const gameSessionCode = socket.gameSessionCode;
    
    if (!gameSessionId) {
      throw createSocketError('No game session ID provided', 'MISSING_GAME_SESSION');
    }
    
    // Extract round data
    const { roundNumber } = data;
    if (!roundNumber) {
      throw createSocketError('Round number is required', 'INVALID_REQUEST');
    }
    
    // Find game session
    const gameSession = await GameSession.findById(gameSessionId);
    if (!gameSession) {
      throw createSocketError('Game session not found', 'GAME_NOT_FOUND');
    }
    
    // Verify user is the host
    if (gameSession.hostId.toString() !== playerId) {
      throw createSocketError('Only the host can end rounds', 'PERMISSION_DENIED');
    }
    
    // Find the round
    const roundIndex = gameSession.rounds.findIndex(r => r.roundNumber === roundNumber);
    if (roundIndex === -1) {
      throw createSocketError(`Round ${roundNumber} not found`, 'ROUND_NOT_FOUND');
    }
    
    const currentRound = gameSession.rounds[roundIndex];
    
    // Calculate round results
    const roundResults = calculateRoundResults(gameSession, currentRound);
    
    // Update round status
    currentRound.completed = true;
    currentRound.endTime = new Date();
    currentRound.results = roundResults;
    
    // Update game state
    gameSession.lastUpdatedAt = new Date();
    await gameSession.save();
    
    // Clear any timers
    if (roundTimers.has(gameSessionCode)) {
      clearTimeout(roundTimers.get(gameSessionCode));
      roundTimers.delete(gameSessionCode);
    }
    
    // Broadcast round end to all players across namespaces
    const roundEndData = {
      roundNumber,
      results: roundResults,
      timestamp: Date.now()
    };

    // Broadcast to host namespace
    socket.to(gameSessionCode).emit('round:ended', roundEndData);

    // Broadcast to player namespace (cross-namespace broadcasting)
    if (socket.nsp && socket.nsp.server) {
      socket.nsp.server.of('/player').to(gameSessionCode).emit('round:ended', roundEndData);
    }

    // Send detailed results to host
    socket.emit('round:ended', {
      roundNumber,
      results: roundResults,
      timestamp: Date.now(),
      detailedStats: currentRound
    });
    
    console.log(`Round ${roundNumber} ended in game ${gameSessionCode}`);
    
    // Return success status
    return {
      success: true,
      roundNumber,
      results: roundResults
    };
  } catch (error) {
    console.error('Error handling round:end:', error);
    throw error;
  }
}

/**
 * Calculate results for a round
 * @param {GameSession} gameSession - Game session document
 * @param {Object} round - Round data
 * @returns {Object} Round results
 */
function calculateRoundResults(gameSession, round) {
  // Get all players
  const players = gameSession.players;
  
  // Get questions for this round
  const questions = round.questions || [];
  
  // Calculate player scores for this round
  const playerScores = players.map(player => {
    // Start with the player's current score
    const startScore = player.scoreAtRoundStart || 0;
    const currentScore = player.score || 0;
    
    // Calculate points earned in this round
    const pointsEarned = currentScore - startScore;
    
    // Get player answers for this round
    const playerAnswers = questions.map(question => {
      const result = question.results?.playerResults?.find(
        r => r.playerId.toString() === player.playerId.toString()
      );
      
      return result ? {
        questionId: question.questionId,
        isCorrect: result.isCorrect,
        pointsEarned: result.pointsEarned,
        timeToAnswer: result.timeToAnswer
      } : null;
    }).filter(Boolean);
    
    // Calculate stats
    const correctAnswers = playerAnswers.filter(a => a.isCorrect).length;
    const totalAnswers = playerAnswers.length;
    const accuracy = totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0;
    
    // Calculate average response time
    const responseTimeSum = playerAnswers.reduce((sum, a) => sum + (a.timeToAnswer || 0), 0);
    const avgResponseTime = totalAnswers > 0 ? responseTimeSum / totalAnswers : 0;
    
    return {
      playerId: player.playerId,
      startScore,
      endScore: currentScore,
      pointsEarned,
      correctAnswers,
      totalAnswers,
      accuracy,
      avgResponseTime
    };
  });
  
  // Sort players by points earned in this round
  playerScores.sort((a, b) => b.pointsEarned - a.pointsEarned);
  
  // Add ranks
  playerScores.forEach((score, index) => {
    score.roundRank = index + 1;
  });
  
  // Calculate round summary
  const roundSummary = {
    totalQuestions: questions.length,
    totalPoints: playerScores.reduce((sum, p) => sum + p.pointsEarned, 0),
    topScorer: playerScores.length > 0 ? playerScores[0].playerId : null,
    averageScore: playerScores.length > 0 ? 
      playerScores.reduce((sum, p) => sum + p.pointsEarned, 0) / playerScores.length : 0,
    startTime: round.startTime,
    endTime: new Date(),
    duration: new Date() - round.startTime
  };
  
  return {
    playerScores,
    roundSummary
  };
}

/**
 * Handle specific round type start (Point Builder)
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Round data
 */
async function handlePointBuilderRound(socket, data) {
  try {
    // Merge standard round data with point builder specific settings
    const roundData = {
      ...data,
      roundType: 'point-builder',
      pointsPerQuestion: data.pointsPerQuestion || 10,
      allowNegativePoints: data.allowNegativePoints || false
    };
    
    // Initialize the round
    const result = await handleRoundStart(socket, roundData);
    
    // Additional point builder specific setup
    const gameSessionId = socket.gameSessionId;
    const gameSessionCode = socket.gameSessionCode;
    
    // Store player starting scores for end-of-round calculation
    const gameSession = await GameSession.findById(gameSessionId);
    if (gameSession) {
      // Update player starting scores for this round
      for (const player of gameSession.players) {
        player.scoreAtRoundStart = player.score || 0;
      }
      await gameSession.save();
    }
    
    // Return result
    return result;
  } catch (error) {
    console.error('Error handling point builder round:', error);
    throw error;
  }
}

/**
 * Handle specific round type start (Fastest Finger)
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Round data
 */
async function handleFastestFingerRound(socket, data) {
  try {
    // Merge standard round data with fastest finger specific settings
    const roundData = {
      ...data,
      roundType: 'fastest-finger',
      buzzerEnabled: true,
      firstAnswerOnly: true,
      lockoutEnabled: data.lockoutEnabled || true,
      penaltyPoints: data.penaltyPoints || 2
    };
    
    // Initialize the round
    const result = await handleRoundStart(socket, roundData);
    
    // Additional fastest finger specific setup
    const gameSessionId = socket.gameSessionId;
    const gameSessionCode = socket.gameSessionCode;
    
    // Store player starting scores for end-of-round calculation
    const gameSession = await GameSession.findById(gameSessionId);
    if (gameSession) {
      // Update player starting scores for this round
      for (const player of gameSession.players) {
        player.scoreAtRoundStart = player.score || 0;
      }
      await gameSession.save();
      
      // Clear any buzzer queues that might exist
      const buzzerQueue = global.buzzerQueue || new Map();
      buzzerQueue.delete(gameSessionCode);
      global.buzzerQueue = buzzerQueue;
    }
    
    // Return result
    return result;
  } catch (error) {
    console.error('Error handling fastest finger round:', error);
    throw error;
  }
}

/**
 * Handle specific round type start (Graduated Points)
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Round data
 */
async function handleGraduatedPointsRound(socket, data) {
  try {
    // Merge standard round data with graduated points specific settings
    const roundData = {
      ...data,
      roundType: 'graduated-points',
      maxPoints: data.maxPoints || 20,
      minPoints: data.minPoints || 5,
      decreaseRate: data.decreaseRate || 0.5 // points per second
    };
    
    // Initialize the round
    const result = await handleRoundStart(socket, roundData);
    
    // Additional graduated points specific setup
    const gameSessionId = socket.gameSessionId;
    
    // Store player starting scores for end-of-round calculation
    const gameSession = await GameSession.findById(gameSessionId);
    if (gameSession) {
      // Update player starting scores for this round
      for (const player of gameSession.players) {
        player.scoreAtRoundStart = player.score || 0;
      }
      await gameSession.save();
    }
    
    // Return result
    return result;
  } catch (error) {
    console.error('Error handling graduated points round:', error);
    throw error;
  }
}

module.exports = {
  handleRoundStart,
  handleRoundEnd,
  handlePointBuilderRound,
  handleFastestFingerRound,
  handleGraduatedPointsRound,
  processGraduatedPointsAnswer,
  revealGraduatedPointsAnswer
};
