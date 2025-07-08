/**
 * Socket Service Tests
 * Using Vitest for cleaner mocks and assertions
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { io } from 'socket.io-client';
import SocketService from '../socketService';
import * as socketErrorHandler from '../socketErrorHandler';

// Mock dependencies
vi.mock('socket.io-client', () => ({
  io: vi.fn()
}));

vi.mock('../socketErrorHandler', () => ({
  initErrorHandling: vi.fn()
}));

vi.mock('../../config/config', () => ({
  SOCKET_URL: 'http://localhost:3001/api'
}));

describe('SocketService', () => {
  // Mock socket object
  let mockSocket;
  let mockNamespaceSocket;
  
  beforeEach(() => {
    // Create a mock socket with all required methods
    mockSocket = {
      id: 'mock-socket-id',
      connected: true,
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      io: {
        opts: {}
      }
    };
    
    mockNamespaceSocket = {
      id: 'mock-namespace-socket-id',
      connected: true,
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      io: {
        opts: {}
      }
    };
    
    // Set up io mock implementation
    io.mockImplementation((url, options) => {
      // Return different mock socket based on URL
      if (url.includes('/game') || url.includes('/player') || url.includes('/host')) {
        return mockNamespaceSocket;
      }
      return mockSocket;
    });
    
    // Reset the socket service instance for each test
    SocketService.socket = null;
    SocketService.gameSocket = null;
    SocketService.playerSocket = null;
    SocketService.hostSocket = null;
    SocketService.namespaces = new Map();
    SocketService.onConnectCallbacks = [];
    SocketService.onDisconnectCallbacks = [];
    SocketService.onErrorCallbacks = [];
    SocketService.onReconnectCallbacks = [];
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  test('connect() should return socket with valid auth', () => {
    const auth = { playerId: 'player-123' };
    const socket = SocketService.connect(auth);
    
    // Should call io with correct URL and options
    expect(io).toHaveBeenCalledWith(
      'http://localhost:3001',
      expect.objectContaining({
        auth,
        reconnection: true
      })
    );
    
    // Should return the socket
    expect(socket).toBe(mockSocket);
    
    // Should set up event handlers
    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
    
    // Should set up error handling
    expect(socketErrorHandler.initErrorHandling).toHaveBeenCalled();
  });
  
  test('connect() should not connect without playerId', () => {
    const auth = {};
    const socket = SocketService.connect(auth);
    
    // Should not call io
    expect(io).not.toHaveBeenCalled();
    
    // Should return null
    expect(socket).toBeNull();
  });
  
  test('connect() should connect with allowNoAuth option', () => {
    const auth = {};
    const options = { allowNoAuth: true };
    const socket = SocketService.connect(auth, options);
    
    // Should call io with empty auth
    expect(io).toHaveBeenCalledWith(
      'http://localhost:3001',
      expect.objectContaining({ auth })
    );
    
    // Should return the socket
    expect(socket).toBe(mockSocket);
  });
  
  test('connectToNamespace() should connect to specific namespace', () => {
    const auth = { playerId: 'player-123' };
    const namespace = 'game';
    const socket = SocketService.connectToNamespace(namespace, auth);
    
    // Should call io with namespace URL
    expect(io).toHaveBeenCalledWith(
      'http://localhost:3001/game',
      expect.objectContaining({ auth })
    );
    
    // Should return the socket
    expect(socket).toBe(mockNamespaceSocket);
    
    // Should store socket in namespaces map
    expect(SocketService.namespaces.get('game')).toBe(mockNamespaceSocket);
    
    // Should set the specific socket property
    expect(SocketService.gameSocket).toBe(mockNamespaceSocket);
  });
  
  test('disconnect() should disconnect from all sockets', () => {
    // Set up sockets for test
    SocketService.socket = mockSocket;
    SocketService.namespaces.set('game', mockNamespaceSocket);
    SocketService.gameSocket = mockNamespaceSocket;
    
    // Call disconnect
    SocketService.disconnect();
    
    // Should call disconnect on all sockets
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(mockNamespaceSocket.disconnect).toHaveBeenCalled();
    
    // Should clear all socket references
    expect(SocketService.socket).toBeNull();
    expect(SocketService.gameSocket).toBeNull();
    expect(SocketService.namespaces.size).toBe(0);
  });
  
  test('disconnectFromNamespace() should disconnect from specific namespace', () => {
    // Set up sockets for test
    SocketService.socket = mockSocket;
    SocketService.namespaces.set('game', mockNamespaceSocket);
    SocketService.gameSocket = mockNamespaceSocket;
    
    // Call disconnectFromNamespace
    SocketService.disconnectFromNamespace('game');
    
    // Should call disconnect on namespace socket only
    expect(mockNamespaceSocket.disconnect).toHaveBeenCalled();
    expect(mockSocket.disconnect).not.toHaveBeenCalled();
    
    // Should clear namespace socket reference
    expect(SocketService.gameSocket).toBeNull();
    expect(SocketService.namespaces.size).toBe(0);
    
    // Should not clear main socket
    expect(SocketService.socket).toBe(mockSocket);
  });
  
  test('joinGameSession() should connect to appropriate namespaces as player', () => {
    // Call joinGameSession as player
    SocketService.joinGameSession('game-123', 'TEST123', 'player-456', false);
    
    // Should connect to game namespace
    expect(io).toHaveBeenCalledWith(
      'http://localhost:3001/game',
      expect.objectContaining({
        auth: {
          playerId: 'player-456',
          gameSessionId: 'game-123',
          gameCode: 'TEST123',
          isHost: false
        }
      })
    );
    
    // Should connect to player namespace
    expect(io).toHaveBeenCalledWith(
      'http://localhost:3001/player',
      expect.objectContaining({
        auth: {
          playerId: 'player-456',
          gameSessionId: 'game-123',
          gameCode: 'TEST123',
          isHost: false
        }
      })
    );
    
    // Should emit join event to game namespace
    expect(mockNamespaceSocket.emit).toHaveBeenCalledWith(
      'game:join',
      expect.objectContaining({
        gameSessionId: 'game-123',
        gameCode: 'TEST123',
        playerId: 'player-456',
        isHost: false
      })
    );
  });
  
  test('joinGameSession() should connect to appropriate namespaces as host', () => {
    // Call joinGameSession as host
    SocketService.joinGameSession('game-123', 'TEST123', 'player-456', true);
    
    // Should connect to game namespace
    expect(io).toHaveBeenCalledWith(
      'http://localhost:3001/game',
      expect.objectContaining({
        auth: {
          playerId: 'player-456',
          gameSessionId: 'game-123',
          gameCode: 'TEST123',
          isHost: true
        }
      })
    );
    
    // Should connect to host namespace
    expect(io).toHaveBeenCalledWith(
      'http://localhost:3001/host',
      expect.objectContaining({
        auth: {
          playerId: 'player-456',
          gameSessionId: 'game-123',
          gameCode: 'TEST123',
          isHost: true
        }
      })
    );
  });
  
  test('callback registration methods should work correctly', () => {
    // Define test callbacks
    const connectCallback = vi.fn();
    const disconnectCallback = vi.fn();
    const errorCallback = vi.fn();
    const reconnectCallback = vi.fn();
    
    // Register callbacks
    SocketService.onConnect(connectCallback);
    SocketService.onDisconnect(disconnectCallback);
    SocketService.onError(errorCallback);
    SocketService.onReconnect(reconnectCallback);
    
    // Check if callbacks were added
    expect(SocketService.onConnectCallbacks).toContain(connectCallback);
    expect(SocketService.onDisconnectCallbacks).toContain(disconnectCallback);
    expect(SocketService.onErrorCallbacks).toContain(errorCallback);
    expect(SocketService.onReconnectCallbacks).toContain(reconnectCallback);
  });
  
  test('handleReconnect() should call registered callbacks', () => {
    // Define test callback
    const reconnectCallback = vi.fn();
    
    // Register callback
    SocketService.onReconnect(reconnectCallback);
    
    // Call handleReconnect
    SocketService.handleReconnect(3);
    
    // Should call callback with attempt number
    expect(reconnectCallback).toHaveBeenCalledWith(3);
    
    // Should update reconnection state
    expect(SocketService.isConnected).toBe(true);
    expect(SocketService.reconnectAttempts).toBe(0);
  });
  
  test('emit() should call socket.emit with correct arguments', () => {
    // Set up socket
    SocketService.socket = mockSocket;
    
    // Call emit
    SocketService.emit('test:event', { data: 'test' });
    
    // Should call socket.emit
    expect(mockSocket.emit).toHaveBeenCalledWith('test:event', { data: 'test' });
  });
  
  test('emitToNamespace() should emit to the correct namespace', () => {
    // Set up namespace socket
    SocketService.namespaces.set('game', mockNamespaceSocket);
    
    // Call emitToNamespace
    SocketService.emitToNamespace('game', 'test:event', { data: 'test' });
    
    // Should call socket.emit on the namespace socket
    expect(mockNamespaceSocket.emit).toHaveBeenCalledWith('test:event', { data: 'test' });
  });
  
  test('on() should register event handler on socket', () => {
    // Set up socket
    SocketService.socket = mockSocket;
    
    // Define event handler
    const handler = vi.fn();
    
    // Call on
    SocketService.on('test:event', handler);
    
    // Should call socket.on
    expect(mockSocket.on).toHaveBeenCalledWith('test:event', handler);
  });
  
  test('off() should remove event handler from socket', () => {
    // Set up socket
    SocketService.socket = mockSocket;
    
    // Define event handler
    const handler = vi.fn();
    
    // Call off
    SocketService.off('test:event', handler);
    
    // Should call socket.off
    expect(mockSocket.off).toHaveBeenCalledWith('test:event', handler);
  });
});