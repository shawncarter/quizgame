/**
 * Game State Integration Tests
 * Tests that validate actual game state changes and functionality
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { GameSession, Player } = require('../models');
const { 
  handleRoundStart,
  handleRoundEnd,
  handlePointBuilderRound,
  handleGraduatedPointsRound,
  handleFastestFingerRound
} = require('../services/roundEventHandlers');

describe('Game State Integration Tests', () => {
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

  describe('Round Management', () => {
    test('should start a round and update game state', async () => {
      const roundData = {
        roundNumber: 1,
        roundType: 'point-builder'
      };

      await handleRoundStart(mockSocket, roundData);

      // Verify database state
      const updatedSession = await GameSession.findById(gameSession._id);
      expect(updatedSession.currentRound).toBe(1);
      expect(updatedSession.currentRoundType).toBe('point-builder');
      expect(updatedSession.rounds).toHaveLength(1);
      expect(updatedSession.rounds[0].roundNumber).toBe(1);
      expect(updatedSession.rounds[0].type).toBe('pointBuilder');
      expect(updatedSession.rounds[0].title).toBe('Point Builder Round');
      expect(updatedSession.rounds[0].completed).toBe(false);
    });

    test('should prevent non-host from starting rounds', async () => {
      const nonHostSocket = {
        ...mockSocket,
        playerId: players[0]._id.toString()
      };

      const roundData = {
        roundNumber: 1,
        roundType: 'point-builder'
      };

      await expect(handleRoundStart(nonHostSocket, roundData))
        .rejects.toThrow('Only the host can start rounds');

      // Verify game state wasn't changed
      const unchangedSession = await GameSession.findById(gameSession._id);
      expect(unchangedSession.currentRound).toBe(0);
      expect(unchangedSession.rounds).toHaveLength(0);
    });

    test('should handle multiple rounds in sequence', async () => {
      // Start first round
      await handleRoundStart(mockSocket, {
        roundNumber: 1,
        roundType: 'point-builder'
      });

      // Start second round
      await handleRoundStart(mockSocket, {
        roundNumber: 2,
        roundType: 'fastest-finger'
      });

      // Verify both rounds exist
      const updatedSession = await GameSession.findById(gameSession._id);
      expect(updatedSession.currentRound).toBe(2);
      expect(updatedSession.currentRoundType).toBe('fastest-finger');
      expect(updatedSession.rounds).toHaveLength(2);
      
      expect(updatedSession.rounds[0].roundNumber).toBe(1);
      expect(updatedSession.rounds[0].type).toBe('pointBuilder');
      
      expect(updatedSession.rounds[1].roundNumber).toBe(2);
      expect(updatedSession.rounds[1].type).toBe('fastestFinger');
    });
  });

  describe('Round Type Specific Tests', () => {
    test('should configure point builder round correctly', async () => {
      const roundData = {
        roundNumber: 1,
        pointsPerQuestion: 15,
        allowNegativePoints: true
      };

      await handlePointBuilderRound(mockSocket, roundData);

      const updatedSession = await GameSession.findById(gameSession._id);
      const round = updatedSession.rounds[0];
      
      expect(round.type).toBe('pointBuilder');
      expect(round.title).toBe('Point Builder Round');
    });

    test('should configure fastest finger round correctly', async () => {
      const roundData = {
        roundNumber: 1,
        penaltyPoints: 5,
        timeLimit: 30
      };

      await handleFastestFingerRound(mockSocket, roundData);

      const updatedSession = await GameSession.findById(gameSession._id);
      const round = updatedSession.rounds[0];
      
      expect(round.type).toBe('fastestFinger');
      expect(round.title).toBe('Fastest Finger First');
      expect(round.timeLimit).toBe(30);
    });

    test('should configure graduated points round correctly', async () => {
      const roundData = {
        roundNumber: 1,
        maxPoints: 30,
        minPoints: 5,
        decreaseRate: 2.0
      };

      await handleGraduatedPointsRound(mockSocket, roundData);

      const updatedSession = await GameSession.findById(gameSession._id);
      const round = updatedSession.rounds[0];
      
      expect(round.type).toBe('graduatedPoints');
      expect(round.title).toBe('Graduated Points Round');
    });
  });

  describe('Player Score Management', () => {
    beforeEach(async () => {
      // Set up a round with some initial state
      await handleRoundStart(mockSocket, {
        roundNumber: 1,
        roundType: 'point-builder'
      });
    });

    test('should maintain player scores across rounds', async () => {
      // Update player scores
      const updatedSession = await GameSession.findById(gameSession._id);
      updatedSession.players[0].score = 25;
      updatedSession.players[1].score = 15;
      await updatedSession.save();

      // Start new round
      await handleRoundStart(mockSocket, {
        roundNumber: 2,
        roundType: 'fastest-finger'
      });

      // Verify scores are preserved
      const finalSession = await GameSession.findById(gameSession._id);
      expect(finalSession.players[0].score).toBe(25);
      expect(finalSession.players[1].score).toBe(15);
    });

    test('should track player active status', async () => {
      const updatedSession = await GameSession.findById(gameSession._id);
      expect(updatedSession.players[0].active).toBe(true);
      expect(updatedSession.players[1].active).toBe(true);

      // Simulate player leaving
      updatedSession.players[0].active = false;
      await updatedSession.save();

      const finalSession = await GameSession.findById(gameSession._id);
      expect(finalSession.players[0].active).toBe(false);
      expect(finalSession.players[1].active).toBe(true);
    });
  });

  describe('Game State Validation', () => {
    test('should reject invalid round types', async () => {
      await expect(handleRoundStart(mockSocket, {
        roundNumber: 1,
        roundType: 'invalid-type'
      })).rejects.toThrow('Invalid round type');

      // Verify no changes to game state
      const unchangedSession = await GameSession.findById(gameSession._id);
      expect(unchangedSession.rounds).toHaveLength(0);
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

    test('should validate game status before starting rounds', async () => {
      // Set game to completed status (ended is not a valid enum value)
      gameSession.status = 'completed';
      await gameSession.save();

      await expect(handleRoundStart(mockSocket, {
        roundNumber: 1,
        roundType: 'point-builder'
      })).rejects.toThrow("Cannot start round in 'completed' status");
    });
  });
});