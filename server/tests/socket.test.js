/**
 * Socket.io Integration Tests
 * Tests for real-time communication functionality with actual socket connections
 */
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const socketService = require('../services/socketService');
const { GameSession, Player } = require('../models');

describe('Socket.io Integration Tests', () => {
  let io;
  let httpServer;
  let clientSocket;
  let gameSession;
  let hostPlayer;
  let mongoServer;
  let serverPort;

  beforeAll(async () => {
    // Set up in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Setup Socket.io server
    httpServer = createServer();
    io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    socketService.initialize(io);
    
    // Start server on random port
    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        serverPort = httpServer.address().port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Close connections
    if (clientSocket) {
      clientSocket.close();
    }
    if (io) {
      io.close();
    }
    if (httpServer) {
      httpServer.close();
    }
    
    // Close database
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear database
    await GameSession.deleteMany({});
    await Player.deleteMany({});

    // Create test data
    hostPlayer = await Player.create({
      name: 'Host Player',
      deviceId: 'host-device-123',
      age: 30,
      specialistSubject: 'Science'
    });

    gameSession = await GameSession.create({
      hostId: hostPlayer._id,
      code: 'TEST123',
      status: 'active',
      players: [],
      currentRound: 0,
      rounds: []
    });

    // Create client socket
    clientSocket = Client(`http://localhost:${serverPort}`);
    
    // Wait for connection
    await new Promise((resolve) => {
      clientSocket.on('connect', resolve);
    });
  });

  afterEach(async () => {
    if (clientSocket) {
      clientSocket.close();
    }
  });

  describe('Basic Socket Connection', () => {
    test('should connect to socket server', () => {
      expect(clientSocket.connected).toBe(true);
    });

    test('should receive connection confirmation', (done) => {
      clientSocket.on('connect', () => {
        expect(clientSocket.id).toBeDefined();
        done();
      });
    });

    test('should handle disconnection', (done) => {
      clientSocket.on('disconnect', () => {
        expect(clientSocket.connected).toBe(false);
        done();
      });
      
      clientSocket.disconnect();
    });
  });

  describe('Game Session Management', () => {
    test('should join game session', (done) => {
      clientSocket.emit('join-game', {
        code: gameSession.code,
        playerId: hostPlayer._id.toString()
      });

      clientSocket.on('game-joined', (data) => {
        expect(data.success).toBe(true);
        expect(data.gameCode).toBe(gameSession.code);
        done();
      });
    });

    test('should handle invalid game code', (done) => {
      clientSocket.emit('join-game', {
        code: 'INVALID',
        playerId: hostPlayer._id.toString()
      });

      clientSocket.on('error', (error) => {
        expect(error.code).toBe('GAME_NOT_FOUND');
        done();
      });
    });

    test('should broadcast to game room', (done) => {
      // First join the game
      clientSocket.emit('join-game', {
        code: gameSession.code,
        playerId: hostPlayer._id.toString()
      });

      clientSocket.on('game-joined', () => {
        // Create second client
        const client2 = Client(`http://localhost:${serverPort}`);
        
        client2.on('connect', () => {
          client2.emit('join-game', {
            code: gameSession.code,
            playerId: hostPlayer._id.toString()
          });
        });

        client2.on('game-joined', () => {
          // Now test broadcasting
          clientSocket.on('test-broadcast', (data) => {
            expect(data.message).toBe('Hello room!');
            client2.close();
            done();
          });

          client2.emit('test-broadcast', {
            message: 'Hello room!'
          });
        });
      });
    });
  });

  describe('Round Management via Socket', () => {
    beforeEach(async () => {
      // Join game first
      await new Promise((resolve) => {
        clientSocket.emit('join-game', {
          code: gameSession.code,
          playerId: hostPlayer._id.toString()
        });
        
        clientSocket.on('game-joined', resolve);
      });
    });

    test('should start round via socket', (done) => {
      clientSocket.emit('round:start', {
        roundNumber: 1,
        roundType: 'point-builder'
      });

      clientSocket.on('round:started', async (data) => {
        expect(data.roundNumber).toBe(1);
        expect(data.roundType).toBe('point-builder');
        
        // Verify database state
        const updatedSession = await GameSession.findById(gameSession._id);
        expect(updatedSession.currentRound).toBe(1);
        expect(updatedSession.currentRoundType).toBe('point-builder');
        
        done();
      });
    });

    test('should handle round start errors', (done) => {
      clientSocket.emit('round:start', {
        roundNumber: 1,
        roundType: 'invalid-type'
      });

      clientSocket.on('error', (error) => {
        expect(error.code).toBe('INVALID_ROUND_TYPE');
        done();
      });
    });

    test('should handle permission errors', async () => {
      // Create non-host player
      const nonHostPlayer = await Player.create({
        name: 'Non-Host Player',
        deviceId: 'non-host-device',
        age: 25,
        specialistSubject: 'Math'
      });

      // Create second socket for non-host
      const nonHostSocket = Client(`http://localhost:${serverPort}`);
      
      await new Promise((resolve) => {
        nonHostSocket.on('connect', resolve);
      });

      await new Promise((resolve) => {
        nonHostSocket.emit('join-game', {
          code: gameSession.code,
          playerId: nonHostPlayer._id.toString()
        });
        
        nonHostSocket.on('game-joined', resolve);
      });

      // Try to start round as non-host
      await new Promise((resolve) => {
        nonHostSocket.emit('round:start', {
          roundNumber: 1,
          roundType: 'point-builder'
        });

        nonHostSocket.on('error', (error) => {
          expect(error.code).toBe('PERMISSION_DENIED');
          resolve();
        });
      });

      nonHostSocket.close();
    });
  });

  describe('Real-time Game State Updates', () => {
    let player2Socket;
    let player2;

    beforeEach(async () => {
      // Create second player
      player2 = await Player.create({
        name: 'Player 2',
        deviceId: 'player2-device',
        age: 28,
        specialistSubject: 'History'
      });

      // Join host to game
      await new Promise((resolve) => {
        clientSocket.emit('join-game', {
          code: gameSession.code,
          playerId: hostPlayer._id.toString()
        });
        
        clientSocket.on('game-joined', resolve);
      });

      // Create and join second player
      player2Socket = Client(`http://localhost:${serverPort}`);
      
      await new Promise((resolve) => {
        player2Socket.on('connect', resolve);
      });

      await new Promise((resolve) => {
        player2Socket.emit('join-game', {
          code: gameSession.code,
          playerId: player2._id.toString()
        });
        
        player2Socket.on('game-joined', resolve);
      });
    });

    afterEach(() => {
      if (player2Socket) {
        player2Socket.close();
      }
    });

    test('should broadcast round start to all players', (done) => {
      let receivedCount = 0;
      
      const checkComplete = () => {
        receivedCount++;
        if (receivedCount === 2) {
          done();
        }
      };

      clientSocket.on('round:started', (data) => {
        expect(data.roundNumber).toBe(1);
        expect(data.roundType).toBe('point-builder');
        checkComplete();
      });

      player2Socket.on('round:started', (data) => {
        expect(data.roundNumber).toBe(1);
        expect(data.roundType).toBe('point-builder');
        checkComplete();
      });

      // Host starts round
      clientSocket.emit('round:start', {
        roundNumber: 1,
        roundType: 'point-builder'
      });
    });

    test('should maintain separate socket contexts', async () => {
      // Verify each socket has correct context
      expect(clientSocket.id).toBeDefined();
      expect(player2Socket.id).toBeDefined();
      expect(clientSocket.id).not.toBe(player2Socket.id);
      
      // Both should be in the same game room
      // This is verified by the broadcast test above
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed data', (done) => {
      clientSocket.emit('round:start', 'invalid-data');

      clientSocket.on('error', (error) => {
        expect(error.code).toBeDefined();
        done();
      });
    });

    test('should handle missing required fields', (done) => {
      clientSocket.emit('round:start', {
        roundNumber: 1
        // Missing roundType
      });

      clientSocket.on('error', (error) => {
        expect(error.code).toBe('INVALID_REQUEST');
        done();
      });
    });
  });
});