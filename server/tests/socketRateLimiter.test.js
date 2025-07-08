/**
 * Socket Rate Limiter Tests
 * Tests for socket request rate limiting functionality
 */
const socketRateLimiter = require('../services/socketRateLimiter');

describe('Socket Rate Limiter', () => {
  let mockSocket;
  let mockNext;
  let originalConsoleWarn;
  
  beforeEach(() => {
    // Save original console methods
    originalConsoleWarn = console.warn;
    
    // Mock console methods
    console.warn = jest.fn();
    
    // Create mock socket
    mockSocket = {
      id: 'socket-123',
      playerId: 'player-123',
      gameSessionId: 'game-123',
      handshake: {
        address: '127.0.0.1',
        auth: {
          playerId: 'player-123'
        }
      },
      emit: jest.fn(),
      disconnect: jest.fn()
    };
    
    // Mock next function
    mockNext = jest.fn();
    
    // Reset the rate limiter state
    if (socketRateLimiter.resetForTesting) {
      socketRateLimiter.resetForTesting();
    }
  });
  
  afterEach(() => {
    // Restore console methods
    console.warn = originalConsoleWarn;
    
    // Clear all mocks
    jest.clearAllMocks();
  });
  
  test('should allow events under the rate limit', () => {
    // Create rate limiter middleware
    const rateLimiter = socketRateLimiter.createRateLimiter({
      points: 5,      // Allow 5 requests
      duration: 1,    // Per 1 second
      blockDuration: 2 // Block for 2 seconds if exceeded
    });
    
    // Event packet for testing
    const packet = [
      'test:event',
      { data: 'test-data' }
    ];
    
    // Call middleware multiple times, but under limit
    for (let i = 0; i < 5; i++) {
      rateLimiter(mockSocket, packet, mockNext);
    }
    
    // Next should have been called 5 times
    expect(mockNext).toHaveBeenCalledTimes(5);
    
    // No error should be emitted
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });
  
  test('should block events over the rate limit', () => {
    // Create rate limiter middleware with low limit for testing
    const rateLimiter = socketRateLimiter.createRateLimiter({
      points: 3,      // Allow 3 requests
      duration: 1,    // Per 1 second
      blockDuration: 2 // Block for 2 seconds if exceeded
    });
    
    // Event packet for testing
    const packet = [
      'test:event',
      { data: 'test-data' }
    ];
    
    // Call middleware multiple times, exceeding the limit
    for (let i = 0; i < 5; i++) {
      rateLimiter(mockSocket, packet, mockNext);
    }
    
    // Next should only be called 3 times (up to the limit)
    expect(mockNext).toHaveBeenCalledTimes(3);
    
    // Error should be emitted for the blocked requests
    expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
      code: 'RATE_LIMIT_EXCEEDED',
      message: expect.stringContaining('rate limit')
    }));
    
    // Should have been called twice (for the 4th and 5th requests)
    expect(mockSocket.emit).toHaveBeenCalledTimes(2);
  });
  
  test('should exempt certain events from rate limiting', () => {
    // Create rate limiter middleware with exempt events
    const rateLimiter = socketRateLimiter.createRateLimiter({
      points: 2,      // Allow only 2 requests
      duration: 1,    // Per 1 second
      blockDuration: 2, // Block for 2 seconds if exceeded
      exemptEvents: ['exempt:event']
    });
    
    // Regular event packet
    const regularPacket = [
      'test:event',
      { data: 'test-data' }
    ];
    
    // Exempt event packet
    const exemptPacket = [
      'exempt:event',
      { data: 'exempt-data' }
    ];
    
    // Use up the regular event quota
    rateLimiter(mockSocket, regularPacket, mockNext);
    rateLimiter(mockSocket, regularPacket, mockNext);
    
    // Now a third regular event should be blocked
    rateLimiter(mockSocket, regularPacket, mockNext);
    
    // But exempt events should still go through
    rateLimiter(mockSocket, exemptPacket, mockNext);
    rateLimiter(mockSocket, exemptPacket, mockNext);
    
    // Next should be called 4 times (2 regular + 2 exempt)
    expect(mockNext).toHaveBeenCalledTimes(4);
    
    // Error should be emitted once for the blocked regular request
    expect(mockSocket.emit).toHaveBeenCalledTimes(1);
  });
  
  test('should allow configuration by connection type', () => {
    // Create rate limiter with different limits for player vs host
    const rateLimiter = socketRateLimiter.createRateLimiter({
      // Default config
      points: 2,
      duration: 1,
      
      // Player-specific config (stricter)
      playerLimits: {
        points: 1,
        duration: 1
      },
      
      // Host-specific config (more permissive)
      hostLimits: {
        points: 5,
        duration: 1
      }
    });
    
    // Create player and host sockets
    const playerSocket = {
      ...mockSocket,
      isHost: false
    };
    
    const hostSocket = {
      ...mockSocket,
      id: 'host-socket',
      isHost: true,
      handshake: {
        ...mockSocket.handshake,
        auth: {
          ...mockSocket.handshake.auth,
          isHost: true
        }
      },
      emit: jest.fn()
    };
    
    const playerNext = jest.fn();
    const hostNext = jest.fn();
    
    // Event packet
    const packet = [
      'test:event',
      { data: 'test-data' }
    ];
    
    // Player should be limited to 1 request
    rateLimiter(playerSocket, packet, playerNext);
    rateLimiter(playerSocket, packet, playerNext);
    
    // Host should be allowed 5 requests
    for (let i = 0; i < 5; i++) {
      rateLimiter(hostSocket, packet, hostNext);
    }
    
    // Check results
    expect(playerNext).toHaveBeenCalledTimes(1); // Only first request allowed
    expect(playerSocket.emit).toHaveBeenCalledTimes(1); // One error for exceeding limit
    
    expect(hostNext).toHaveBeenCalledTimes(5); // All requests allowed
    expect(hostSocket.emit).not.toHaveBeenCalled(); // No errors
  });
  
  test('should disconnect socket after too many violations', () => {
    // Create rate limiter with low tolerance for violations
    const rateLimiter = socketRateLimiter.createRateLimiter({
      points: 1,             // Allow 1 request
      duration: 1,           // Per 1 second
      maxViolations: 2,      // Only allow 2 violations
      blockDuration: 1       // Block for 1 second
    });
    
    // Event packet
    const packet = [
      'test:event',
      { data: 'test-data' }
    ];
    
    // First request is allowed
    rateLimiter(mockSocket, packet, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
    
    // Next 2 are violations but don't trigger disconnect
    rateLimiter(mockSocket, packet, mockNext);
    rateLimiter(mockSocket, packet, mockNext);
    
    expect(mockSocket.emit).toHaveBeenCalledTimes(2);
    expect(mockSocket.disconnect).not.toHaveBeenCalled();
    
    // Third violation should trigger disconnect
    rateLimiter(mockSocket, packet, mockNext);
    
    expect(mockSocket.emit).toHaveBeenCalledTimes(3);
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });
});