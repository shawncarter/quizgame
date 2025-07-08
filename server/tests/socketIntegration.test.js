/**
 * Socket.io Integration Test
 * Tests real socket connections with proper authentication and namespaces
 */
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const socketService = require('../services/socketService');
const { GameSession, Player } = require('../models');

describe('Socket.io Real Connection Test', () => {
  let mongoServer;
  let httpServer;
  let io;
  let serverPort;
  let gameSession;
  let quizmaster;
  let testPlayer;

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
        console.log(`🔌 Socket test server started on port ${serverPort}`);
        resolve();
      });
    });
  }, 15000);

  afterAll(async () => {
    if (io) io.close();
    if (httpServer) httpServer.close();
    await mongoose.disconnect();
    await mongoServer.stop();
  }, 15000);

  beforeEach(async () => {
    // Clear database
    await GameSession.deleteMany({});
    await Player.deleteMany({});

    // Create test data
    quizmaster = await Player.create({
      name: 'Quiz Master',
      deviceId: 'quizmaster-device',
      age: 35,
      specialistSubject: 'General Knowledge'
    });

    testPlayer = await Player.create({
      name: 'Test Player',
      deviceId: 'test-player-device',
      age: 25,
      specialistSubject: 'Science'
    });

    gameSession = await GameSession.create({
      hostId: quizmaster._id,
      code: 'SOCKET123',
      status: 'active',
      players: [
        { playerId: testPlayer._id, score: 0, active: true }
      ],
      currentRound: 0,
      rounds: []
    });
  });

  describe('Socket Connection and Authentication', () => {
    test('should connect to test namespace without authentication', async () => {
      console.log('\n🧪 Testing connection to /test namespace...');
      
      const testSocket = Client(`http://localhost:${serverPort}/test`);
      
      const connected = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false);
        }, 5000);
        
        testSocket.on('connect', () => {
          clearTimeout(timeout);
          console.log('✅ Successfully connected to /test namespace');
          resolve(true);
        });
        
        testSocket.on('connect_error', (error) => {
          clearTimeout(timeout);
          console.log('❌ Connection error:', error.message);
          resolve(false);
        });
      });

      expect(connected).toBe(true);
      expect(testSocket.connected).toBe(true);
      
      testSocket.close();
    }, 10000);

    test('should connect to root namespace with proper authentication', async () => {
      console.log('\n🔐 Testing authenticated connection to root namespace...');
      
      const authenticatedSocket = Client(`http://localhost:${serverPort}`, {
        auth: {
          playerId: quizmaster._id.toString(),
          gameSessionId: gameSession._id.toString(),
          isHost: true
        }
      });
      
      const connected = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false);
        }, 5000);
        
        authenticatedSocket.on('connect', () => {
          clearTimeout(timeout);
          console.log('✅ Successfully connected with authentication');
          resolve(true);
        });
        
        authenticatedSocket.on('connect_error', (error) => {
          clearTimeout(timeout);
          console.log('❌ Authentication error:', error.message);
          resolve(false);
        });
      });

      expect(connected).toBe(true);
      expect(authenticatedSocket.connected).toBe(true);
      
      authenticatedSocket.close();
    }, 10000);

    test('should reject connection without proper authentication', async () => {
      console.log('\n🚫 Testing connection rejection without authentication...');
      
      const unauthenticatedSocket = Client(`http://localhost:${serverPort}`);
      
      const rejected = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false);
        }, 5000);
        
        unauthenticatedSocket.on('connect', () => {
          clearTimeout(timeout);
          console.log('❌ Should not have connected without auth');
          resolve(false);
        });
        
        unauthenticatedSocket.on('connect_error', (error) => {
          clearTimeout(timeout);
          console.log('✅ Correctly rejected connection:', error.message);
          resolve(true);
        });
      });

      expect(rejected).toBe(true);
      
      unauthenticatedSocket.close();
    }, 10000);
  });

  describe('Game Events Through Sockets', () => {
    let hostSocket;
    let playerSocket;

    beforeEach(async () => {
      // Connect host socket
      hostSocket = Client(`http://localhost:${serverPort}`, {
        auth: {
          playerId: quizmaster._id.toString(),
          gameSessionId: gameSession._id.toString(),
          isHost: true
        }
      });

      await new Promise((resolve) => {
        hostSocket.on('connect', resolve);
      });

      // Connect player socket  
      playerSocket = Client(`http://localhost:${serverPort}`, {
        auth: {
          playerId: testPlayer._id.toString(),
          gameSessionId: gameSession._id.toString(),
          isHost: false
        }
      });

      await new Promise((resolve) => {
        playerSocket.on('connect', resolve);
      });

      console.log('✅ Both host and player sockets connected');
    });

    afterEach(() => {
      if (hostSocket) hostSocket.close();
      if (playerSocket) playerSocket.close();
    });

    test('should handle round start event through sockets', async () => {
      console.log('\n🎯 Testing round start through socket...');
      
      let roundStartReceived = false;
      
      // Listen for round started event
      const roundStartPromise = new Promise((resolve) => {
        hostSocket.on('round:started', (data) => {
          if (!roundStartReceived) {
            roundStartReceived = true;
            console.log('✅ Host received round:started event:', data);
            expect(data.roundNumber).toBe(1);
            expect(data.roundType).toBe('point-builder');
            resolve(data);
          }
        });
      });

      // Start a round
      hostSocket.emit('round:start', {
        roundNumber: 1,
        roundType: 'point-builder',
        pointsPerQuestion: 10
      });

      const roundData = await roundStartPromise;
      expect(roundData).toBeDefined();
      
      // Verify database was updated
      const updatedSession = await GameSession.findById(gameSession._id);
      expect(updatedSession.currentRound).toBe(1);
      expect(updatedSession.currentRoundType).toBe('point-builder');
      expect(updatedSession.rounds).toHaveLength(1);
      
      console.log('✅ Round start event and database update verified');
    }, 10000);

    test('should handle round end event through sockets', async () => {
      console.log('\n🏁 Testing round end through socket...');
      
      // First start a round
      hostSocket.emit('round:start', {
        roundNumber: 1,
        roundType: 'point-builder'
      });

      await new Promise((resolve) => {
        hostSocket.on('round:started', resolve);
      });

      // Now end the round
      let roundEndReceived = false;
      
      const roundEndPromise = new Promise((resolve) => {
        hostSocket.on('round:ended', (data) => {
          if (!roundEndReceived) {
            roundEndReceived = true;
            console.log('✅ Host received round:ended event:', data);
            expect(data.roundNumber).toBe(1);
            resolve(data);
          }
        });
      });

      hostSocket.emit('round:end', { roundNumber: 1 });

      const endData = await roundEndPromise;
      expect(endData).toBeDefined();
      
      // Verify database was updated
      const updatedSession = await GameSession.findById(gameSession._id);
      const round = updatedSession.rounds.find(r => r.roundNumber === 1);
      expect(round.completed).toBe(true);
      
      console.log('✅ Round end event and database update verified');
    }, 10000);

    test('should handle error events properly', async () => {
      console.log('\n⚠️ Testing error handling through socket...');
      
      let errorReceived = false;
      
      const errorPromise = new Promise((resolve) => {
        hostSocket.on('error', (error) => {
          if (!errorReceived) {
            errorReceived = true;
            console.log('✅ Host received error event:', error);
            expect(error.code).toBe('INVALID_ROUND_TYPE');
            resolve(error);
          }
        });
      });

      // Send invalid round type
      hostSocket.emit('round:start', {
        roundNumber: 1,
        roundType: 'invalid-type'
      });

      const errorData = await errorPromise;
      expect(errorData).toBeDefined();
      
      console.log('✅ Error handling verified');
    }, 10000);
  });

  describe('Multiple Player Socket Communication', () => {
    test('should handle multiple players connecting and communicating', async () => {
      console.log('\n👥 Testing multiple player socket communication...');
      
      // Create additional players
      const player2 = await Player.create({
        name: 'Player 2',
        deviceId: 'player2-device',
        age: 28,
        specialistSubject: 'History'
      });

      const player3 = await Player.create({
        name: 'Player 3',
        deviceId: 'player3-device',
        age: 30,
        specialistSubject: 'Sports'
      });

      // Add them to game session
      const session = await GameSession.findById(gameSession._id);
      session.players.push(
        { playerId: player2._id, score: 0, active: true },
        { playerId: player3._id, score: 0, active: true }
      );
      await session.save();

      // Connect all sockets
      const hostSocket = Client(`http://localhost:${serverPort}`, {
        auth: {
          playerId: quizmaster._id.toString(),
          gameSessionId: gameSession._id.toString(),
          isHost: true
        }
      });

      const player1Socket = Client(`http://localhost:${serverPort}`, {
        auth: {
          playerId: testPlayer._id.toString(),
          gameSessionId: gameSession._id.toString(),
          isHost: false
        }
      });

      const player2Socket = Client(`http://localhost:${serverPort}`, {
        auth: {
          playerId: player2._id.toString(),
          gameSessionId: gameSession._id.toString(),
          isHost: false
        }
      });

      const player3Socket = Client(`http://localhost:${serverPort}`, {
        auth: {
          playerId: player3._id.toString(),
          gameSessionId: gameSession._id.toString(),
          isHost: false
        }
      });

      // Wait for all connections
      await Promise.all([
        new Promise(resolve => hostSocket.on('connect', resolve)),
        new Promise(resolve => player1Socket.on('connect', resolve)),
        new Promise(resolve => player2Socket.on('connect', resolve)),
        new Promise(resolve => player3Socket.on('connect', resolve))
      ]);

      console.log('✅ All 4 sockets connected (1 host + 3 players)');

      // Test broadcast - start round and verify all players receive it
      let receivedCount = 0;
      const targetCount = 4; // host + 3 players

      const broadcastPromise = new Promise((resolve) => {
        const checkComplete = () => {
          receivedCount++;
          if (receivedCount >= targetCount) {
            resolve();
          }
        };

        hostSocket.on('round:started', checkComplete);
        player1Socket.on('round:started', checkComplete);
        player2Socket.on('round:started', checkComplete);
        player3Socket.on('round:started', checkComplete);
      });

      // Start round
      hostSocket.emit('round:start', {
        roundNumber: 1,
        roundType: 'point-builder'
      });

      await broadcastPromise;
      
      console.log(`✅ Broadcast successful: ${receivedCount} sockets received round:started event`);

      // Cleanup
      [hostSocket, player1Socket, player2Socket, player3Socket].forEach(socket => {
        socket.close();
      });

      expect(receivedCount).toBe(targetCount);
    }, 15000);
  });
});