/**
 * Graduated Points Round Handler
 * Implements server-side logic for the Graduated Points round type
 * where faster responses earn more points
 */
const { GameSession, Question } = require('../models');
const { createSocketError } = require('./socketErrorHandler');

/**
 * Process a player's answer for a Graduated Points round
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Answer data from player
 * @returns {Promise<Object>} Result of answer processing
 */
async function processGraduatedPointsAnswer(socket, data) {
  try {
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    const gameSessionCode = socket.gameSessionCode;
    
    if (!gameSessionId) {
      throw createSocketError('No game session ID provided', 'MISSING_GAME_SESSION');
    }
    
    // Extract answer data
    const { questionId, answerIndex, timestamp, timedOut, responseTime } = data;
    if (!questionId) {
      throw createSocketError('Question ID is required', 'INVALID_REQUEST');
    }
    
    // Find game session
    const gameSession = await GameSession.findByPk(gameSessionId);
    if (!gameSession) {
      throw createSocketError('Game session not found', 'GAME_NOT_FOUND');
    }
    
    // Find current round
    const currentRound = gameSession.rounds.find(r => r.roundNumber === gameSession.currentRound);
    if (!currentRound) {
      throw createSocketError('Current round not found', 'ROUND_NOT_FOUND');
    }
    
    // Verify round type is graduated-points
    if (currentRound.roundType !== 'graduated-points') {
      throw createSocketError(
        `Invalid round type: ${currentRound.roundType}. Expected: graduated-points`,
        'INVALID_ROUND_TYPE'
      );
    }
    
    // Find question
    const question = await Question.findByPk(questionId);
    if (!question) {
      throw createSocketError('Question not found', 'QUESTION_NOT_FOUND');
    }
    
    // Find player in game session
    const playerIndex = gameSession.players.findIndex(p => p.playerId.toString() === playerId);
    if (playerIndex === -1) {
      throw createSocketError('Player not found in game session', 'PLAYER_NOT_FOUND');
    }
    
    // Check if player already answered this question
    const existingAnswer = gameSession.playerAnswers.find(
      a => a.playerId.toString() === playerId && a.questionId.toString() === questionId
    );
    
    if (existingAnswer) {
      // Player already answered, don't allow changes
      return {
        success: false,
        message: 'You have already answered this question',
        alreadyAnswered: true
      };
    }
    
    // Get round settings
    const settings = currentRound.settings || {};
    const maxPoints = settings.maxPoints || 20;
    const minPoints = settings.minPoints || 5;
    const decreaseRate = settings.decreaseRate || 0.5; // points per second
    const timeLimit = settings.timeLimit || 30;
    const allowNegativePoints = settings.allowNegativePoints || false;
    
    // Determine if answer is correct
    const isCorrect = timedOut ? false : answerIndex === question.correctAnswerIndex;
    
    // Calculate points based on response time
    let pointsEarned = 0;
    
    if (isCorrect) {
      // Calculate points based on response time
      // The faster the response, the more points earned
      const elapsedTime = responseTime || (Date.now() - currentRound.questionStartTime) / 1000;
      
      // Calculate points using linear decrease based on elapsed time
      pointsEarned = Math.max(
        minPoints,
        maxPoints - Math.floor(elapsedTime * decreaseRate)
      );
    } else if (allowNegativePoints) {
      pointsEarned = -Math.floor(minPoints / 2); // Lose half of minimum points for wrong answer
    }
    
    // Record player's answer
    gameSession.playerAnswers.push({
      playerId,
      questionId,
      roundNumber: gameSession.currentRound,
      answerIndex: timedOut ? -1 : answerIndex,
      isCorrect,
      pointsEarned,
      timestamp: timestamp || Date.now(),
      responseTime: responseTime || null,
      timedOut: timedOut || false
    });
    
    // Update player's score
    gameSession.players[playerIndex].score += pointsEarned;
    
    // Update player's stats
    const playerStats = gameSession.players[playerIndex].stats || {};
    playerStats.questionsAnswered = (playerStats.questionsAnswered || 0) + 1;
    playerStats.correctAnswers = (playerStats.correctAnswers || 0) + (isCorrect ? 1 : 0);
    playerStats.incorrectAnswers = (playerStats.incorrectAnswers || 0) + (isCorrect ? 0 : 1);
    playerStats.totalPoints = (playerStats.totalPoints || 0) + pointsEarned;
    playerStats.fastestAnswer = Math.min(
      playerStats.fastestAnswer || Infinity,
      responseTime || Infinity
    );
    gameSession.players[playerIndex].stats = playerStats;
    
    // Save game session
    await gameSession.save();
    
    // Notify host about the answer (without revealing correctness)
    socket.to(gameSessionCode + ':host').emit('player:answer', {
      playerId,
      playerName: gameSession.players[playerIndex].name,
      questionId,
      answerIndex: timedOut ? -1 : answerIndex,
      timestamp: timestamp || Date.now(),
      responseTime: responseTime || null,
      timedOut: timedOut || false,
      pointsEarned: pointsEarned // Include points earned for host display
    });
    
    // Return result to player
    return {
      success: true,
      isCorrect,
      pointsEarned,
      totalScore: gameSession.players[playerIndex].score
    };
  } catch (error) {
    console.error('Error processing Graduated Points answer:', error);
    throw error;
  }
}

/**
 * Reveal answer for a Graduated Points round question
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Question data
 * @returns {Promise<Object>} Result of answer reveal
 */
async function revealGraduatedPointsAnswer(socket, data) {
  try {
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    const gameSessionCode = socket.gameSessionCode;
    
    if (!gameSessionId) {
      throw createSocketError('No game session ID provided', 'MISSING_GAME_SESSION');
    }
    
    // Extract question data
    const { questionId } = data;
    if (!questionId) {
      throw createSocketError('Question ID is required', 'INVALID_REQUEST');
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
    
    // Find question
    const question = await Question.findByPk(questionId);
    if (!question) {
      throw createSocketError('Question not found', 'QUESTION_NOT_FOUND');
    }
    
    // Get all player answers for this question
    const questionAnswers = gameSession.playerAnswers.filter(
      a => a.questionId.toString() === questionId
    );
    
    // Calculate results
    const totalPlayers = gameSession.players.length;
    const answeredPlayers = questionAnswers.length;
    const correctAnswers = questionAnswers.filter(a => a.isCorrect).length;
    const incorrectAnswers = answeredPlayers - correctAnswers;
    const timedOutPlayers = questionAnswers.filter(a => a.timedOut).length;
    
    // Find fastest correct answer
    let fastestAnswer = null;
    let fastestPlayerId = null;
    let fastestResponseTime = Infinity;
    
    questionAnswers.forEach(answer => {
      if (answer.isCorrect && answer.responseTime && answer.responseTime < fastestResponseTime) {
        fastestResponseTime = answer.responseTime;
        fastestPlayerId = answer.playerId;
        fastestAnswer = answer;
      }
    });
    
    // Prepare player results
    const playerResults = {};
    questionAnswers.forEach(answer => {
      playerResults[answer.playerId] = {
        isCorrect: answer.isCorrect,
        pointsEarned: answer.pointsEarned,
        answerIndex: answer.answerIndex,
        timedOut: answer.timedOut,
        responseTime: answer.responseTime,
        isFastest: answer.playerId === fastestPlayerId
      };
    });
    
    // Broadcast answer reveal to all players
    socket.to(gameSessionCode).emit('question:reveal', {
      questionId,
      correctIndex: question.correctAnswerIndex,
      correctAnswer: question.options[question.correctAnswerIndex],
      explanation: question.explanation || '',
      playerResults,
      fastestResponseTime: fastestResponseTime !== Infinity ? fastestResponseTime : null,
      fastestPlayerId
    });
    
    // Send to host as well
    socket.emit('question:reveal', {
      questionId,
      correctIndex: question.correctAnswerIndex,
      correctAnswer: question.options[question.correctAnswerIndex],
      explanation: question.explanation || '',
      playerResults,
      fastestResponseTime: fastestResponseTime !== Infinity ? fastestResponseTime : null,
      fastestPlayerId,
      stats: {
        totalPlayers,
        answeredPlayers,
        correctAnswers,
        incorrectAnswers,
        timedOutPlayers
      }
    });
    
    // Return success status
    return {
      success: true,
      questionId,
      correctIndex: question.correctAnswerIndex
    };
  } catch (error) {
    console.error('Error revealing Graduated Points answer:', error);
    throw error;
  }
}

/**
 * Get current standings for a Graduated Points round
 * @param {Socket} socket - Socket.io socket instance
 * @returns {Promise<Object>} Current standings
 */
async function getGraduatedPointsStandings(socket) {
  try {
    const gameSessionId = socket.gameSessionId;
    
    if (!gameSessionId) {
      throw createSocketError('No game session ID provided', 'MISSING_GAME_SESSION');
    }
    
    // Find game session
    const gameSession = await GameSession.findByPk(gameSessionId);
    if (!gameSession) {
      throw createSocketError('Game session not found', 'GAME_NOT_FOUND');
    }
    
    // Get current round
    const currentRound = gameSession.rounds.find(r => r.roundNumber === gameSession.currentRound);
    if (!currentRound || currentRound.roundType !== 'graduated-points') {
      throw createSocketError('Current round is not a Graduated Points round', 'INVALID_ROUND_TYPE');
    }
    
    // Calculate standings
    const standings = gameSession.players.map(player => {
      // Calculate points earned in this round
      const roundAnswers = gameSession.playerAnswers.filter(
        a => a.playerId.toString() === player.playerId.toString() && 
             a.roundNumber === gameSession.currentRound
      );
      
      const roundPoints = roundAnswers.reduce((sum, answer) => sum + answer.pointsEarned, 0);
      const correctAnswers = roundAnswers.filter(a => a.isCorrect).length;
      
      return {
        playerId: player.playerId,
        name: player.name,
        score: player.score,
        roundPoints,
        correctAnswers,
        totalAnswers: roundAnswers.length
      };
    });
    
    // Sort by score (descending)
    standings.sort((a, b) => b.score - a.score);
    
    return {
      success: true,
      standings,
      roundNumber: gameSession.currentRound,
      roundType: 'graduated-points'
    };
  } catch (error) {
    console.error('Error getting Graduated Points standings:', error);
    throw error;
  }
}

module.exports = {
  processGraduatedPointsAnswer,
  revealGraduatedPointsAnswer,
  getGraduatedPointsStandings
};
