/**
 * Host Event Handlers
 * Implements Socket.io event handlers for game host actions and game state management
 */
const { GameSession, Question, Player } = require('../models');

// Store for active timers to allow pausing/resuming
const questionTimers = new Map(); // Maps gameCode to timer objects
const roundTimers = new Map();    // Maps gameCode to round timer objects

/**
 * Handle host:startGame event
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Game start data
 */
async function handleStartGame(socket, data) {
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
    
    // Log game start
    console.log(`Game ${gameSession.code} started by host ${playerId} with ${gameSession.players.length} players`);
    
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
  } catch (error) {
    console.error('Error handling host:startGame:', error);
    socket.emit('error', { 
      message: 'Failed to start game', 
      details: error.message 
    });
  }
}

/**
 * Handle host:nextQuestion event
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Question data
 */
async function handleNextQuestion(socket, data) {
  try {
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    const gameSessionCode = socket.gameSessionCode;
    
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
      return socket.emit('error', { message: 'Only the host can manage questions' });
    }
    
    // Check if game is active
    if (gameSession.status !== 'active') {
      return socket.emit('error', { 
        message: `Cannot manage questions in '${gameSession.status}' status`,
        code: 'INVALID_GAME_STATE'
      });
    }
    
    // Handle specified question if provided in data
    let question;
    if (data.questionId) {
      question = await Question.findById(data.questionId);
      if (!question) {
        return socket.emit('error', { message: 'Question not found' });
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
          return socket.emit('error', { 
            message: 'No suitable questions available', 
            code: 'NO_QUESTIONS'
          });
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
          questionId: question._id,
          startTime: questionStartTime,
          timeLimit: timeLimit,
          active: true
        }]
      });
    } else {
      // Add to existing round
      // First mark any active questions as inactive
      gameSession.rounds[currentRoundIndex].questions.forEach(q => {
        q.active = false;
      });
      
      // Then add the new question
      gameSession.rounds[currentRoundIndex].questions.push({
        questionId: question._id,
        startTime: questionStartTime,
        timeLimit: timeLimit,
        active: true
      });
    }
    
    gameSession.lastUpdatedAt = new Date();
    await gameSession.save();
    
    // Prepare question data to send to clients
    const questionData = {
      id: question._id,
      text: question.text,
      options: question.options,
      category: question.category,
      timeLimit: timeLimit,
      startTime: questionStartTime,
      roundType: gameSession.currentRoundType || 'standard',
      roundNumber: gameSession.currentRound
    };
    
    // Store the active question in the active questions map
    // Note: This would typically use a service import, but we'll add it later
    const activeQuestions = global.activeQuestions || new Map();
    activeQuestions.set(gameSessionCode, {
      id: question._id,
      startTime: questionStartTime,
      timeLimit: timeLimit,
      endTime: new Date(questionStartTime.getTime() + (timeLimit * 1000))
    });
    global.activeQuestions = activeQuestions;
    
    // Clear any existing timer for this game
    if (questionTimers.has(gameSessionCode)) {
      clearTimeout(questionTimers.get(gameSessionCode));
    }
    
    // Set timer to automatically end the question after timeLimit
    const timerId = setTimeout(() => {
      // Handle question timeout
      socket.emit('question:timeout', {
        questionId: question._id,
        gameSessionId: gameSession._id
      });
      
      // Remove from active questions
      const activeQuestions = global.activeQuestions || new Map();
      activeQuestions.delete(gameSessionCode);
      global.activeQuestions = activeQuestions;
      
      // Clean up timer reference
      questionTimers.delete(gameSessionCode);
      
    }, timeLimit * 1000);
    
    // Store the timer reference
    questionTimers.set(gameSessionCode, timerId);
    
    // Broadcast question to all players
    socket.to(gameSessionCode).emit('game:question', questionData);
    
    // Send confirmation to host with correct answer
    socket.emit('game:question', {
      ...questionData,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation
    });
    
    console.log(`Host ${playerId} started question ${question._id} in game ${gameSessionCode}`);
  } catch (error) {
    console.error('Error handling host:nextQuestion:', error);
    socket.emit('error', { 
      message: 'Failed to retrieve next question', 
      details: error.message 
    });
  }
}

/**
 * Check if an answer is correct
 * Handles string comparison, multiple choice, and array answers
 * @param {any} userAnswer - Player's submitted answer
 * @param {any} correctAnswer - The correct answer from the database
 * @returns {boolean} Whether the answer is correct
 */
function isAnswerCorrect(userAnswer, correctAnswer) {
  // If answers are strings, normalize and compare
  if (typeof userAnswer === 'string' && typeof correctAnswer === 'string') {
    return userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
  }
  
  // If answers are arrays, check if all elements match
  if (Array.isArray(userAnswer) && Array.isArray(correctAnswer)) {
    // Check if arrays have the same length
    if (userAnswer.length !== correctAnswer.length) return false;
    
    // Sort both arrays and compare values
    const sortedUser = [...userAnswer].sort();
    const sortedCorrect = [...correctAnswer].sort();
    
    return sortedUser.every((val, idx) => {
      if (typeof val === 'string') {
        return val.toLowerCase().trim() === sortedCorrect[idx].toLowerCase().trim();
      }
      return val === sortedCorrect[idx];
    });
  }
  
  // For multiple choice or other types, direct comparison
  return userAnswer === correctAnswer;
}

/**
 * Handle host:endQuestion event
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - End question data
 */
async function handleEndQuestion(socket, data) {
  try {
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    const gameSessionCode = socket.gameSessionCode;
    
    if (!gameSessionId) {
      return socket.emit('error', { message: 'No game session ID provided' });
    }
    
    const { questionId } = data;
    if (!questionId) {
      return socket.emit('error', { message: 'Question ID required' });
    }
    
    // Find game session
    const gameSession = await GameSession.findById(gameSessionId);
    if (!gameSession) {
      return socket.emit('error', { message: 'Game session not found' });
    }
    
    // Verify user is the host
    if (gameSession.hostId.toString() !== playerId) {
      return socket.emit('error', { message: 'Only the host can end questions' });
    }
    
    // Check if game is active
    if (gameSession.status !== 'active') {
      return socket.emit('error', { 
        message: `Cannot end question in '${gameSession.status}' status`,
        code: 'INVALID_GAME_STATE'
      });
    }
    
    // Get current round and question
    const currentRoundIndex = gameSession.rounds.findIndex(r => r.roundNumber === gameSession.currentRound);
    if (currentRoundIndex === -1) {
      return socket.emit('error', { message: 'Current round not found' });
    }
    
    const currentRound = gameSession.rounds[currentRoundIndex];
    const questionIndex = currentRound.questions.findIndex(q => 
      q.questionId.toString() === questionId && q.active
    );
    
    if (questionIndex === -1) {
      return socket.emit('error', { message: 'Active question not found' });
    }
    
    // Find the question in the database to get correct answer
    const question = await Question.findById(questionId);
    if (!question) {
      return socket.emit('error', { message: 'Question not found in database' });
    }
    
    // Mark question as inactive
    currentRound.questions[questionIndex].active = false;
    currentRound.questions[questionIndex].endTime = new Date();
    
    // Get player answers for this question
    const playerAnswersMap = global.playerAnswers || new Map();
    const answerKey = `${gameSessionCode}_${questionId}`;
    const questionAnswers = playerAnswersMap.get(answerKey) || new Map();
    
    // Process player answers and calculate scores
    const playerResults = [];
    const roundType = currentRound.roundType || 'standard';
    
    // Calculate scores based on round type
    for (const [playerId, answerData] of questionAnswers.entries()) {
      // Find player in game session
      const playerIndex = gameSession.players.findIndex(p => 
        p.playerId.toString() === playerId
      );
      
      if (playerIndex === -1) continue; // Skip if player not found
      
      const player = gameSession.players[playerIndex];
      const isCorrect = isAnswerCorrect(answerData.answer, question.correctAnswer);
      let pointsEarned = 0;
      
      // Calculate points based on round type and answer correctness
      if (isCorrect) {
        switch (roundType) {
          case 'point-builder':
            // All correct answers get equal points
            pointsEarned = question.pointValue || 10;
            break;
            
          case 'graduated-points':
            // Points are based on how quickly they answered
            const maxPoints = question.pointValue || 10;
            const timeLimit = question.timeLimit || 30;
            const timeToAnswer = answerData.timeToAnswer || timeLimit * 1000;
            const timeRatio = Math.max(0, 1 - (timeToAnswer / (timeLimit * 1000)));
            pointsEarned = Math.round(maxPoints * timeRatio);
            break;
            
          case 'fastest-finger':
            // Only first correct answer gets points
            const buzzerQueue = global.buzzerQueue || new Map();
            const queue = buzzerQueue.get(gameSessionCode) || [];
            const playerPosition = queue.findIndex(item => item.playerId === playerId) + 1;
            
            if (playerPosition === 1) {
              pointsEarned = question.pointValue || 10;
            }
            break;
            
          case 'specialist':
            // Special scoring for specialist rounds
            const isSpecialist = player.isSpecialistFor && 
                                player.isSpecialistFor.includes(question.category);
            
            pointsEarned = isSpecialist ? 
                          (question.pointValue || 10) * 2 : // Double points for specialists
                          (question.pointValue || 10);
            break;
            
          default:
            // Standard scoring
            pointsEarned = question.pointValue || 10;
        }
      } else {
        // For some round types, incorrect answers might have penalties
        if (roundType === 'fastest-finger' || roundType === 'buzzer') {
          // Penalty for buzzing in with wrong answer
          pointsEarned = -2; // Small penalty
        } else {
          pointsEarned = 0; // No penalty for wrong answers in other rounds
        }
      }
      
      // Update player score
      player.score += pointsEarned;
      
      // Record result for this player
      playerResults.push({
        playerId: player.playerId,
        answer: answerData.answer,
        isCorrect,
        pointsEarned,
        totalScore: player.score,
        timeToAnswer: answerData.timeToAnswer
      });
    }
    
    // Update game session with new scores
    gameSession.lastUpdatedAt = new Date();
    await gameSession.save();
    
    // Clean up timers
    if (questionTimers.has(gameSessionCode)) {
      clearTimeout(questionTimers.get(gameSessionCode));
      questionTimers.delete(gameSessionCode);
    }
    
    // Remove from active questions
    const activeQuestions = global.activeQuestions || new Map();
    activeQuestions.delete(gameSessionCode);
    global.activeQuestions = activeQuestions;
    
    // Clear buzzer queue for this game
    const buzzerQueue = global.buzzerQueue || new Map();
    buzzerQueue.delete(gameSessionCode);
    global.buzzerQueue = buzzerQueue;
    
    // Sort player results by total score for leaderboard
    playerResults.sort((a, b) => b.totalScore - a.totalScore);
    
    // Generate question results summary
    const questionResults = {
      questionId,
      questionText: question.text,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      playerResults,
      leaderboard: playerResults.map((result, index) => ({
        playerId: result.playerId,
        score: result.totalScore,
        position: index + 1
      }))
    };
    
    // Store question results in game session
    currentRound.questions[questionIndex].results = questionResults;
    await gameSession.save();
    
    // Broadcast results to all players
    socket.to(gameSessionCode).emit('game:questionEnd', {
      questionId,
      playerResults: playerResults.map(result => ({
        playerId: result.playerId,
        pointsEarned: result.pointsEarned,
        totalScore: result.totalScore,
        timeToAnswer: result.timeToAnswer
      })),
      leaderboard: questionResults.leaderboard,
      timestamp: Date.now()
    });
    
    // Send detailed results to host
    socket.emit('game:questionEnd', {
      questionId,
      questionText: question.text,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      playerResults,
      leaderboard: questionResults.leaderboard,
      timestamp: Date.now()
    });
    
    console.log(`Question ${questionId} ended in game ${gameSessionCode}`);
  } catch (error) {
    console.error('Error handling host:endQuestion:', error);
    socket.emit('error', { 
      message: 'Failed to end question', 
      details: error.message 
    });
  }
}

/**
 * Handle host:pauseGame event
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Pause game data
 */
async function handlePauseGame(socket, data) {
  try {
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    const gameSessionCode = socket.gameSessionCode;
    
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
    
    // Check if game is active
    if (gameSession.status !== 'active') {
      return socket.emit('error', { 
        message: `Cannot pause game in '${gameSession.status}' status`,
        code: 'INVALID_GAME_STATE'
      });
    }
    
    // Update game state
    gameSession.status = 'paused';
    gameSession.pausedAt = new Date();
    gameSession.pauseReason = data.reason || 'Host paused the game';
    gameSession.lastUpdatedAt = new Date();
    await gameSession.save();
    
    // Suspend any active timers
    if (questionTimers.has(gameSessionCode)) {
      clearTimeout(questionTimers.get(gameSessionCode));
      
      // Store remaining time for later resume
      const activeQuestions = global.activeQuestions || new Map();
      const currentQuestion = activeQuestions.get(gameSessionCode);
      
      if (currentQuestion) {
        currentQuestion.pausedAt = new Date();
        currentQuestion.remainingTime = 
          currentQuestion.endTime - currentQuestion.pausedAt;
        
        activeQuestions.set(gameSessionCode, currentQuestion);
        global.activeQuestions = activeQuestions;
      }
    }
    
    // Pause any round timers
    if (roundTimers.has(gameSessionCode)) {
      clearTimeout(roundTimers.get(gameSessionCode));
    }
    
    // Notify all players
    socket.to(gameSessionCode).emit('game:paused', {
      gameSessionId,
      pausedAt: gameSession.pausedAt,
      reason: gameSession.pauseReason,
      timestamp: Date.now()
    });
    
    // Confirm to host
    socket.emit('game:paused', {
      gameSessionId,
      pausedAt: gameSession.pausedAt,
      reason: gameSession.pauseReason,
      timestamp: Date.now()
    });
    
    console.log(`Game ${gameSessionCode} paused by host ${playerId}: ${gameSession.pauseReason}`);
  } catch (error) {
    console.error('Error handling host:pauseGame:', error);
    socket.emit('error', { 
      message: 'Failed to pause game', 
      details: error.message 
    });
  }
}

/**
 * Handle host:resumeGame event
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Resume game data
 */
async function handleResumeGame(socket, data) {
  try {
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    const gameSessionCode = socket.gameSessionCode;
    
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
    
    // Check if game is paused
    if (gameSession.status !== 'paused') {
      return socket.emit('error', { 
        message: `Cannot resume game in '${gameSession.status}' status`,
        code: 'INVALID_GAME_STATE'
      });
    }
    
    // Calculate pause duration
    const resumedAt = new Date();
    const pauseDuration = gameSession.pausedAt ? 
      resumedAt - gameSession.pausedAt : 0;
    
    // Update game state
    gameSession.status = 'active';
    gameSession.pausedAt = null;
    gameSession.lastUpdatedAt = resumedAt;
    await gameSession.save();
    
    // Resume any active question timers
    const activeQuestions = global.activeQuestions || new Map();
    const currentQuestion = activeQuestions.get(gameSessionCode);
    
    if (currentQuestion && currentQuestion.pausedAt) {
      // Adjust end time based on remaining time
      if (currentQuestion.remainingTime) {
        currentQuestion.endTime = new Date(
          resumedAt.getTime() + currentQuestion.remainingTime
        );
        
        // Set a new timer for the remaining time
        const newTimeLimit = Math.ceil(currentQuestion.remainingTime / 1000);
        
        // Create new timer with adjusted duration
        const timerId = setTimeout(() => {
          // Handle question timeout
          socket.emit('question:timeout', {
            questionId: currentQuestion.id,
            gameSessionId: gameSession._id
          });
          
          // Remove from active questions
          activeQuestions.delete(gameSessionCode);
          global.activeQuestions = activeQuestions;
          
          // Clean up timer reference
          questionTimers.delete(gameSessionCode);
          
        }, currentQuestion.remainingTime);
        
        // Update timer reference
        questionTimers.set(gameSessionCode, timerId);
        
        // Update active question with new timing
        currentQuestion.pausedAt = null;
        currentQuestion.remainingTime = null;
        activeQuestions.set(gameSessionCode, currentQuestion);
        global.activeQuestions = activeQuestions;
      }
    }
    
    // Notify all players
    socket.to(gameSessionCode).emit('game:resumed', {
      gameSessionId,
      resumedAt,
      pauseDuration,
      timestamp: Date.now(),
      activeQuestion: currentQuestion ? {
        id: currentQuestion.id,
        endTime: currentQuestion.endTime,
        timeRemaining: currentQuestion.endTime - resumedAt
      } : null
    });
    
    // Confirm to host
    socket.emit('game:resumed', {
      gameSessionId,
      resumedAt,
      pauseDuration,
      timestamp: Date.now(),
      activeQuestion: currentQuestion ? {
        id: currentQuestion.id,
        endTime: currentQuestion.endTime,
        timeRemaining: currentQuestion.endTime - resumedAt
      } : null
    });
    
    console.log(`Game ${gameSessionCode} resumed by host ${playerId} after ${pauseDuration}ms pause`);
  } catch (error) {
    console.error('Error handling host:resumeGame:', error);
    socket.emit('error', { 
      message: 'Failed to resume game', 
      details: error.message 
    });
  }
}

/**
 * Handle host:endGame event
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - End game data
 */
async function handleEndGame(socket, data) {
  try {
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    const gameSessionCode = socket.gameSessionCode;
    
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
    
    // Clean up timers
    if (questionTimers.has(gameSessionCode)) {
      clearTimeout(questionTimers.get(gameSessionCode));
      questionTimers.delete(gameSessionCode);
    }
    
    if (roundTimers.has(gameSessionCode)) {
      clearTimeout(roundTimers.get(gameSessionCode));
      roundTimers.delete(gameSessionCode);
    }
    
    // Remove active questions
    const activeQuestions = global.activeQuestions || new Map();
    activeQuestions.delete(gameSessionCode);
    global.activeQuestions = activeQuestions;
    
    // Clear buzzer queue
    const buzzerQueue = global.buzzerQueue || new Map();
    buzzerQueue.delete(gameSessionCode);
    global.buzzerQueue = buzzerQueue;
    
    // Notify all players in the game room
    socket.to(gameSessionCode).emit('game:ended', {
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
    
    console.log(`Game ${gameSessionCode} ended by host ${playerId}`);
  } catch (error) {
    console.error('Error handling host:endGame:', error);
    socket.emit('error', { 
      message: 'Failed to end game', 
      details: error.message 
    });
  }
}

module.exports = {
  handleStartGame,
  handleNextQuestion,
  handleEndQuestion,
  handlePauseGame,
  handleResumeGame,
  handleEndGame,
  isAnswerCorrect,
  questionTimers,
  roundTimers
};
