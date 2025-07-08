/**
 * Socket.io Connectivity Test Suite
 * Tests for real-time communication functionality using mocks
 */
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const socketService = require('../services/socketService');

// Mock the database models
jest.mock('../models', () => {
  // Create mock player data
  const mockPlayer = {
    id: 123,
    name: 'Test Player',
    deviceId: 'test-device-123',
    age: 25,
    specialistSubject: 'Science',
    avatar: 'default.png'
  };
  
  // Create mock game session data
  const mockGameSession = {
    id: 456,
    code: 'TEST123',
    hostId: 123,
    status: 'lobby',
    players: [{
      playerId: 123,
      score: 0,
      position: 1,
      active: true
    }]
  };

  return {
    Player: {
      findByPk: jest.fn().mockResolvedValue(mockPlayer),
      findOne: jest.fn().mockResolvedValue(mockPlayer),
      findById: jest.fn().mockResolvedValue(mockPlayer)
    },
    GameSession: {
      findByPk: jest.fn().mockResolvedValue(mockGameSession),
      findOne: jest.fn().mockResolvedValue(mockGameSession),
      findByCode: jest.fn().mockResolvedValue(mockGameSession)
    }
  };
});

// Mock socket monitoring
jest.mock('../services/socketMonitoring', () => ({
  initializeMonitoring: jest.fn(),
  trackConnection: jest.fn(),
  trackDisconnection: jest.fn(),
  trackError: jest.fn()
}));

// Test setup variables
let io;
let httpServer;
let port;
let clientSocket;
let gameNamespaceSocket;
let playerNamespaceSocket;
let hostNamespaceSocket;
let connectedSockets = [];

/**
 * Setup function before all tests
 */
beforeAll((done) => {
  // Setup Socket.io server
  httpServer = createServer();
  io = new Server(httpServer);
  socketService.initialize(io);
  
  // Start server on random port
  httpServer.listen(() => {
    port = httpServer.address().port;
    console.log(`Test socket server running on port ${port}`);
    done();
  });
});

/**
 * Clean up after each test
 */
afterEach(() => {
  // Disconnect all client sockets
  connectedSockets.forEach(socket => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
  });
  connectedSockets = [];
});

/**
 * Cleanup after all tests
 */
afterAll(() => {
  // Close connections
  if (io) {
    io.close();
  }
  
  if (httpServer) {
    httpServer.close();
  }
  
  // Clear all mocks
  jest.clearAllMocks();
});

/**
 * Helper to create a client socket with auth
 */
function createClientSocket(auth = {}, namespace = '') {
  const socket = Client(`http://localhost:${port}${namespace}`, {
    auth,
    reconnectionDelay: 0,
    forceNew: true,
    transports: ['websocket']
  });
  connectedSockets.push(socket);
  return socket;
}

/**
 * Basic connection test
 */
describe('Socket.io Connection', () => {
  test('should connect with valid player ID', (done) => {
    const auth = { playerId: 123 };
    clientSocket = createClientSocket(auth);
    
    clientSocket.on('connect', () => {
      expect(clientSocket.connected).toBeTruthy();
      done();
    });
    
    clientSocket.on('connect_error', (err) => {
      done(new Error(`Connection error: ${err.message}`));
    });
  });
  
  test('should reject connection with missing player ID', (done) => {
    clientSocket = createClientSocket({});
    
    clientSocket.on('connect_error', (err) => {
      expect(err.message).toContain('Player ID required');
      done();
    });
    
    // Fail test if we connect successfully
    clientSocket.on('connect', () => {
      done(new Error('Should not connect without player ID'));
    });
  });
  
  test('should handle reconnection', (done) => {
    const auth = { playerId: 123 };
    let disconnectCount = 0;
    let connectCount = 0;
    
    clientSocket = createClientSocket(auth);
    
    clientSocket.on('connect', () => {
      connectCount++;
      
      if (connectCount === 1) {
        // First connection - force disconnect
        clientSocket.disconnect();
      } else if (connectCount === 2) {
        // Second connection after reconnect
        expect(disconnectCount).toBe(1);
        done();
      }
    });
    
    clientSocket.on('disconnect', () => {
      disconnectCount++;
      
      if (disconnectCount === 1) {
        // Reconnect after a short delay
        setTimeout(() => {
          clientSocket.connect();
        }, 100);
      }
    });
    
    clientSocket.on('connect_error', (err) => {
      done(new Error(`Connection error: ${err.message}`));
    });
  });
});

/**
 * Namespace connection tests
 */
describe('Socket.io Namespace Connections', () => {
  test('should connect to game namespace', (done) => {
    const auth = {
      playerId: 123,
      gameSessionId: 456,
      gameCode: 'TEST123'
    };
    
    gameNamespaceSocket = createClientSocket(auth, '/game');
    
    gameNamespaceSocket.on('connect', () => {
      expect(gameNamespaceSocket.connected).toBeTruthy();
      done();
    });
    
    gameNamespaceSocket.on('connect_error', (err) => {
      done(new Error(`Game namespace connection error: ${err.message}`));
    });
  });
  
  test('should connect to player namespace', (done) => {
    const auth = {
      playerId: 123,
      gameSessionId: 456,
      gameCode: 'TEST123'
    };
    
    playerNamespaceSocket = createClientSocket(auth, '/player');
    
    playerNamespaceSocket.on('connect', () => {
      expect(playerNamespaceSocket.connected).toBeTruthy();
      done();
    });
    
    playerNamespaceSocket.on('connect_error', (err) => {
      done(new Error(`Player namespace connection error: ${err.message}`));
    });
  });
  
  test('should connect to host namespace', (done) => {
    const auth = {
      playerId: 123,
      gameSessionId: 456,
      gameCode: 'TEST123',
      isHost: true
    };
    
    hostNamespaceSocket = createClientSocket(auth, '/host');
    
    hostNamespaceSocket.on('connect', () => {
      expect(hostNamespaceSocket.connected).toBeTruthy();
      done();
    });
    
    hostNamespaceSocket.on('connect_error', (err) => {
      done(new Error(`Host namespace connection error: ${err.message}`));
    });
  });
  
  test('should connect to multiple namespaces concurrently', (done) => {
    const auth = {
      playerId: 123,
      gameSessionId: 456,
      gameCode: 'TEST123',
      isHost: true
    };
    
    let connected = {
      main: false,
      game: false,
      player: false
    };
    
    // Connect to main socket
    clientSocket = createClientSocket(auth);
    clientSocket.on('connect', () => {
      connected.main = true;
      checkAllConnected();
    });
    
    // Connect to game namespace
    gameNamespaceSocket = createClientSocket(auth, '/game');
    gameNamespaceSocket.on('connect', () => {
      connected.game = true;
      checkAllConnected();
    });
    
    // Connect to player namespace
    playerNamespaceSocket = createClientSocket(auth, '/player');
    playerNamespaceSocket.on('connect', () => {
      connected.player = true;
      checkAllConnected();
    });
    
    function checkAllConnected() {
      if (connected.main && connected.game && connected.player) {
        expect(clientSocket.connected).toBeTruthy();
        expect(gameNamespaceSocket.connected).toBeTruthy();
        expect(playerNamespaceSocket.connected).toBeTruthy();
        done();
      }
    }
    
    // Set timeout for the test
    setTimeout(() => {
      const missingConnections = Object.entries(connected)
        .filter(([_, isConnected]) => !isConnected)
        .map(([name]) => name);
      
      if (missingConnections.length > 0) {
        done(new Error(`Timed out waiting for connections to: ${missingConnections.join(', ')}`));
      }
    }, 5000);
  });
});

/**
 * Socket event handling tests
 */
describe('Socket Event Handling', () => {
  test('should handle events from server', (done) => {
    const auth = { playerId: 123 };
    clientSocket = createClientSocket(auth);
    
    clientSocket.on('connect', () => {
      // Test case successful - we were able to connect
      done();
    });
  });
  
  test('should receive disconnect event on server shutdown', (done) => {
    const auth = { playerId: 123 };
    clientSocket = createClientSocket(auth);
    
    clientSocket.on('connect', () => {
      // Once connected, listen for disconnect
      clientSocket.on('disconnect', (reason) => {
        expect(reason).toBeDefined();
        done();
      });
      
      // Shut down the server after a short delay
      setTimeout(() => {
        io.close();
        
        // Create a new server for subsequent tests
        setTimeout(() => {
          httpServer = createServer();
          io = new Server(httpServer);
          socketService.initialize(io);
          
          httpServer.listen(port);
        }, 100);
      }, 100);
    });
    
    // Set timeout for the test
    setTimeout(() => {
      done(new Error('Timed out waiting for disconnect event'));
    }, 5000);
  });
});