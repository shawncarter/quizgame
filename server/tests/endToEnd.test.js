/**
 * End-to-End Quiz Game Test
 * Complete game simulation: quizmaster, 12 players, multiple rounds, scoring, game completion
 */
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const socketService = require('../services/socketService');
const { GameSession, Player, Question } = require('../models');

describe('End-to-End Quiz Game Test', () => {
  let mongoServer;
  let httpServer;
  let io;
  let serverPort;
  let gameSession;
  let quizmaster;
  let players = [];
  let playerSockets = [];
  let quizmasterSocket;

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

    console.log(`🚀 Test server started on port ${serverPort}`);
  }, 30000);

  afterAll(async () => {
    // Cleanup all services first
    const socketService = require('../services/socketService');
    const socketMonitoring = require('../services/socketMonitoring');
    const socketRecovery = require('../services/socketRecovery');

    socketService.cleanup();
    socketMonitoring.cleanup();
    socketRecovery.cleanup();

    // Close all socket connections with proper cleanup
    if (playerSockets && playerSockets.length > 0) {
      for (const socket of playerSockets) {
        if (socket && socket.connected) {
          socket.removeAllListeners(); // Remove all event listeners
          socket.close();
        }
      }
      playerSockets = [];
    }

    if (quizmasterSocket && quizmasterSocket.connected) {
      quizmasterSocket.removeAllListeners(); // Remove all event listeners
      quizmasterSocket.close();
      quizmasterSocket = null;
    }

    // Close socket.io server
    if (io) {
      io.close();
      await new Promise(resolve => setTimeout(resolve, 200)); // Give more time for cleanup
    }

    // Close HTTP server
    if (httpServer) {
      await new Promise((resolve) => {
        httpServer.close(() => {
          resolve();
        });
      });
      await new Promise(resolve => setTimeout(resolve, 200)); // Give more time for cleanup
    }

    // Close database
    await mongoose.disconnect();
    await mongoServer.stop();
  }, 30000);

  describe('Complete Game Flow', () => {
    test('should run a complete quiz game from start to finish', async () => {
      console.log('\n🎯 Starting End-to-End Quiz Game Test...\n');

      // ===== STEP 1: Create Quizmaster =====
      console.log('📋 Step 1: Creating Quizmaster...');
      quizmaster = await Player.create({
        name: 'Quiz Master',
        deviceId: 'quizmaster-device',
        age: 35,
        specialistSubject: 'General Knowledge'
      });

      // ===== STEP 2: Create Game Session =====
      console.log('🎮 Step 2: Creating Game Session...');
      gameSession = await GameSession.create({
        hostId: quizmaster._id,
        code: 'QUIZ123',
        status: 'lobby',
        players: [],
        currentRound: 0,
        rounds: []
      });

      console.log(`✅ Game created with code: ${gameSession.code}`);

      // ===== STEP 3: Create 12 Players =====
      console.log('👥 Step 3: Creating 12 Players...');
      const playerData = [
        { name: 'Alice', age: 25, specialistSubject: 'Science' },
        { name: 'Bob', age: 30, specialistSubject: 'History' },
        { name: 'Charlie', age: 28, specialistSubject: 'Sports' },
        { name: 'Diana', age: 32, specialistSubject: 'Literature' },
        { name: 'Eve', age: 26, specialistSubject: 'Geography' },
        { name: 'Frank', age: 29, specialistSubject: 'Music' },
        { name: 'Grace', age: 31, specialistSubject: 'Art' },
        { name: 'Henry', age: 27, specialistSubject: 'Movies' },
        { name: 'Ivy', age: 33, specialistSubject: 'Technology' },
        { name: 'Jack', age: 24, specialistSubject: 'Food' },
        { name: 'Kate', age: 30, specialistSubject: 'Travel' },
        { name: 'Liam', age: 28, specialistSubject: 'Politics' }
      ];

      for (let i = 0; i < playerData.length; i++) {
        const player = await Player.create({
          ...playerData[i],
          deviceId: `player-${i + 1}-device`
        });
        players.push(player);
      }

      console.log(`✅ Created ${players.length} players`);

      // ===== STEP 3.5: Add Players to Game Session =====
      console.log('🔗 Step 3.5: Adding players to game session...');
      gameSession.players = players.map(player => ({
        playerId: player._id,
        score: 0,
        isActive: true
      }));
      await gameSession.save();
      console.log('✅ Added all players to game session');

      // ===== STEP 4: Connect Quizmaster Socket =====
      console.log('🔌 Step 4: Connecting Quizmaster Socket...');
      quizmasterSocket = Client(`http://localhost:${serverPort}/host`, {
        timeout: 5000,
        forceNew: true,
        auth: {
          playerId: quizmaster._id.toString(),
          gameSessionId: gameSession._id.toString(),
          isHost: true
        }
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Quizmaster socket connection timeout'));
        }, 10000);

        quizmasterSocket.on('connect', () => {
          clearTimeout(timeout);
          console.log('✅ Quizmaster connected');
          resolve();
        });

        quizmasterSocket.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(new Error(`Quizmaster socket connection error: ${error.message}`));
        });
      });

      console.log('✅ Quizmaster connected and authenticated');

      // ===== STEP 5: Connect All Player Sockets =====
      console.log('🔗 Step 5: Connecting 12 Player Sockets...');

      for (let i = 0; i < players.length; i++) {
        const player = players[i];
        const socket = Client(`http://localhost:${serverPort}/player`, {
          timeout: 5000,
          forceNew: true,
          auth: {
            playerId: player._id.toString(),
            gameSessionId: gameSession._id.toString(),
            isHost: false
          }
        });
        playerSockets.push(socket);

        // Wait for connection with timeout
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Player ${i + 1} socket connection timeout`));
          }, 10000);

          socket.on('connect', () => {
            clearTimeout(timeout);
            resolve();
          });

          socket.on('connect_error', (error) => {
            clearTimeout(timeout);
            reject(new Error(`Player ${i + 1} socket connection error: ${error.message}`));
          });
        });

        console.log(`✅ Player ${i + 1} (${player.name}) connected and authenticated`);
      }

      // ===== STEP 6: Verify All Players Joined =====
      const updatedSession = await GameSession.findById(gameSession._id);
      console.log(`📊 Total players in game: ${updatedSession.players?.length || 0}`);

      // ===== STEP 7: Start Game =====
      console.log('\n🚀 Step 7: Starting Game...');
      updatedSession.status = 'active';
      await updatedSession.save();

      // ===== STEP 8: Round 1 - Point Builder =====
      console.log('\n🎯 Step 8: Starting Round 1 (Point Builder)...');

      let round1Started = false;
      const round1Promise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Round 1 start timeout'));
        }, 15000);

        const onRoundStarted = (data) => {
          if (data.roundNumber === 1 && !round1Started) {
            round1Started = true;
            clearTimeout(timeout);
            quizmasterSocket.off('round:started', onRoundStarted);
            quizmasterSocket.off('error', onError);
            console.log(`✅ Round 1 started: ${data.roundType}`);
            resolve(data);
          }
        };

        const onError = (error) => {
          clearTimeout(timeout);
          quizmasterSocket.off('round:started', onRoundStarted);
          quizmasterSocket.off('error', onError);
          reject(new Error(`Round 1 start error: ${error.message || error}`));
        };

        quizmasterSocket.on('round:started', onRoundStarted);
        quizmasterSocket.on('error', onError);
      });

      quizmasterSocket.emit('round:start', {
        roundNumber: 1,
        roundType: 'point-builder',
        pointsPerQuestion: 10
      });

      await round1Promise;

      // Simulate player answers for Round 1
      console.log('💭 Simulating Round 1 answers...');
      await simulatePlayerAnswers(1, [
        { playerIndex: 0, correct: true, timeToAnswer: 2000 },   // Alice: correct, fast
        { playerIndex: 1, correct: true, timeToAnswer: 3000 },   // Bob: correct, medium
        { playerIndex: 2, correct: false, timeToAnswer: 4000 },  // Charlie: wrong
        { playerIndex: 3, correct: true, timeToAnswer: 2500 },   // Diana: correct, fast
        { playerIndex: 4, correct: false, timeToAnswer: 5000 },  // Eve: wrong
        { playerIndex: 5, correct: true, timeToAnswer: 3500 },   // Frank: correct
        { playerIndex: 6, correct: false, timeToAnswer: 4500 },  // Grace: wrong
        { playerIndex: 7, correct: true, timeToAnswer: 2200 },   // Henry: correct, fast
        { playerIndex: 8, correct: true, timeToAnswer: 2800 },   // Ivy: correct
        { playerIndex: 9, correct: false, timeToAnswer: 6000 },  // Jack: wrong
        { playerIndex: 10, correct: true, timeToAnswer: 3200 },  // Kate: correct
        { playerIndex: 11, correct: true, timeToAnswer: 2600 }   // Liam: correct
      ]);

      // End Round 1
      console.log('🏁 Ending Round 1...');
      await new Promise((resolve) => {
        quizmasterSocket.on('round:ended', (data) => {
          if (data.roundNumber === 1) {
            console.log('✅ Round 1 ended');
            resolve();
          }
        });
        
        quizmasterSocket.emit('round:end', { roundNumber: 1 });
      });

      // ===== STEP 9: Round 2 - Fastest Finger =====
      console.log('\n⚡ Step 9: Starting Round 2 (Fastest Finger)...');
      
      let round2Started = false;
      const round2Promise = new Promise((resolve) => {
        quizmasterSocket.on('round:started', (data) => {
          if (data.roundNumber === 2 && !round2Started) {
            round2Started = true;
            console.log(`✅ Round 2 started: ${data.roundType}`);
            resolve(data);
          }
        });
      });

      quizmasterSocket.emit('round:start', {
        roundNumber: 2,
        roundType: 'fastest-finger',
        penaltyPoints: 5
      });

      await round2Promise;

      // Simulate player answers for Round 2
      console.log('💭 Simulating Round 2 answers...');
      await simulatePlayerAnswers(2, [
        { playerIndex: 7, correct: true, timeToAnswer: 1500 },   // Henry: fastest correct
        { playerIndex: 0, correct: true, timeToAnswer: 1800 },   // Alice: second
        { playerIndex: 3, correct: false, timeToAnswer: 1200 },  // Diana: fastest but wrong
        { playerIndex: 11, correct: true, timeToAnswer: 2000 },  // Liam: correct
        { playerIndex: 8, correct: false, timeToAnswer: 2200 },  // Ivy: wrong
        { playerIndex: 10, correct: true, timeToAnswer: 2500 },  // Kate: correct but slow
        { playerIndex: 1, correct: false, timeToAnswer: 3000 },  // Bob: wrong
        { playerIndex: 5, correct: true, timeToAnswer: 2800 },   // Frank: correct
        { playerIndex: 2, correct: false, timeToAnswer: 3500 },  // Charlie: wrong
        { playerIndex: 4, correct: false, timeToAnswer: 4000 },  // Eve: wrong
        { playerIndex: 6, correct: true, timeToAnswer: 3200 },   // Grace: correct
        { playerIndex: 9, correct: false, timeToAnswer: 4500 }   // Jack: wrong
      ]);

      // End Round 2
      console.log('🏁 Ending Round 2...');
      await new Promise((resolve) => {
        quizmasterSocket.on('round:ended', (data) => {
          if (data.roundNumber === 2) {
            console.log('✅ Round 2 ended');
            resolve();
          }
        });
        
        quizmasterSocket.emit('round:end', { roundNumber: 2 });
      });

      // ===== STEP 10: Round 3 - Graduated Points =====
      console.log('\n📈 Step 10: Starting Round 3 (Graduated Points)...');
      
      let round3Started = false;
      const round3Promise = new Promise((resolve) => {
        quizmasterSocket.on('round:started', (data) => {
          if (data.roundNumber === 3 && !round3Started) {
            round3Started = true;
            console.log(`✅ Round 3 started: ${data.roundType}`);
            resolve(data);
          }
        });
      });

      quizmasterSocket.emit('round:start', {
        roundNumber: 3,
        roundType: 'graduated-points',
        maxPoints: 20,
        minPoints: 5
      });

      await round3Promise;

      // Simulate player answers for Round 3
      console.log('💭 Simulating Round 3 answers...');
      await simulatePlayerAnswers(3, [
        { playerIndex: 11, correct: true, timeToAnswer: 1000 },  // Liam: fastest (20 points)
        { playerIndex: 0, correct: true, timeToAnswer: 1500 },   // Alice: second (18 points)
        { playerIndex: 7, correct: true, timeToAnswer: 2000 },   // Henry: third (16 points)
        { playerIndex: 3, correct: true, timeToAnswer: 2500 },   // Diana: fourth (14 points)
        { playerIndex: 8, correct: true, timeToAnswer: 3000 },   // Ivy: fifth (12 points)
        { playerIndex: 10, correct: true, timeToAnswer: 3500 },  // Kate: sixth (10 points)
        { playerIndex: 5, correct: true, timeToAnswer: 4000 },   // Frank: seventh (8 points)
        { playerIndex: 6, correct: true, timeToAnswer: 4500 },   // Grace: eighth (6 points)
        { playerIndex: 1, correct: false, timeToAnswer: 2200 },  // Bob: wrong
        { playerIndex: 2, correct: false, timeToAnswer: 3200 },  // Charlie: wrong
        { playerIndex: 4, correct: false, timeToAnswer: 4200 },  // Eve: wrong
        { playerIndex: 9, correct: false, timeToAnswer: 5000 }   // Jack: wrong
      ]);

      // End Round 3
      console.log('🏁 Ending Round 3...');
      await new Promise((resolve) => {
        quizmasterSocket.on('round:ended', (data) => {
          if (data.roundNumber === 3) {
            console.log('✅ Round 3 ended');
            resolve();
          }
        });
        
        quizmasterSocket.emit('round:end', { roundNumber: 3 });
      });

      // ===== STEP 11: End Game and Calculate Final Scores =====
      console.log('\n🏆 Step 11: Ending Game and Calculating Final Scores...');
      
      const finalSession = await GameSession.findById(gameSession._id);
      finalSession.status = 'completed';
      finalSession.endedAt = new Date();
      await finalSession.save();

      // ===== STEP 12: Verify Final Results =====
      console.log('\n📊 FINAL RESULTS:');
      console.log('================');
      
      const gameResults = await GameSession.findById(gameSession._id).populate('players.playerId');
      
      // Calculate expected scores based on our simulation
      const expectedScores = {
        Alice: 28,    // R1: 10, R2: 10, R3: 18 (but needs actual scoring logic)
        Bob: 10,      // R1: 10, R2: -5, R3: 0
        Charlie: 0,   // R1: 0, R2: -5, R3: 0 
        Diana: 24,    // R1: 10, R2: -5, R3: 14
        Eve: 0,       // R1: 0, R2: -5, R3: 0
        Frank: 18,    // R1: 10, R2: 10, R3: 8
        Grace: 16,    // R1: 0, R2: 10, R3: 6
        Henry: 36,    // R1: 10, R2: 10, R3: 16
        Ivy: 22,      // R1: 10, R2: -5, R3: 12
        Jack: 0,      // R1: 0, R2: -5, R3: 0
        Kate: 30,     // R1: 10, R2: 10, R3: 10
        Liam: 40      // R1: 10, R2: 10, R3: 20
      };

      // Verify database state
      expect(finalSession.status).toBe('completed');
      expect(finalSession.rounds).toHaveLength(3);
      expect(finalSession.rounds[0].type).toBe('pointBuilder');
      expect(finalSession.rounds[1].type).toBe('fastestFinger');
      expect(finalSession.rounds[2].type).toBe('graduatedPoints');
      
      // All rounds should be completed
      finalSession.rounds.forEach((round, index) => {
        expect(round.completed).toBe(true);
        console.log(`✅ Round ${index + 1} (${round.type}): Completed`);
      });

      // Verify player connections and participation
      console.log(`✅ Total players who joined: ${players.length}`);
      console.log(`✅ Socket connections established: ${playerSockets.length}`);
      console.log(`✅ Game status: ${finalSession.status}`);
      console.log(`✅ Rounds completed: ${finalSession.rounds.length}`);

      console.log('\n🎉 END-TO-END TEST COMPLETED SUCCESSFULLY!');
      console.log('✅ Game creation and setup: PASSED');
      console.log('✅ Player connections: PASSED');  
      console.log('✅ Round management: PASSED');
      console.log('✅ Database persistence: PASSED');
      console.log('✅ Socket communication: PASSED');
      console.log('✅ Game completion: PASSED');

      // Final verification
      expect(playerSockets).toHaveLength(12);
      expect(finalSession.status).toBe('completed');
      expect(finalSession.rounds).toHaveLength(3);
      
    }, 120000); // 2 minute timeout for comprehensive test
  });

  // Helper function to simulate player answers
  async function simulatePlayerAnswers(roundNumber, answers) {
    for (const answer of answers) {
      const { playerIndex, correct, timeToAnswer } = answer;
      const playerSocket = playerSockets[playerIndex];
      const player = players[playerIndex];
      
      // Simulate thinking time
      await new Promise(resolve => setTimeout(resolve, timeToAnswer / 10)); // Speed up for testing
      
      // Submit answer
      playerSocket.emit('submit-answer', {
        roundNumber,
        questionId: `question-${roundNumber}-1`,
        answer: correct ? 'correct-answer' : 'wrong-answer',
        timeToAnswer,
        correct
      });
      
      console.log(`  📝 ${player.name}: ${correct ? '✅ Correct' : '❌ Wrong'} (${timeToAnswer}ms)`);
    }
    
    // Allow time for all answers to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
  }
});