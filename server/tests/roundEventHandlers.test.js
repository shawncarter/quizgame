/**
 * Round Event Handlers Integration Tests
 * Tests that validate actual round handler functionality with real database state
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { GameSession, Player } = require('../models');
const { 
  handleRoundStart,
  handleRoundEnd,
  handlePointBuilderRound,
  handleFastestFingerRound,
  handleGraduatedPointsRound
} = require('../services/roundEventHandlers');

describe('Round Event Handlers Integration Tests', () => {
  let mongoServer;
  let gameSession;
  let hostPlayer;
  let players;
  let mockSocket;

  beforeAll(async () => {
    // Set up in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear database
    await GameSession.deleteMany({});
    await Player.deleteMany({});

    // Create test players
    hostPlayer = await Player.create({
      name: 'Host Player',
      deviceId: 'host-device-123',
      age: 30,
      specialistSubject: 'Science'
    });

    players = await Player.insertMany([
      {
        name: 'Player 1',
        deviceId: 'player1-device',
        age: 25,
        specialistSubject: 'History'
      },
      {
        name: 'Player 2',
        deviceId: 'player2-device',
        age: 28,
        specialistSubject: 'Sports'
      }
    ]);

    // Create game session
    gameSession = await GameSession.create({
      hostId: hostPlayer._id,
      code: 'TEST123',
      status: 'active',
      players: [
        { playerId: players[0]._id, score: 0, active: true },
        { playerId: players[1]._id, score: 0, active: true }
      ],
      currentRound: 0,
      rounds: []
    });

    // Create mock socket
    mockSocket = {
      id: 'socket-123',
      playerId: hostPlayer._id.toString(),
      gameSessionId: gameSession._id.toString(),
      gameSessionCode: gameSession.code,
      emit: jest.fn(),
      to: jest.fn(() => ({ emit: jest.fn() }))
    };

    // Initialize global game state objects
    global.activeQuestions = new Map();
    global.playerAnswers = new Map();
    global.buzzerQueue = new Map();
  });

  afterEach(async () => {
    // Clean up global state
    delete global.activeQuestions;
    delete global.playerAnswers;
    delete global.buzzerQueue;
  });

  describe('Basic Round Management', () => {
    test('should start a round and update game state', async () => {
      const roundData = {
        roundNumber: 1,
        roundType: 'point-builder'
      };

      const result = await handleRoundStart(mockSocket, roundData);

      // Verify return value
      expect(result.success).toBe(true);
      expect(result.roundNumber).toBe(1);
      expect(result.roundType).toBe('point-builder');

      // Verify database state
      const updatedSession = await GameSession.findById(gameSession._id);
      expect(updatedSession.currentRound).toBe(1);
      expect(updatedSession.currentRoundType).toBe('point-builder');
      expect(updatedSession.rounds).toHaveLength(1);
      expect(updatedSession.rounds[0].type).toBe('pointBuilder');
      expect(updatedSession.rounds[0].title).toBe('Point Builder Round');

      // Verify socket emissions
      expect(mockSocket.emit).toHaveBeenCalledWith('round:started', expect.objectContaining({
        roundNumber: 1,
        roundType: 'point-builder'
      }));
    });

    test('should prevent non-host from starting rounds', async () => {
      const nonHostSocket = {
        ...mockSocket,
        playerId: players[0]._id.toString()
      };

      await expect(handleRoundStart(nonHostSocket, {
        roundNumber: 1,
        roundType: 'point-builder'
      })).rejects.toThrow('Only the host can start rounds');

      // Verify no changes to database
      const unchangedSession = await GameSession.findById(gameSession._id);
      expect(unchangedSession.rounds).toHaveLength(0);
    });
  });

  describe('Round Type Specific Handlers', () => {
    test('handlePointBuilderRound should create point builder round with correct settings', async () => {
      const data = {
        roundNumber: 1,
        pointsPerQuestion: 15,
        allowNegativePoints: true
      };

      const result = await handlePointBuilderRound(mockSocket, data);

      // Verify successful execution
      expect(result.success).toBe(true);
      expect(result.roundType).toBe('point-builder');

      // Verify database state
      const updatedSession = await GameSession.findById(gameSession._id);
      expect(updatedSession.rounds).toHaveLength(1);
      expect(updatedSession.rounds[0].type).toBe('pointBuilder');
      expect(updatedSession.rounds[0].title).toBe('Point Builder Round');
      expect(updatedSession.rounds[0].roundNumber).toBe(1);
      expect(updatedSession.currentRoundType).toBe('point-builder');
    });

    test('handleFastestFingerRound should create fastest finger round with correct settings', async () => {
      const data = {
        roundNumber: 1,
        penaltyPoints: 5,
        timeLimit: 20
      };

      const result = await handleFastestFingerRound(mockSocket, data);

      // Verify successful execution
      expect(result.success).toBe(true);
      expect(result.roundType).toBe('fastest-finger');

      // Verify database state
      const updatedSession = await GameSession.findById(gameSession._id);
      expect(updatedSession.rounds).toHaveLength(1);
      expect(updatedSession.rounds[0].type).toBe('fastestFinger');
      expect(updatedSession.rounds[0].title).toBe('Fastest Finger First');
      expect(updatedSession.rounds[0].timeLimit).toBe(20);
      expect(updatedSession.currentRoundType).toBe('fastest-finger');
    });

    test('handleGraduatedPointsRound should create graduated points round with correct settings', async () => {
      const data = {
        roundNumber: 1,
        maxPoints: 30,
        minPoints: 5,
        decreaseRate: 2.0
      };

      const result = await handleGraduatedPointsRound(mockSocket, data);

      // Verify successful execution
      expect(result.success).toBe(true);
      expect(result.roundType).toBe('graduated-points');

      // Verify database state
      const updatedSession = await GameSession.findById(gameSession._id);
      expect(updatedSession.rounds).toHaveLength(1);
      expect(updatedSession.rounds[0].type).toBe('graduatedPoints');
      expect(updatedSession.rounds[0].title).toBe('Graduated Points Round');
      expect(updatedSession.currentRoundType).toBe('graduated-points');
    });

    test('should handle multiple different round types in sequence', async () => {
      // Start with point builder
      await handlePointBuilderRound(mockSocket, {
        roundNumber: 1,
        pointsPerQuestion: 10
      });

      // Then fastest finger
      await handleFastestFingerRound(mockSocket, {
        roundNumber: 2,
        penaltyPoints: 3
      });

      // Then graduated points
      await handleGraduatedPointsRound(mockSocket, {
        roundNumber: 3,
        maxPoints: 25
      });

      // Verify all rounds exist with correct types
      const updatedSession = await GameSession.findById(gameSession._id);
      expect(updatedSession.rounds).toHaveLength(3);
      
      expect(updatedSession.rounds[0].type).toBe('pointBuilder');
      expect(updatedSession.rounds[0].roundNumber).toBe(1);
      
      expect(updatedSession.rounds[1].type).toBe('fastestFinger');
      expect(updatedSession.rounds[1].roundNumber).toBe(2);
      
      expect(updatedSession.rounds[2].type).toBe('graduatedPoints');
      expect(updatedSession.rounds[2].roundNumber).toBe(3);

      // Current round should be the last one
      expect(updatedSession.currentRound).toBe(3);
      expect(updatedSession.currentRoundType).toBe('graduated-points');
    });
  });

  describe('Round Ending', () => {
    beforeEach(async () => {
      // Set up a round with some mock data
      await handleRoundStart(mockSocket, {
        roundNumber: 1,
        roundType: 'point-builder'
      });

      // Add some mock question results
      const session = await GameSession.findById(gameSession._id);
      session.rounds[0].questions = [];
      await session.save();
    });

    test('should end a round and mark it as completed', async () => {
      const result = await handleRoundEnd(mockSocket, { roundNumber: 1 });

      // Verify database state
      const updatedSession = await GameSession.findById(gameSession._id);
      const round = updatedSession.rounds.find(r => r.roundNumber === 1);
      
      expect(round.completed).toBe(true);
      
      // Verify socket emissions
      expect(mockSocket.emit).toHaveBeenCalledWith('round:ended', expect.objectContaining({
        roundNumber: 1
      }));
    });

    test('should handle ending non-existent round', async () => {
      await expect(handleRoundEnd(mockSocket, { roundNumber: 99 }))
        .rejects.toThrow('Round 99 not found');
    });
  });

  describe('Error Handling', () => {
    test('should reject invalid round types', async () => {
      await expect(handleRoundStart(mockSocket, {
        roundNumber: 1,
        roundType: 'invalid-type'
      })).rejects.toThrow('Invalid round type');
    });

    test('should require valid game session', async () => {
      const invalidSocket = {
        ...mockSocket,
        gameSessionId: new mongoose.Types.ObjectId().toString()
      };

      await expect(handleRoundStart(invalidSocket, {
        roundNumber: 1,
        roundType: 'point-builder'
      })).rejects.toThrow('Game session not found');
    });

    test('should validate required data fields', async () => {
      await expect(handleRoundStart(mockSocket, {
        roundNumber: 1
        // Missing roundType
      })).rejects.toThrow('Round number and type are required');

      await expect(handleRoundStart(mockSocket, {
        roundType: 'point-builder'
        // Missing roundNumber
      })).rejects.toThrow('Round number and type are required');
    });
  });
});