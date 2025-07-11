/**
 * Socket Recovery Service
 * Handles recovery of dropped connections and game state synchronization
 */

// Store for pending reconnections
const pendingReconnections = new Map(); // Maps playerId to reconnection data

// Default reconnection window in milliseconds
const RECONNECTION_WINDOW = 30000; // 30 seconds

/**
 * Handle disconnection and setup reconnection window
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} io - Socket.io server instance
 */
function handleDisconnection(socket, io) {
  const playerId = socket.playerId;
  const gameSessionId = socket.gameSessionId;
  const gameSessionCode = socket.gameSessionCode;

  if (!playerId) return; // Skip if no player ID

  console.log(`Player ${playerId} disconnected from game ${gameSessionCode}`);

  // Store reconnection state
  const reconnectionData = {
    playerId,
    gameSessionId,
    gameSessionCode,
    disconnectedAt: Date.now(),
    socketId: socket.id,
    isHost: socket.isHost || false,
    expiresAt: Date.now() + RECONNECTION_WINDOW
  };

  pendingReconnections.set(playerId, reconnectionData);

  // Set timer to handle permanent disconnection
  const timeoutId = setTimeout(() => {
    if (pendingReconnections.has(playerId)) {
      const reconnectData = pendingReconnections.get(playerId);

      // Only process if this is still the active reconnection entry
      if (reconnectData.socketId === socket.id) {
        handlePermanentDisconnection(reconnectData, io);
        pendingReconnections.delete(playerId);
      }
    }
  }, RECONNECTION_WINDOW);

  // Store the timeout ID for potential cancellation
  reconnectionData.timeoutId = timeoutId;
  pendingReconnections.set(playerId, reconnectionData);

  // Notify other players about temporary disconnection
  if (gameSessionCode) {
    io.to(gameSessionCode).emit('player:disconnected', {
      playerId,
      temporary: true,
      timestamp: Date.now()
    });

    // Also notify host specifically
    io.to(`${gameSessionCode}:host`).emit('player:disconnected', {
      playerId,
      temporary: true,
      timestamp: Date.now(),
      reconnectionWindow: RECONNECTION_WINDOW
    });
  }
}

/**
 * Handle permanent disconnection after reconnection window expires
 * @param {Object} reconnectData - Reconnection data
 * @param {Object} io - Socket.io server instance
 */
async function handlePermanentDisconnection(reconnectData, io) {
  const { playerId, gameSessionId, gameSessionCode, isHost } = reconnectData;

  try {
    const { GameSession } = require('../models');

    // Only update game session if it exists
    if (gameSessionId && gameSessionCode) {
      const gameSession = await GameSession.findByPk(gameSessionId);

      if (gameSession) {
        // Handle host disconnection specially
        if (isHost) {
          // If game is active, pause it
          if (gameSession.status === 'active') {
            gameSession.status = 'paused';
            gameSession.pausedAt = new Date();
            gameSession.pauseReason = 'Host disconnected';

            // Notify all players
            io.to(gameSessionCode).emit('game:paused', {
              gameSessionId,
              pausedAt: gameSession.pausedAt,
              reason: 'Host disconnected',
              timestamp: Date.now()
            });
          }
        }

        // Mark player as inactive in the game
        const playerIndex = gameSession.players.findIndex(p =>
          p.playerId.toString() === playerId
        );

        if (playerIndex !== -1) {
          gameSession.players[playerIndex].active = false;
          gameSession.players[playerIndex].lastActive = new Date();
          await gameSession.save();
        }

        // Notify other players
        io.to(gameSessionCode).emit('player:left', {
          playerId,
          reason: 'disconnected',
          timestamp: Date.now()
        });
      }
    }

    console.log(`Player ${playerId} permanently disconnected from game ${gameSessionCode}`);
  } catch (error) {
    console.error('Error handling permanent disconnection:', error);
  }
}

/**
 * Handle reconnection of a previously disconnected player
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} io - Socket.io server instance
 */
async function handleReconnection(socket, io) {
  const playerId = socket.playerId;
  const gameSessionId = socket.gameSessionId;

  if (!playerId) return; // Skip if no player ID

  // Check if player has a pending reconnection
  if (pendingReconnections.has(playerId)) {
    const reconnectData = pendingReconnections.get(playerId);

    // Cancel the timeout
    if (reconnectData.timeoutId) {
      clearTimeout(reconnectData.timeoutId);
    }

    pendingReconnections.delete(playerId);

    // Calculate reconnection duration
    const reconnectionDuration = Date.now() - reconnectData.disconnectedAt;

    // Get the game session code from reconnection data if not in socket
    const gameSessionCode = socket.gameSessionCode || reconnectData.gameSessionCode;

    console.log(`Player ${playerId} reconnected to game ${gameSessionCode} after ${reconnectionDuration}ms`);

    try {
      // Update game session
      if (gameSessionId) {
        const { GameSession } = require('../models');
        const gameSession = await GameSession.findByPk(gameSessionId);

        if (gameSession) {
          // Store the game session code in the socket
          socket.gameSessionCode = gameSession.code;

          // Mark player as active again
          const playerIndex = gameSession.players.findIndex(p =>
            p.playerId.toString() === playerId
          );

          if (playerIndex !== -1) {
            gameSession.players[playerIndex].active = true;
            gameSession.players[playerIndex].lastActive = new Date();
            await gameSession.save();
          }

          // If this is the host reconnecting and game is paused due to host disconnect
          if (socket.isHost &&
              gameSession.status === 'paused' &&
              gameSession.pauseReason === 'Host disconnected') {
            // Don't auto-resume, but notify the host they can resume manually
            socket.emit('host:canResume', {
              gameSessionId,
              pausedAt: gameSession.pausedAt,
              pauseDuration: Date.now() - gameSession.pausedAt,
              timestamp: Date.now()
            });
          }

          // Rejoin rooms
          socket.join(gameSession.code);

          if (socket.isHost) {
            socket.join(`${gameSession.code}:host`);
            console.log(`Host ${playerId} joined room ${gameSession.code}:host`);
          } else {
            socket.join(`${gameSession.code}:player:${playerId}`);
          }

          // Send current game state to the reconnected player
          socket.emit('game:state', {
            gameSessionId: gameSession.id,
            gameCode: gameSession.code,
            status: gameSession.status,
            currentRound: gameSession.currentRound,
            roundType: gameSession.currentRoundType,
            timestamp: Date.now()
          });

          // Notify other players
          io.to(gameSession.code).emit('player:reconnected', {
            playerId,
            timestamp: Date.now()
          });

          // If there's an active question, send it to the player
          const activeQuestions = global.activeQuestions || new Map();
          if (activeQuestions.has(gameSession.code)) {
            const activeQuestion = activeQuestions.get(gameSession.code);

            // Get question details from database
            const { Question } = require('../models');
            const question = await Question.findByPk(activeQuestion.id);

            if (question) {
              // Calculate remaining time
              const remainingTime = activeQuestion.endTime - new Date();

              // Send question to player (without correct answer)
              socket.emit('game:question', {
                id: question.id,
                text: question.text,
                options: question.options,
                category: question.category,
                timeLimit: activeQuestion.timeLimit,
                startTime: activeQuestion.startTime,
                remainingTime: Math.max(0, remainingTime),
                roundType: gameSession.currentRoundType || 'standard',
                roundNumber: gameSession.currentRound
              });

              // If host, also send correct answer
              if (socket.isHost) {
                socket.emit('question:answer', {
                  id: question.id,
                  correctAnswer: question.correctAnswer,
                  explanation: question.explanation
                });
              }
            }
          }
        } else {
          console.log(`Game session not found for ID: ${gameSessionId}`);
        }
      } else if (socket.isHost && reconnectData.gameSessionId) {
        // If we don't have gameSessionId in socket but we have it in reconnection data
        // This is a special case for host reconnection
        const { GameSession } = require('../models');
        const gameSession = await GameSession.findByPk(reconnectData.gameSessionId);

        if (gameSession) {
          // Update socket with game session info
          socket.gameSessionId = gameSession.id.toString();
          socket.gameSessionCode = gameSession.code;

          // Join host rooms
          socket.join(gameSession.code);
          socket.join(`${gameSession.code}:host`);
          console.log(`Host ${playerId} joined room ${gameSession.code}:host from reconnection data`);

          // Send game state
          socket.emit('game:state', {
            gameSessionId: gameSession.id,
            gameCode: gameSession.code,
            status: gameSession.status,
            currentRound: gameSession.currentRound,
            roundType: gameSession.currentRoundType,
            timestamp: Date.now()
          });
        }
      }
    } catch (error) {
      console.error('Error handling reconnection:', error);
      socket.emit('error', {
        message: 'Failed to restore session state',
        details: error.message
      });
    }
  }
}

/**
 * Get reconnection data for a player
 * @param {string} playerId - Player ID
 * @returns {Object|null} Reconnection data or null if not found
 */
function getReconnectionData(playerId) {
  if (pendingReconnections.has(playerId)) {
    const data = pendingReconnections.get(playerId);
    return {
      ...data,
      timeRemaining: data.expiresAt - Date.now(),
      expired: Date.now() > data.expiresAt
    };
  }
  return null;
}

/**
 * Clean up expired reconnection entries
 */
function cleanupExpiredReconnections() {
  const now = Date.now();

  for (const [playerId, data] of pendingReconnections.entries()) {
    if (now > data.expiresAt) {
      // Clear timeout if it exists
      if (data.timeoutId) {
        clearTimeout(data.timeoutId);
      }
      pendingReconnections.delete(playerId);
    }
  }
}

// Run cleanup periodically
setInterval(cleanupExpiredReconnections, 60000); // Every minute

module.exports = {
  handleDisconnection,
  handleReconnection,
  getReconnectionData,
  RECONNECTION_WINDOW
};
