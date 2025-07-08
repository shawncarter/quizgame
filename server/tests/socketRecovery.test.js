/**
 * Socket Recovery Service Tests
 * Tests for socket connection recovery and state management functionality
 */
const socketRecovery = require('../services/socketRecovery');

// Mock dependencies
jest.mock('../models', () => ({
  GameSession: {
    findByPk: jest.fn(),
    findOne: jest.fn()
  }
}));

describe('Socket Recovery Service', () => {
  let mockSocket;
  let mockIo;
  let mockEmitToRoom;
  
  // Reset mocks before each test
  beforeEach(() => {
    jest.resetAllMocks();
    
    // Create mock socket
    mockSocket = {
      id: 'socket-123',
      playerId: 'player-123',
      gameSessionId: 'game-123',
      gameSessionCode: 'TEST123',
      rooms: new Set(['TEST123', 'TEST123:player:player-123']),
      join: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    };
    
    // Setup IO mock
    mockEmitToRoom = jest.fn();
    mockIo = {
      to: jest.fn().mockReturnValue({
        emit: mockEmitToRoom
      }),
      of: jest.fn().mockReturnThis(),
      sockets: {
        sockets: new Map([['socket-123', mockSocket]]),
        adapter: {
          rooms: new Map([
            ['TEST123', new Set(['socket-123'])],
            ['TEST123:player:player-123', new Set(['socket-123'])]
          ])
        }
      }
    };
    
    // Mock Date.now for consistent timestamps
    jest.spyOn(Date, 'now').mockReturnValue(1234567890);
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  test('handleReconnection should process reconnecting socket', () => {
    // Create test data to store in recovery cache
    const testGameState = { 
      players: [{ id: 'player-123', score: 100 }],
      currentRound: 2
    };
    
    // Store test data in recovery service cache
    socketRecovery.storePlayerState('player-123', 'TEST123', testGameState);
    
    // Call the reconnection handler
    socketRecovery.handleReconnection(mockSocket, mockIo);
    
    // Should emit recovery data to player
    expect(mockSocket.emit).toHaveBeenCalledWith('recovery:state', {
      gameSessionId: 'game-123',
      gameSessionCode: 'TEST123',
      timestamp: expect.any(Number),
      state: testGameState
    });
    
    // Should notify room that player reconnected
    expect(mockSocket.to).toHaveBeenCalledWith('TEST123');
    expect(mockEmitToRoom).toHaveBeenCalledWith('player:reconnected', {
      playerId: 'player-123',
      timestamp: expect.any(Number)
    });
  });
  
  test('handleDisconnection should store player state for recovery', () => {
    // Mock socket recovery data access
    const storeStateSpy = jest.spyOn(socketRecovery, 'storePlayerState');
    
    // Create socket with game state data in the rooms
    mockSocket.gameState = { 
      players: [{ id: 'player-123', score: 100 }],
      currentRound: 2
    };
    
    // Call the disconnection handler
    socketRecovery.handleDisconnection(mockSocket, mockIo);
    
    // Should store state for recovery
    expect(storeStateSpy).toHaveBeenCalledWith(
      'player-123',
      'TEST123',
      expect.objectContaining({
        players: expect.any(Array),
        currentRound: 2,
        disconnectedAt: expect.any(Number)
      })
    );
    
    // Should notify room that player disconnected
    expect(mockSocket.to).toHaveBeenCalledWith('TEST123');
    expect(mockEmitToRoom).toHaveBeenCalledWith('player:disconnected', {
      playerId: 'player-123',
      temporary: true,
      timestamp: expect.any(Number)
    });
  });
  
  test('storePlayerState and getPlayerState should work correctly', () => {
    // Test data
    const playerId = 'player-456';
    const gameCode = 'GAME789';
    const state = { score: 200, level: 3 };
    
    // Store state
    socketRecovery.storePlayerState(playerId, gameCode, state);
    
    // Retrieve state
    const retrievedState = socketRecovery.getPlayerState(playerId, gameCode);
    
    // Verify state was stored and retrieved correctly
    expect(retrievedState).toEqual(state);
  });
  
  test('cleanupOldSessions should remove expired sessions', () => {
    // Mock internal cache with some sessions
    const now = Date.now();
    const testStates = {
      'player1-GAME1': { data: 'recent', disconnectedAt: now - 1000 },         // 1 second ago
      'player2-GAME1': { data: 'old', disconnectedAt: now - 600000 },         // 10 minutes ago
      'player3-GAME2': { data: 'expired', disconnectedAt: now - 1800000 }     // 30 minutes ago
    };
    
    // Access and modify the recovery cache directly
    // Note: This relies on implementation details, but is useful for testing
    socketRecovery.playerStates = testStates;
    
    // Set the cleanup threshold to 15 minutes
    const originalThreshold = socketRecovery.CLEANUP_THRESHOLD;
    socketRecovery.CLEANUP_THRESHOLD = 15 * 60 * 1000; // 15 minutes
    
    // Run the cleanup
    socketRecovery.cleanupOldSessions();
    
    // Verify the result - recent and within threshold states remain, expired removed
    expect(socketRecovery.playerStates).toHaveProperty('player1-GAME1');
    expect(socketRecovery.playerStates).toHaveProperty('player2-GAME1');
    expect(socketRecovery.playerStates).not.toHaveProperty('player3-GAME2');
    
    // Restore original threshold
    socketRecovery.CLEANUP_THRESHOLD = originalThreshold;
  });
  
  test('handleStateResync should update session with server state', () => {
    // Create test socket with room info
    mockSocket.gameSessionCode = 'TEST123';
    mockSocket.playerId = 'player-123';
    
    // Mock received client state
    const clientState = { 
      lastState: { score: 100, question: 5 }, 
      timestamp: Date.now() - 5000 // 5 seconds ago
    };
    
    // Mock server state that would be merged with client state
    const serverState = {
      score: 120,  // Updated score
      question: 6, // Updated question
      players: [
        { id: 'player-123', score: 120 },
        { id: 'player-456', score: 80 }
      ]
    };
    
    // Store the server state in the recovery service
    socketRecovery.storeGameState('TEST123', serverState);
    
    // Call the resync handler
    socketRecovery.handleStateResync(mockSocket, mockIo, clientState);
    
    // Should emit merged state back to client
    expect(mockSocket.emit).toHaveBeenCalledWith('state:update', expect.objectContaining({
      score: 120,     // Should use server value
      question: 6,    // Should use server value
      players: expect.any(Array)
    }));
  });
});