/**
 * Point Builder Round Handler
 * Implements server-side logic for the Point Builder round type
 */
const { GameSession, Question } = require('../models');
const { createSocketError } = require('./socketErrorHandler');

/**
 * Process a player's answer for a Point Builder round
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Answer data from player
 * @returns {Promise<Object>} Result of answer processing
 */
async function processPointBuilderAnswer(socket, data) {
  try {
    const gameSessionId = socket.gameSessionId;
    const playerId = socket.playerId;
    const gameSessionCode = socket.gameSessionCode;
    
    if (!gameSessionId) {
      throw createSocketError('No game session ID provided', 'MISSING_GAME_SESSION');
    }
    
    // Extract answer data
    const { questionId, answerIndex, timestamp, timedOut } = data;
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
    
    // Verify round type is point-builder
    if (currentRound.roundType !== 'point-builder' && currentRound.roundType !== 'pointBuilder') {
      throw createSocketError(
        `Invalid round type: ${currentRound.roundType}. Expected: point-builder`,
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
    const pointsPerQuestion = settings.pointsPerQuestion || 10;
    const allowNegativePoints = settings.allowNegativePoints || false;
    
    // Determine if answer is correct
    const isCorrect = timedOut ? false : answerIndex === question.correctAnswerIndex;
    
    // Calculate points
    let pointsEarned = 0;
    if (isCorrect) {
      pointsEarned = pointsPerQuestion;
    } else if (allowNegativePoints) {
      pointsEarned = -Math.floor(pointsPerQuestion / 2); // Lose half points for wrong answer
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
      timedOut: timedOut || false
    });
    
    // Return result to player
    return {
      success: true,
      isCorrect,
      pointsEarned,
      totalScore: gameSession.players[playerIndex].score
    };
  } catch (error) {
    console.error('Error processing Point Builder answer:', error);
    throw error;
  }
}

/**
 * Reveal answer for a Point Builder round question
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Question data
 * @returns {Promise<Object>} Result of answer reveal
 */
async function revealPointBuilderAnswer(socket, data) {
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
    
    // Prepare player results
    const playerResults = {};
    questionAnswers.forEach(answer => {
      playerResults[answer.playerId] = {
        isCorrect: answer.isCorrect,
        pointsEarned: answer.pointsEarned,
        answerIndex: answer.answerIndex,
        timedOut: answer.timedOut
      };
    });
    
    // Broadcast answer reveal to all players
    socket.to(gameSessionCode).emit('question:reveal', {
      questionId,
      correctIndex: question.correctAnswerIndex,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      playerResults,
      stats: {
        totalPlayers,
        answeredPlayers,
        correctAnswers,
        incorrectAnswers,
        timedOutPlayers
      }
    });
    
    // Send to host as well
    socket.emit('question:reveal', {
      questionId,
      correctIndex: question.correctAnswerIndex,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      playerResults,
      stats: {
        totalPlayers,
        answeredPlayers,
        correctAnswers,
        incorrectAnswers,
        timedOutPlayers
      }
    });
    
    // Mark question as completed
    const currentRound = gameSession.rounds.find(r => r.roundNumber === gameSession.currentRound);
    if (currentRound) {
      const questionIndex = currentRound.questions.findIndex(q => q.toString() === questionId);
      if (questionIndex !== -1) {
        currentRound.questionStatus = currentRound.questionStatus || [];
        currentRound.questionStatus[questionIndex] = 'completed';
      }
      await gameSession.save();
    }
    
    // Return result
    return {
      success: true,
      stats: {
        totalPlayers,
        answeredPlayers,
        correctAnswers,
        incorrectAnswers,
        timedOutPlayers
      }
    };
  } catch (error) {
    console.error('Error revealing Point Builder answer:', error);
    throw error;
  }
}

/**
 * Get current standings for a Point Builder round
 * @param {Socket} socket - Socket.io socket instance
 * @returns {Promise<Object>} Current standings
 */
async function getPointBuilderStandings(socket) {
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
    
    // Sort players by score
    const sortedPlayers = [...gameSession.players].sort((a, b) => b.score - a.score);
    
    // Assign ranks
    const rankedPlayers = sortedPlayers.map((player, index) => {
      // Handle ties (same score gets same rank)
      let rank = index + 1;
      if (index > 0 && player.score === sortedPlayers[index - 1].score) {
        rank = rankedPlayers[index - 1].rank;
      }
      
      return {
        ...player.toObject(),
        rank
      };
    });
    
    // Return standings
    return {
      success: true,
      standings: rankedPlayers.map(player => ({
        playerId: player.playerId,
        name: player.name,
        score: player.score,
        rank: player.rank,
        stats: player.stats || {}
      }))
    };
  } catch (error) {
    console.error('Error getting Point Builder standings:', error);
    throw error;
  }
}

module.exports = {
  processPointBuilderAnswer,
  revealPointBuilderAnswer,
  getPointBuilderStandings
};
