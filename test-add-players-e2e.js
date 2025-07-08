#!/usr/bin/env node

/**
 * End-to-End Test Script for Add Test Players Functionality
 * This script tests the complete flow and identifies where issues occur
 */

const axios = require('axios');
const { io } = require('socket.io-client');

// Configuration
const API_BASE_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';
const AUTH_TOKEN = 'device_vk73372ktty9e2y03otg';

// Test state
let testResults = {
  playerAuth: false,
  gameCreation: false,
  socketConnection: false,
  testPlayersAPI: false,
  socketEvents: false,
  gameDataRetrieval: false
};

let gameId = null;
let gameCode = null;
let hostSocket = null;

// Utility functions
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function logError(message, error) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR: ${message}`);
  if (error) {
    console.error(error.message || error);
    if (error.response?.data) {
      console.error('Response data:', error.response.data);
    }
  }
}

function logSuccess(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ✅ SUCCESS: ${message}`);
}

function logFailure(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ❌ FAILURE: ${message}`);
}

// Test functions
async function testPlayerAuthentication() {
  log('=== TESTING PLAYER AUTHENTICATION ===');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/players`, {
      headers: { 'x-auth-token': AUTH_TOKEN }
    });
    
    if (response.data && response.data.length > 0) {
      logSuccess('Player authentication successful');
      log('Player data:', response.data[0]);
      testResults.playerAuth = true;
      return response.data[0];
    } else {
      logFailure('No player data returned');
      return null;
    }
  } catch (error) {
    logError('Player authentication failed', error);
    return null;
  }
}

async function testGameCreation() {
  log('=== TESTING GAME CREATION ===');
  
  try {
    const gameData = {
      maxPlayers: 10,
      publicGame: true
    };
    
    const response = await axios.post(`${API_BASE_URL}/games`, gameData, {
      headers: { 
        'x-auth-token': AUTH_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data?.success && response.data?.data) {
      gameId = response.data.data.id;
      gameCode = response.data.data.code;
      logSuccess(`Game created successfully - ID: ${gameId}, Code: ${gameCode}`);
      log('Game data:', response.data.data);
      testResults.gameCreation = true;
      return response.data.data;
    } else {
      logFailure('Game creation failed - invalid response');
      return null;
    }
  } catch (error) {
    logError('Game creation failed', error);
    return null;
  }
}

async function testSocketConnection(playerId) {
  log('=== TESTING SOCKET CONNECTION ===');
  
  return new Promise((resolve) => {
    try {
      hostSocket = io(`${SOCKET_URL}/host`, {
        auth: {
          playerId: playerId,
          gameSessionId: gameId,
          isHost: true
        },
        transports: ['websocket', 'polling'],
        timeout: 10000
      });

      let connectionTimeout = setTimeout(() => {
        logFailure('Socket connection timeout after 10 seconds');
        resolve(false);
      }, 10000);

      hostSocket.on('connect', () => {
        clearTimeout(connectionTimeout);
        logSuccess(`Socket connected successfully - ID: ${hostSocket.id}`);
        testResults.socketConnection = true;
        
        // Set up event listeners for test
        hostSocket.on('playersUpdated', (data) => {
          logSuccess('Received playersUpdated event');
          log('Players updated data:', data);
          testResults.socketEvents = true;
        });
        
        hostSocket.on('gameUpdated', (data) => {
          logSuccess('Received gameUpdated event');
          log('Game updated data:', data);
          testResults.socketEvents = true;
        });
        
        resolve(true);
      });

      hostSocket.on('connect_error', (error) => {
        clearTimeout(connectionTimeout);
        logError('Socket connection error', error);
        resolve(false);
      });

      hostSocket.on('error', (error) => {
        logError('Socket error', error);
      });

    } catch (error) {
      logError('Socket connection setup failed', error);
      resolve(false);
    }
  });
}

async function testAddTestPlayers() {
  log('=== TESTING ADD TEST PLAYERS API ===');
  
  try {
    const response = await axios.post(`${API_BASE_URL}/games/${gameId}/test-players`, 
      { count: 2 }, 
      {
        headers: { 
          'x-auth-token': AUTH_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data?.success && response.data?.data) {
      logSuccess('Test players added successfully');
      log('Added players:', response.data.data.addedPlayers);
      log('Total players now:', response.data.data.totalPlayers);
      testResults.testPlayersAPI = true;
      return response.data.data;
    } else {
      logFailure('Add test players failed - invalid response');
      return null;
    }
  } catch (error) {
    logError('Add test players failed', error);
    return null;
  }
}

async function testGameDataRetrieval() {
  log('=== TESTING GAME DATA RETRIEVAL AFTER ADDING PLAYERS ===');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/games/${gameId}`, {
      headers: { 'x-auth-token': AUTH_TOKEN }
    });
    
    if (response.data?.success && response.data?.data) {
      const gameData = response.data.data;
      logSuccess('Game data retrieved successfully');
      log('Current players in game:', gameData.players);
      log('Player count:', gameData.players?.length || 0);
      
      if (gameData.players && gameData.players.length >= 2) {
        logSuccess('Test players are present in game data');
        testResults.gameDataRetrieval = true;
      } else {
        logFailure('Test players are missing from game data');
      }
      
      return gameData;
    } else {
      logFailure('Game data retrieval failed - invalid response');
      return null;
    }
  } catch (error) {
    logError('Game data retrieval failed', error);
    return null;
  }
}

async function waitForSocketEvents() {
  log('=== WAITING FOR SOCKET EVENTS ===');
  
  return new Promise((resolve) => {
    let eventTimeout = setTimeout(() => {
      if (testResults.socketEvents) {
        logSuccess('Socket events received within timeout');
      } else {
        logFailure('No socket events received within 5 seconds');
      }
      resolve(testResults.socketEvents);
    }, 5000);
  });
}

function cleanup() {
  log('=== CLEANUP ===');
  if (hostSocket) {
    hostSocket.disconnect();
    log('Socket disconnected');
  }
}

function printTestResults() {
  log('=== TEST RESULTS SUMMARY ===');
  
  Object.entries(testResults).forEach(([test, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test}`);
  });
  
  const totalTests = Object.keys(testResults).length;
  const passedTests = Object.values(testResults).filter(Boolean).length;
  
  log(`\nOverall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    logSuccess('All tests passed! The functionality should be working.');
  } else {
    logFailure('Some tests failed. Check the logs above for details.');
  }
}

// Main test execution
async function runTests() {
  log('🚀 Starting End-to-End Test for Add Test Players Functionality');
  
  try {
    // Test 1: Player Authentication
    const player = await testPlayerAuthentication();
    if (!player) {
      logFailure('Cannot proceed without player authentication');
      return;
    }
    
    // Test 2: Game Creation
    const game = await testGameCreation();
    if (!game) {
      logFailure('Cannot proceed without game creation');
      return;
    }
    
    // Test 3: Socket Connection
    const socketConnected = await testSocketConnection(player.id);
    if (!socketConnected) {
      log('⚠️  Socket connection failed, but continuing with API tests...');
    }
    
    // Test 4: Add Test Players
    const addResult = await testAddTestPlayers();
    if (!addResult) {
      logFailure('Cannot proceed without successful test player addition');
      return;
    }
    
    // Test 5: Wait for Socket Events (if socket connected)
    if (socketConnected) {
      await waitForSocketEvents();
    }
    
    // Test 6: Verify Game Data
    await testGameDataRetrieval();
    
  } catch (error) {
    logError('Test execution failed', error);
  } finally {
    cleanup();
    printTestResults();
  }
}

// Run the tests
runTests().catch(console.error);
