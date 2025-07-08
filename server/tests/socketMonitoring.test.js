/**
 * Socket Monitoring Service Tests
 * Tests for socket connection monitoring, metrics and health check functionality
 */
const socketMonitoring = require('../services/socketMonitoring');

describe('Socket Monitoring Service', () => {
  let mockIo;
  let mockSocket;
  let originalConsoleLog;
  let originalConsoleError;
  
  beforeEach(() => {
    // Save original console methods
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    
    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
    
    // Mock Socket.io server
    mockIo = {
      sockets: {
        sockets: new Map(),
        adapter: {
          rooms: new Map()
        }
      },
      of: jest.fn().mockReturnThis(),
      on: jest.fn(),
      use: jest.fn(),
      emit: jest.fn()
    };
    
    // Mock individual socket
    mockSocket = {
      id: 'socket-123',
      connected: true,
      handshake: {
        address: '127.0.0.1',
        time: new Date().toISOString(),
        auth: {
          playerId: 'player-123'
        }
      },
      client: {
        conn: {
          transport: { name: 'websocket' },
          remoteAddress: '127.0.0.1'
        }
      },
      disconnect: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    };
    
    // Add mock socket to server
    mockIo.sockets.sockets.set(mockSocket.id, mockSocket);
    
    // Reset monitoring service state
    if (socketMonitoring.resetForTesting) {
      socketMonitoring.resetForTesting();
    }
  });
  
  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    
    // Clear all mocks
    jest.clearAllMocks();
  });
  
  test('initializeMonitoring should set up monitoring', () => {
    // Call the initialization function
    socketMonitoring.initializeMonitoring(mockIo);
    
    // Verify monitoring is now enabled
    expect(socketMonitoring.isEnabled()).toBe(true);
    
    // Should have set up interval timers
    expect(socketMonitoring.getMonitoringInterval()).toBeGreaterThan(0);
  });
  
  test('trackConnection should record new connections', () => {
    // Initialize monitoring
    socketMonitoring.initializeMonitoring(mockIo);
    
    // Track a new connection
    socketMonitoring.trackConnection(mockSocket);
    
    // Get current connection metrics
    const metrics = socketMonitoring.getMetrics();
    
    // Verify connection was counted
    expect(metrics.totalConnections).toBe(1);
    expect(metrics.currentConnections).toBe(1);
  });
  
  test('trackDisconnection should record disconnections', () => {
    // Initialize monitoring
    socketMonitoring.initializeMonitoring(mockIo);
    
    // Track a connection and disconnection
    socketMonitoring.trackConnection(mockSocket);
    socketMonitoring.trackDisconnection(mockSocket);
    
    // Get current connection metrics
    const metrics = socketMonitoring.getMetrics();
    
    // Verify metrics reflect the disconnection
    expect(metrics.totalConnections).toBe(1);
    expect(metrics.currentConnections).toBe(0);
    expect(metrics.disconnections).toBe(1);
  });
  
  test('trackError should record connection errors', () => {
    // Initialize monitoring
    socketMonitoring.initializeMonitoring(mockIo);
    
    // Track an error
    const error = new Error('Test connection error');
    socketMonitoring.trackError(mockSocket, error);
    
    // Get current error metrics
    const metrics = socketMonitoring.getMetrics();
    
    // Verify error was counted
    expect(metrics.errors).toBe(1);
  });
  
  test('getHealthStatus should return server health', () => {
    // Initialize monitoring
    socketMonitoring.initializeMonitoring(mockIo);
    
    // Track some activity to generate metrics
    socketMonitoring.trackConnection(mockSocket);
    socketMonitoring.trackError(mockSocket, new Error('Test error'));
    
    // Get health status
    const health = socketMonitoring.getHealthStatus();
    
    // Verify health data structure
    expect(health).toEqual(expect.objectContaining({
      status: expect.any(String),
      uptime: expect.any(Number),
      connections: expect.objectContaining({
        current: expect.any(Number),
        total: expect.any(Number)
      }),
      errors: expect.any(Number),
      memory: expect.objectContaining({
        rss: expect.any(Number),
        heapTotal: expect.any(Number),
        heapUsed: expect.any(Number)
      })
    }));
  });
  
  test('getConnectionStats should provide detailed connection data', () => {
    // Initialize monitoring
    socketMonitoring.initializeMonitoring(mockIo);
    
    // Track multiple connections
    socketMonitoring.trackConnection(mockSocket);
    
    // Create a second mock socket
    const mockSocket2 = {
      ...mockSocket,
      id: 'socket-456',
      handshake: {
        ...mockSocket.handshake,
        address: '192.168.1.1',
        auth: {
          playerId: 'player-456'
        }
      }
    };
    
    // Add second socket to server and track
    mockIo.sockets.sockets.set(mockSocket2.id, mockSocket2);
    socketMonitoring.trackConnection(mockSocket2);
    
    // Get connection stats
    const stats = socketMonitoring.getConnectionStats();
    
    // Verify detailed connection data
    expect(stats.length).toBe(2);
    expect(stats[0]).toEqual(expect.objectContaining({
      socketId: mockSocket.id,
      playerId: mockSocket.handshake.auth.playerId,
      address: mockSocket.handshake.address,
      connected: true
    }));
  });
  
  test('disconnectStaleConnections should remove inactive sockets', () => {
    // Initialize monitoring
    socketMonitoring.initializeMonitoring(mockIo);
    
    // Create a stale socket by setting last activity timestamp far in the past
    const staleSocket = {
      ...mockSocket,
      id: 'stale-socket',
      lastActivity: Date.now() - (60 * 60 * 1000) // 1 hour ago
    };
    
    // Add stale socket to server
    mockIo.sockets.sockets.set(staleSocket.id, staleSocket);
    
    // Track the connection
    socketMonitoring.trackConnection(staleSocket);
    
    // Run the stale connection cleanup
    socketMonitoring.disconnectStaleConnections(mockIo);
    
    // Verify stale socket was disconnected
    expect(staleSocket.disconnect).toHaveBeenCalled();
  });
});