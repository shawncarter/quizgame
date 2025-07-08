/**
 * Question Event Handlers
 * Implements Socket.io event handlers for questions, answers, and scoring
 */
const { GameSession, Question, Player } = require('../models');
const { createSocketError } = require('./socketErrorHandler');
const { questionTimers } = require('./hostEventHandlers');

/**
 * Handle question:next event
 * Retrieves or generates next question based on round rules
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Question data
 */
async function handleQuestionNext(socket, data) {
  try {
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    const gameSessionCode = socket.gameSessionCode;
    
    if (!gameSessionId) {
      throw createSocketError('No game session ID provided', 'MISSING_GAME_SESSION');
    }
    
    // Find game session
    const gameSession = await GameSession.findByPk(gameSessionId);
    if (!gameSession) {
      throw createSocketError('Game session not found', 'GAME_NOT_FOUND');
    }
    
    // Verify user is the host
    if (gameSession.hostId.toString() !== playerId) {
      throw createSocketError('Only the host can manage questions', 'PERMISSION_DENIED');
    }
    
    // Check if game is active
    if (gameSession.status !== 'active') {
      throw createSocketError(
        `Cannot manage questions in '${gameSession.status}' status`,
        'INVALID_GAME_STATE'
      );
    }
    
    // Handle specified question if provided in data
    let question;
    if (data.questionId) {
      question = await Question.findByPk(data.questionId);
      if (!question) {
        throw createSocketError('Question not found', 'QUESTION_NOT_FOUND');
      }
    } else {
      // Retrieve next question based on current round and previous questions
      const currentRound = gameSession.currentRound || 1;
      const currentRoundType = gameSession.currentRoundType || 'standard';
      
      // Get the IDs of questions already used in this game
      const usedQuestionIds = gameSession.rounds
        .flatMap(round => round.questions)
        .map(q => q.questionId);
      
      // Query for a new question
      const questionQuery = {
        difficulty: data.difficulty || 'medium',
        _id: { $nin: usedQuestionIds }
      };
      
      // If round type is specific, filter by round type
      if (currentRoundType !== 'standard') {
        questionQuery.roundType = currentRoundType;
      }
      
      // If category is specified, filter by category
      if (data.category) {
        questionQuery.category = data.category;
      }
      
      question = await Question.findOne(questionQuery);
      
      if (!question) {
        // If no matching question, try without round type constraint
        delete questionQuery.roundType;
        question = await Question.findOne(questionQuery);
        
        if (!question) {
          throw createSocketError('No suitable questions available', 'NO_QUESTIONS');
        }
      }
    }
    
    // Update game state with the new question
    const questionStartTime = new Date();
    const timeLimit = data.timeLimit || question.timeLimit || 30; // seconds
    
    // Add question to current round in game session
    if (!gameSession.rounds) {
      gameSession.rounds = [];
    }
    
    // Check if current round exists in the rounds array
    const currentRoundIndex = gameSession.rounds.findIndex(r => r.roundNumber === gameSession.currentRound);
    
    if (currentRoundIndex === -1) {
      // Create new round entry
      gameSession.rounds.push({
        roundNumber: gameSession.currentRound,
        roundType: gameSession.currentRoundType || 'standard',
        questions: [{
          questionId: question.id,
          startTime: questionStartTime,
          timeLimit: timeLimit,
          active: true
        }]
      });
    } else {
      // Add question to existing round
      gameSession.rounds[currentRoundIndex].questions.push({
        questionId: question.id,
        startTime: questionStartTime,
        timeLimit: timeLimit,
        active: true
      });
    }
    
    gameSession.lastUpdatedAt = new Date();
    await gameSession.save();
    
    // Prepare question data for clients (without answer)
    const questionData = {
      id: question.id,
      text: question.text,
      options: question.options,
      category: question.category,
      difficulty: question.difficulty,
      timeLimit: timeLimit,
      type: question.type,
      media: question.media,
      roundType: gameSession.currentRoundType,
      roundNumber: gameSession.currentRound,
      startTime: questionStartTime,
      timestamp: Date.now()
    };
    
    // Set up question timer
    setupQuestionTimer(gameSessionCode, timeLimit, socket, gameSession.id, question.id);
    
    // Broadcast question to all players
    socket.to(gameSessionCode).emit('question:new', questionData);
    
    // Confirm to host with additional data (including answer)
    socket.emit('question:new', {
      ...questionData,
      answer: question.answer,
      explanation: question.explanation
    });
    
    console.log(`New question sent to game ${gameSessionCode}: ${question.id}`);
    
    // Return success status
    return {
      success: true,
      questionId: question.id
    };
  } catch (error) {
    console.error('Error handling question:next:', error);
    throw error;
  }
}

/**
 * Set up question timer
 * @param {string} gameSessionCode - Game session code
 * @param {number} timeLimit - Time limit in seconds
 * @param {Socket} socket - Socket.io socket instance
 * @param {string} gameSessionId - Game session ID
 * @param {string} questionId - Question ID
 */
function setupQuestionTimer(gameSessionCode, timeLimit, socket, gameSessionId, questionId) {
  // Clean up any existing timer
  if (questionTimers.has(gameSessionCode)) {
    clearTimeout(questionTimers.get(gameSessionCode).timerId);
  }
  
  // Set up timer for question duration
  const timerId = setTimeout(async () => {
    try {
      // Time's up for the question
      const gameSession = await GameSession.findByPk(gameSessionId);
      if (!gameSession) {
        console.error(`Game session ${gameSessionId} not found when ending question timer`);
        return;
      }
      
      // Find the current round and question
      const currentRound = gameSession.rounds.find(r => r.roundNumber === gameSession.currentRound);
      if (!currentRound) {
        console.error(`Current round not found in game session ${gameSessionId}`);
        return;
      }
      
      const currentQuestion = currentRound.questions.find(q => q.questionId.toString() === questionId.toString() && q.active);
      if (!currentQuestion) {
        console.error(`Active question ${questionId} not found in current round`);
        return;
      }
      
      // Mark question as inactive
      currentQuestion.active = false;
      currentQuestion.endTime = new Date();
      await gameSession.save();
      
      // Get the question details
      const question = await Question.findByPk(questionId);
      if (!question) {
        console.error(`Question ${questionId} not found when ending timer`);
        return;
      }
      
      // Broadcast time's up to all players
      socket.to(gameSessionCode).emit('question:timeUp', {
        questionId: questionId,
        answer: question.answer,
        explanation: question.explanation,
        timestamp: Date.now()
      });
      
      // Notify host
      socket.emit('question:timeUp', {
        questionId: questionId,
        answer: question.answer,
        explanation: question.explanation,
        timestamp: Date.now()
      });
      
      console.log(`Question ${questionId} time's up in game ${gameSessionCode}`);
      
      // Clean up timer reference
      questionTimers.delete(gameSessionCode);
    } catch (error) {
      console.error('Error in question timer callback:', error);
    }
  }, timeLimit * 1000);
  
  // Store timer reference and metadata
  questionTimers.set(gameSessionCode, {
    timerId,
    startTime: Date.now(),
    timeLimit,
    questionId,
    gameSessionId,
    paused: false,
    remainingTime: timeLimit * 1000
  });
}

/**
 * Handle question:reveal event
 * Reveals the correct answer to all participants
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Question reveal data
 */
async function handleQuestionReveal(socket, data) {
  try {
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    const gameSessionCode = socket.gameSessionCode;
    
    if (!gameSessionId || !data.questionId) {
      throw createSocketError('Game session ID and question ID are required', 'MISSING_PARAMETERS');
    }
    
    // Find game session
    const gameSession = await GameSession.findByPk(gameSessionId);
    if (!gameSession) {
      throw createSocketError('Game session not found', 'GAME_NOT_FOUND');
    }
    
    // Verify user is the host
    if (gameSession.hostId.toString() !== playerId) {
      throw createSocketError('Only the host can reveal answers', 'PERMISSION_DENIED');
    }
    
    // Find the question
    const question = await Question.findByPk(data.questionId);
    if (!question) {
      throw createSocketError('Question not found', 'QUESTION_NOT_FOUND');
    }
    
    // Find the current round and question in the game session
    const currentRound = gameSession.rounds.find(r => r.roundNumber === gameSession.currentRound);
    if (!currentRound) {
      throw createSocketError('Current round not found', 'ROUND_NOT_FOUND');
    }
    
    const currentQuestion = currentRound.questions.find(q => q.questionId.toString() === data.questionId);
    if (!currentQuestion) {
      throw createSocketError('Question not found in current round', 'QUESTION_NOT_IN_ROUND');
    }
    
    // Mark question as revealed and inactive
    currentQuestion.revealed = true;
    currentQuestion.active = false;
    currentQuestion.endTime = currentQuestion.endTime || new Date();
    
    // Cancel any active timer for this question
    if (questionTimers.has(gameSessionCode)) {
      const timerInfo = questionTimers.get(gameSessionCode);
      if (timerInfo.questionId.toString() === data.questionId) {
        clearTimeout(timerInfo.timerId);
        questionTimers.delete(gameSessionCode);
      }
    }
    
    // Handle different round types
    let revealData;
    
    if (currentRound.roundType === 'point-builder' || currentRound.roundType === 'pointBuilder') {
      // Use the Point Builder round handler for this round type
      const pointBuilderHandler = require('./pointBuilderRoundHandler');
      const result = await pointBuilderHandler.revealPointBuilderAnswer(socket, {
        questionId: data.questionId
      });
      
      // Save game session after point builder processing
      await gameSession.save();
      
      // Return early since the point builder handler already sent the reveal event
      return {
        success: true,
        questionId: data.questionId,
        stats: result.stats
      };
    } else if (currentRound.roundType === 'graduated-points') {
      // Use the Graduated Points round handler for this round type
      const graduatedPointsHandler = require('./graduatedPointsRoundHandler');
      const result = await graduatedPointsHandler.revealGraduatedPointsAnswer(socket, {
        questionId: data.questionId
      });
      
      // Save game session after graduated points processing
      await gameSession.save();
      
      // Return early since the graduated points handler already sent the reveal event
      return {
        success: true,
        questionId: data.questionId,
        stats: result.stats
      };
    } else {
      // Standard reveal for other round types
      await gameSession.save();
      
      // Get player performance statistics for this question
      const playerStats = await getPlayerQuestionStats(gameSession, data.questionId);
      
      // Prepare reveal data
      revealData = {
        questionId: data.questionId,
        correctIndex: question.correctAnswerIndex,
        answer: question.answer,
        explanation: question.explanation,
        playerStats,
        timestamp: Date.now()
      };
      
      // Broadcast answer reveal to all players
      socket.to(gameSessionCode).emit('question:reveal', revealData);
      
      // Confirm to host
      socket.emit('question:reveal', revealData);
    }
    
    console.log(`Answer revealed for question ${data.questionId} in game ${gameSessionCode}`);
    
    // Return success status
    return {
      success: true,
      questionId: data.questionId
    };
  } catch (error) {
    console.error('Error handling question:reveal:', error);
    throw error;
  }
}

/**
 * Get player statistics for a specific question
 * @param {GameSession} gameSession - Game session document
 * @param {string} questionId - Question ID
 * @returns {Array} Player statistics
 */
async function getPlayerQuestionStats(gameSession, questionId) {
  try {
    // Get all player answers for this question
    const playerStats = [];
    
    for (const playerData of gameSession.players) {
      const playerId = playerData.playerId;
      
      // Find player's answer for this question
      const playerAnswer = gameSession.answers.find(a => 
        a.playerId.toString() === playerId.toString() && 
        a.questionId.toString() === questionId
      );
      
      // Get player details
      const player = await Player.findByPk(playerId).select('name avatar');
      
      playerStats.push({
        playerId: playerId,
        playerName: player ? player.name : 'Unknown Player',
        playerAvatar: player ? player.avatar : null,
        answered: !!playerAnswer,
        answerTime: playerAnswer ? playerAnswer.timestamp : null,
        isCorrect: playerAnswer ? playerAnswer.isCorrect : false,
        score: playerAnswer ? playerAnswer.points : 0
      });
    }
    
    // Sort by correctness and time
    return playerStats.sort((a, b) => {
      // Correct answers first
      if (a.isCorrect !== b.isCorrect) {
        return a.isCorrect ? -1 : 1;
      }
      // Then by answer time (faster first)
      if (a.answered && b.answered) {
        return a.answerTime - b.answerTime;
      }
      // Answered before not answered
      return a.answered ? -1 : 1;
    });
  } catch (error) {
    console.error('Error getting player question stats:', error);
    return [];
  }
}

/**
 * Handle answer:submit event
 * Validates and stores player answers
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Answer submission data
 */
async function handleAnswerSubmit(socket, data) {
  try {
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    const gameSessionCode = socket.gameSessionCode;
    
    if (!gameSessionId || !data.questionId || data.answer === undefined) {
      throw createSocketError('Game session ID, question ID, and answer are required', 'MISSING_PARAMETERS');
    }
    
    // Find game session
    const gameSession = await GameSession.findByPk(gameSessionId);
    if (!gameSession) {
      throw createSocketError('Game session not found', 'GAME_NOT_FOUND');
    }
    
    // Verify player is in the game
    const playerInGame = gameSession.players.some(p => p.playerId.toString() === playerId);
    if (!playerInGame) {
      throw createSocketError('Player not in this game session', 'PLAYER_NOT_IN_GAME');
    }
    
    // Find the current round and question
    const currentRound = gameSession.rounds.find(r => r.roundNumber === gameSession.currentRound);
    if (!currentRound) {
      throw createSocketError('Current round not found', 'ROUND_NOT_FOUND');
    }
    
    const currentQuestion = currentRound.questions.find(q => q.questionId.toString() === data.questionId);
    if (!currentQuestion) {
      throw createSocketError('Question not found in current round', 'QUESTION_NOT_IN_ROUND');
    }
    
    // Check if question is still active
    if (!currentQuestion.active) {
      throw createSocketError('Question is no longer active', 'QUESTION_INACTIVE');
    }
    
    // Check if player already answered this question
    const existingAnswer = gameSession.answers.find(a => 
      a.playerId.toString() === playerId && 
      a.questionId.toString() === data.questionId
    );
    
    if (existingAnswer) {
      throw createSocketError('Player already answered this question', 'ALREADY_ANSWERED');
    }
    
    // Get the question to check the answer
    const question = await Question.findByPk(data.questionId);
    if (!question) {
      throw createSocketError('Question not found', 'QUESTION_NOT_FOUND');
    }
    
    // Check if the answer is correct
    const isCorrect = isAnswerCorrect(data.answer, question.answer);
    
    // Calculate points based on round type and timing
    const answerTime = new Date();
    const elapsedTime = (answerTime - new Date(currentQuestion.startTime)) / 1000; // in seconds
    const points = calculatePoints(isCorrect, elapsedTime, currentRound.roundType, currentRound.settings);
    
    // Add answer to game session
    gameSession.answers.push({
      playerId,
      questionId: data.questionId,
      answer: data.answer,
      isCorrect,
      timestamp: answerTime,
      elapsedTime,
      points
    });
    
    // Update player score
    const playerIndex = gameSession.players.findIndex(p => p.playerId.toString() === playerId);
    if (playerIndex !== -1) {
      gameSession.players[playerIndex].score += points;
    }
    
    await gameSession.save();
    
    // Notify host of submission (without revealing correctness if round rules require)
    const hostSocket = socket.to(gameSessionCode).to(`host:${gameSession.hostId}`);
    
    hostSocket.emit('answer:received', {
      playerId,
      playerName: gameSession.players[playerIndex]?.name || 'Unknown Player',
      questionId: data.questionId,
      timestamp: answerTime,
      elapsedTime,
      // Only reveal correctness if round type allows it
      isCorrect: currentRound.roundType === 'fastest-finger' ? isCorrect : undefined
    });
    
    // Acknowledge receipt to submitting player
    socket.emit('answer:confirmed', {
      questionId: data.questionId,
      timestamp: answerTime,
      elapsedTime,
      // Only reveal correctness if round type allows immediate feedback
      isCorrect: ['standard', 'point-builder'].includes(currentRound.roundType) ? isCorrect : undefined,
      points: ['standard', 'point-builder'].includes(currentRound.roundType) ? points : undefined
    });
    
    console.log(`Answer submitted by player ${playerId} for question ${data.questionId} in game ${gameSessionCode}`);
    
    // Return success status
    return {
      success: true,
      questionId: data.questionId,
      isCorrect,
      points
    };
  } catch (error) {
    console.error('Error handling answer:submit:', error);
    throw error;
  }
}

/**
 * Check if an answer is correct
 * @param {any} userAnswer - Player's submitted answer
 * @param {any} correctAnswer - The correct answer from the database
 * @returns {boolean} Whether the answer is correct
 */
function isAnswerCorrect(userAnswer, correctAnswer) {
  // Handle different answer types
  if (Array.isArray(correctAnswer)) {
    // Multiple correct answers possible
    if (Array.isArray(userAnswer)) {
      // Check if arrays match (order might not matter)
      return userAnswer.length === correctAnswer.length && 
        userAnswer.every(ans => correctAnswer.includes(ans));
    } else {
      // Single answer submitted, check if it's in the array of correct answers
      return correctAnswer.includes(userAnswer);
    }
  } else if (typeof correctAnswer === 'string' && typeof userAnswer === 'string') {
    // String comparison (case insensitive)
    return userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
  } else {
    // Direct comparison for other types
    return userAnswer === correctAnswer;
  }
}

/**
 * Calculate points based on round type and timing
 * @param {boolean} isCorrect - Whether the answer is correct
 * @param {number} elapsedTime - Time taken to answer in seconds
 * @param {string} roundType - Type of round
 * @param {Object} settings - Round settings
 * @returns {number} Points awarded
 */
function calculatePoints(isCorrect, elapsedTime, roundType, settings = {}) {
  if (!isCorrect) {
    // Incorrect answers
    if (settings.allowNegativePoints) {
      // Penalty for wrong answers if enabled
      return roundType === 'fastest-finger' ? -(settings.penaltyPoints || 2) : -1;
    }
    return 0;
  }
  
  // Correct answers
  switch (roundType) {
    case 'graduated-points':
      // More points for faster answers
      const maxPoints = settings.maxPoints || 20;
      const minPoints = settings.minPoints || 5;
      const decreaseRate = settings.decreaseRate || 0.5; // points per second
      const timeLimit = settings.timeLimit || 30;
      
      // Calculate points based on elapsed time
      const points = Math.max(
        minPoints,
        maxPoints - Math.floor(elapsedTime * decreaseRate)
      );
      return points;
      
    case 'fastest-finger':
      // Fixed points for correct answer
      return settings.pointsPerQuestion || 10;
      
    case 'specialist':
      // Different points based on question type
      return settings.specialistPoints || 20;
      
    case 'point-builder':
    case 'standard':
    default:
      // Standard points
      return settings.pointsPerQuestion || 10;
  }
}

/**
 * Handle answer:correct event
 * Manually marks an answer as correct (host override)
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Answer correct data
 */
async function handleAnswerCorrect(socket, data) {
  try {
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    const gameSessionCode = socket.gameSessionCode;
    
    if (!gameSessionId || !data.questionId || !data.targetPlayerId) {
      throw createSocketError('Game session ID, question ID, and target player ID are required', 'MISSING_PARAMETERS');
    }
    
    // Find game session
    const gameSession = await GameSession.findByPk(gameSessionId);
    if (!gameSession) {
      throw createSocketError('Game session not found', 'GAME_NOT_FOUND');
    }
    
    // Verify user is the host
    if (gameSession.hostId.toString() !== playerId) {
      throw createSocketError('Only the host can override answer scoring', 'PERMISSION_DENIED');
    }
    
    // Find the target player
    const targetPlayerIndex = gameSession.players.findIndex(p => p.playerId.toString() === data.targetPlayerId);
    if (targetPlayerIndex === -1) {
      throw createSocketError('Target player not found in this game', 'PLAYER_NOT_FOUND');
    }
    
    // Find the current round
    const currentRound = gameSession.rounds.find(r => r.roundNumber === gameSession.currentRound);
    if (!currentRound) {
      throw createSocketError('Current round not found', 'ROUND_NOT_FOUND');
    }
    
    // Find the player's answer for this question
    const answerIndex = gameSession.answers.findIndex(a => 
      a.playerId.toString() === data.targetPlayerId && 
      a.questionId.toString() === data.questionId
    );
    
    // Points to award
    const pointsToAward = data.points || 
      (currentRound.settings && currentRound.settings.pointsPerQuestion) || 10;
    
    if (answerIndex === -1) {
      // No answer found, create a manual entry
      gameSession.answers.push({
        playerId: data.targetPlayerId,
        questionId: data.questionId,
        answer: 'MANUAL_OVERRIDE',
        isCorrect: true,
        timestamp: new Date(),
        elapsedTime: 0,
        points: pointsToAward,
        manualOverride: true
      });
    } else {
      // Update existing answer
      const oldPoints = gameSession.answers[answerIndex].points;
      gameSession.answers[answerIndex].isCorrect = true;
      gameSession.answers[answerIndex].points = pointsToAward;
      gameSession.answers[answerIndex].manualOverride = true;
      
      // Adjust player score (remove old points, add new points)
      gameSession.players[targetPlayerIndex].score -= oldPoints;
    }
    
    // Add points to player's score
    gameSession.players[targetPlayerIndex].score += pointsToAward;
    
    await gameSession.save();
    
    // Broadcast to all players
    socket.to(gameSessionCode).emit('answer:correct', {
      playerId: data.targetPlayerId,
      playerName: gameSession.players[targetPlayerIndex].name,
      questionId: data.questionId,
      points: pointsToAward,
      newScore: gameSession.players[targetPlayerIndex].score,
      timestamp: Date.now()
    });
    
    // Confirm to host
    socket.emit('answer:correct', {
      playerId: data.targetPlayerId,
      playerName: gameSession.players[targetPlayerIndex].name,
      questionId: data.questionId,
      points: pointsToAward,
      newScore: gameSession.players[targetPlayerIndex].score,
      timestamp: Date.now()
    });
    
    console.log(`Answer marked correct for player ${data.targetPlayerId} on question ${data.questionId} in game ${gameSessionCode}`);
    
    // Return success status
    return {
      success: true,
      playerId: data.targetPlayerId,
      points: pointsToAward
    };
  } catch (error) {
    console.error('Error handling answer:correct:', error);
    throw error;
  }
}

/**
 * Handle answer:incorrect event
 * Manually marks an answer as incorrect (host override)
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Answer incorrect data
 */
async function handleAnswerIncorrect(socket, data) {
  try {
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    const gameSessionCode = socket.gameSessionCode;
    
    if (!gameSessionId || !data.questionId || !data.targetPlayerId) {
      throw createSocketError('Game session ID, question ID, and target player ID are required', 'MISSING_PARAMETERS');
    }
    
    // Find game session
    const gameSession = await GameSession.findByPk(gameSessionId);
    if (!gameSession) {
      throw createSocketError('Game session not found', 'GAME_NOT_FOUND');
    }
    
    // Verify user is the host
    if (gameSession.hostId.toString() !== playerId) {
      throw createSocketError('Only the host can override answer scoring', 'PERMISSION_DENIED');
    }
    
    // Find the target player
    const targetPlayerIndex = gameSession.players.findIndex(p => p.playerId.toString() === data.targetPlayerId);
    if (targetPlayerIndex === -1) {
      throw createSocketError('Target player not found in this game', 'PLAYER_NOT_FOUND');
    }
    
    // Find the current round
    const currentRound = gameSession.rounds.find(r => r.roundNumber === gameSession.currentRound);
    if (!currentRound) {
      throw createSocketError('Current round not found', 'ROUND_NOT_FOUND');
    }
    
    // Find the player's answer for this question
    const answerIndex = gameSession.answers.findIndex(a => 
      a.playerId.toString() === data.targetPlayerId && 
      a.questionId.toString() === data.questionId
    );
    
    // Points to deduct (if negative points are allowed)
    const pointsToDeduct = currentRound.settings && 
      currentRound.settings.allowNegativePoints ? 
      (data.points || (currentRound.settings.penaltyPoints || 1)) : 0;
    
    if (answerIndex === -1) {
      // No answer found, create a manual entry
      gameSession.answers.push({
        playerId: data.targetPlayerId,
        questionId: data.questionId,
        answer: 'MANUAL_OVERRIDE',
        isCorrect: false,
        timestamp: new Date(),
        elapsedTime: 0,
        points: -pointsToDeduct,
        manualOverride: true
      });
    } else {
      // Update existing answer
      const oldPoints = gameSession.answers[answerIndex].points;
      gameSession.answers[answerIndex].isCorrect = false;
      gameSession.answers[answerIndex].points = -pointsToDeduct;
      gameSession.answers[answerIndex].manualOverride = true;
      
      // Adjust player score (remove old points)
      gameSession.players[targetPlayerIndex].score -= oldPoints;
    }
    
    // Deduct points from player's score if applicable
    if (pointsToDeduct > 0) {
      gameSession.players[targetPlayerIndex].score -= pointsToDeduct;
    }
    
    await gameSession.save();
    
    // Broadcast to all players
    socket.to(gameSessionCode).emit('answer:incorrect', {
      playerId: data.targetPlayerId,
      playerName: gameSession.players[targetPlayerIndex].name,
      questionId: data.questionId,
      pointsDeducted: pointsToDeduct,
      newScore: gameSession.players[targetPlayerIndex].score,
      timestamp: Date.now()
    });
    
    // Confirm to host
    socket.emit('answer:incorrect', {
      playerId: data.targetPlayerId,
      playerName: gameSession.players[targetPlayerIndex].name,
      questionId: data.questionId,
      pointsDeducted: pointsToDeduct,
      newScore: gameSession.players[targetPlayerIndex].score,
      timestamp: Date.now()
    });
    
    console.log(`Answer marked incorrect for player ${data.targetPlayerId} on question ${data.questionId} in game ${gameSessionCode}`);
    
    // Return success status
    return {
      success: true,
      playerId: data.targetPlayerId,
      pointsDeducted: pointsToDeduct
    };
  } catch (error) {
    console.error('Error handling answer:incorrect:', error);
    throw error;
  }
}

module.exports = {
  handleQuestionNext,
  handleQuestionReveal,
  handleAnswerSubmit,
  handleAnswerCorrect,
  handleAnswerIncorrect,
  isAnswerCorrect,
  calculatePoints
};
