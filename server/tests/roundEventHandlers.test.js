/**
 * Round Event Handlers Tests
 */
const { 
  handleRoundStart,
  handleRoundEnd,
  handlePointBuilderRound,
  handleFastestFingerRound,
  handleGraduatedPointsRound
} = require('../services/roundEventHandlers');

// Mock models
jest.mock('../models', () => ({
  GameSession: {
    findByPk: jest.fn()
  },
  Question: {}
}));

const { GameSession } = require('../models');

// Create mock game session
const createMockGameSession = (overrides = {}) => ({
  id: 'game123',
  code: 'TEST123',
  hostId: 'host123',
  status: 'active',
  players: [
    {
      playerId: 'player1',
      score: 0,
      active: true
    },
    {
      playerId: 'player2',
      score: 0,
      active: true
    }
  ],
  currentRound: 1,
  currentRoundType: 'standard',
  rounds: [],
  save: jest.fn().mockResolvedValue(true),
  ...overrides
});

// Mock socket
const createMockSocket = () => ({
  id: 'socket-123',
  playerId: 'host123',
  gameSessionId: 'game123',
  gameSessionCode: 'TEST123',
  emit: jest.fn(),
  to: jest.fn().mockReturnValue({
    emit: jest.fn()
  })
});

describe('Round Event Handlers', () => {
  let mockSocket;
  let mockGameSession;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create fresh mocks for each test
    mockSocket = createMockSocket();
    mockGameSession = createMockGameSession();
    
    // Set up model mocks
    GameSession.findByPk.mockResolvedValue(mockGameSession);
    
    // Mock global objects
    global.activeQuestions = new Map();
    global.playerAnswers = new Map();
    global.buzzerQueue = new Map();
  });
  
  afterEach(() => {
    // Clean up
    delete global.activeQuestions;
    delete global.playerAnswers;
    delete global.buzzerQueue;
  });
  
  describe('handleRoundStart', () => {
    test('should start a new round', async () => {
      const data = {
        roundNumber: 1,
        roundType: 'point-builder'
      };
      
      await handleRoundStart(mockSocket, data);
      
      // Verify GameSession.findByPk was called
      expect(GameSession.findByPk).toHaveBeenCalledWith('game123');
      
      // Verify game session was updated
      expect(mockGameSession.currentRound).toBe(1);
      expect(mockGameSession.currentRoundType).toBe('point-builder');
      expect(mockGameSession.rounds.length).toBe(1);
      expect(mockGameSession.save).toHaveBeenCalled();
      
      // Verify socket emissions
      expect(mockSocket.to).toHaveBeenCalledWith('TEST123');
      expect(mockSocket.to().emit).toHaveBeenCalledWith('round:started', expect.objectContaining({
        roundNumber: 1,
        roundType: 'point-builder',
        settings: expect.any(Object)
      }));
      
      expect(mockSocket.emit).toHaveBeenCalledWith('round:started', expect.objectContaining({
        roundNumber: 1,
        roundType: 'point-builder',
        settings: expect.any(Object)
      }));
    });
    
    test('should throw error if user is not host', async () => {
      // Change socket playerId to be different from host
      mockSocket.playerId = 'not-the-host';
      
      const data = {
        roundNumber: 1,
        roundType: 'point-builder'
      };
      
      await expect(handleRoundStart(mockSocket, data))
        .rejects.toThrow('Only the host can start rounds');
    });
    
    test('should throw error if round type is invalid', async () => {
      const data = {
        roundNumber: 1,
        roundType: 'invalid-type'
      };
      
      await expect(handleRoundStart(mockSocket, data))
        .rejects.toThrow('Invalid round type');
    });
  });
  
  describe('handleRoundEnd', () => {
    beforeEach(() => {
      // Set up a mock round in the game session
      mockGameSession.rounds = [
        {
          roundNumber: 1,
          roundType: 'point-builder',
          startTime: new Date(),
          questions: [
            {
              questionId: 'question1',
              startTime: new Date(),
              active: false,
              results: {
                playerResults: [
                  {
                    playerId: 'player1',
                    isCorrect: true,
                    pointsEarned: 10,
                    timeToAnswer: 2500
                  },
                  {
                    playerId: 'player2',
                    isCorrect: false,
                    pointsEarned: 0,
                    timeToAnswer: 3500
                  }
                ]
              }
            }
          ],
          status: 'active'
        }
      ];
    });
    
    test('should end a round and calculate results', async () => {
      const data = {
        roundNumber: 1
      };
      
      await handleRoundEnd(mockSocket, data);
      
      // Verify GameSession.findByPk was called
      expect(GameSession.findByPk).toHaveBeenCalledWith('game123');
      
      // Verify round was updated
      expect(mockGameSession.rounds[0].status).toBe('completed');
      expect(mockGameSession.rounds[0].endTime).toBeInstanceOf(Date);
      expect(mockGameSession.rounds[0].results).toBeDefined();
      expect(mockGameSession.save).toHaveBeenCalled();
      
      // Verify socket emissions
      expect(mockSocket.to).toHaveBeenCalledWith('TEST123');
      expect(mockSocket.to().emit).toHaveBeenCalledWith('round:ended', expect.objectContaining({
        roundNumber: 1,
        results: expect.any(Object)
      }));
      
      expect(mockSocket.emit).toHaveBeenCalledWith('round:ended', expect.objectContaining({
        roundNumber: 1,
        results: expect.any(Object),
        detailedStats: expect.any(Object)
      }));
    });
    
    test('should throw error if round not found', async () => {
      const data = {
        roundNumber: 5 // Non-existent round
      };
      
      await expect(handleRoundEnd(mockSocket, data))
        .rejects.toThrow('Round 5 not found');
    });
  });
  
  describe('Round type specific handlers', () => {
    test('handlePointBuilderRound should set up point builder round', async () => {
      // Mock handleRoundStart function directly
      const originalHandleRoundStart = handleRoundStart;
      const mockHandleRoundStart = jest.fn().mockResolvedValue({ success: true });
      
      // Temporarily replace handleRoundStart
      global.handleRoundStart = mockHandleRoundStart;
      
      const data = {
        roundNumber: 1,
        pointsPerQuestion: 15
      };
      
      await handlePointBuilderRound(mockSocket, data);
      
      // Verify handleRoundStart was called with correct parameters
      expect(mockHandleRoundStart).toHaveBeenCalledWith(mockSocket, expect.objectContaining({
        roundNumber: 1,
        roundType: 'point-builder',
        pointsPerQuestion: 15,
        allowNegativePoints: false
      }));
      
      // Restore original implementation
      global.handleRoundStart = originalHandleRoundStart;
    });
    
    test('handleFastestFingerRound should set up fastest finger round', async () => {
      // Mock handleRoundStart function directly
      const originalHandleRoundStart = handleRoundStart;
      const mockHandleRoundStart = jest.fn().mockResolvedValue({ success: true });
      
      // Temporarily replace handleRoundStart
      global.handleRoundStart = mockHandleRoundStart;
      
      const data = {
        roundNumber: 1,
        penaltyPoints: 5
      };
      
      await handleFastestFingerRound(mockSocket, data);
      
      // Verify handleRoundStart was called with correct parameters
      expect(mockHandleRoundStart).toHaveBeenCalledWith(mockSocket, expect.objectContaining({
        roundNumber: 1,
        roundType: 'fastest-finger',
        buzzerEnabled: true,
        firstAnswerOnly: true,
        penaltyPoints: 5
      }));
      
      // Restore original implementation
      global.handleRoundStart = originalHandleRoundStart;
    });
    
    test('handleGraduatedPointsRound should set up graduated points round', async () => {
      // Mock handleRoundStart function directly
      const originalHandleRoundStart = handleRoundStart;
      const mockHandleRoundStart = jest.fn().mockResolvedValue({ success: true });
      
      // Temporarily replace handleRoundStart
      global.handleRoundStart = mockHandleRoundStart;
      
      const data = {
        roundNumber: 1,
        maxPoints: 30,
        minPoints: 10,
        decreaseRate: 1.0
      };
      
      await handleGraduatedPointsRound(mockSocket, data);
      
      // Verify handleRoundStart was called with correct parameters
      expect(mockHandleRoundStart).toHaveBeenCalledWith(mockSocket, expect.objectContaining({
        roundNumber: 1,
        roundType: 'graduated-points',
        maxPoints: 30,
        minPoints: 10,
        decreaseRate: 1.0
      }));
      
      // Restore original implementation
      global.handleRoundStart = originalHandleRoundStart;
    });
  });
});
