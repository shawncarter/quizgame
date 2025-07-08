#!/usr/bin/env node

/**
 * Test script to verify that players can join games after they have started
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:5000';
const API_URL = `${SERVER_URL}/api`;

// Test player data
const testPlayer1 = {
  name: 'TestPlayer1',
  age: 25,
  specialistSubject: 'Science',
  deviceId: `test_device_${Date.now()}_1`
};

const testPlayer2 = {
  name: 'TestPlayer2',
  age: 30,
  specialistSubject: 'History',
  deviceId: `test_device_${Date.now()}_2`
};

const testPlayer3 = {
  name: 'TestPlayer3',
  age: 28,
  specialistSubject: 'Geography',
  deviceId: `test_device_${Date.now()}_3`
};

async function createPlayer(playerData) {
  try {
    const response = await axios.post(`${API_URL}/players`, playerData);
    console.log(`✓ Created player: ${playerData.name} (ID: ${response.data.data?.id || response.data.id})`);
    console.log('   Response structure:', JSON.stringify(response.data, null, 2));
    return response.data.data || response.data;
  } catch (error) {
    console.error(`✗ Failed to create player ${playerData.name}:`, error.response?.data?.error || error.message);
    if (error.response?.data) {
      console.error('   Error response:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

async function createGame(hostPlayer) {
  try {
    const gameData = {
      settings: {
        maxPlayers: 10,
        publicGame: true,
        allowJoinAfterStart: true,
        questionPoolSize: 10
      }
    };

    const response = await axios.post(`${API_URL}/games`, gameData, {
      headers: {
        'x-auth-token': hostPlayer.deviceId
      }
    });
    
    console.log(`✓ Created game: ${response.data.data.code} (ID: ${response.data.data.id})`);
    return response.data.data;
  } catch (error) {
    console.error('✗ Failed to create game:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function joinGame(gameId, player) {
  try {
    const response = await axios.post(`${API_URL}/games/${gameId}/join`, {}, {
      headers: {
        'x-auth-token': player.deviceId
      }
    });
    
    console.log(`✓ Player ${player.name} joined game successfully`);
    return response.data.data;
  } catch (error) {
    console.error(`✗ Player ${player.name} failed to join game:`, error.response?.data?.error || error.message);
    throw error;
  }
}

async function startGame(gameId, hostPlayer) {
  try {
    const response = await axios.put(`${API_URL}/games/${gameId}/start`, {}, {
      headers: {
        'x-auth-token': hostPlayer.deviceId
      }
    });
    
    console.log(`✓ Game started successfully (Status: ${response.data.data.status})`);
    return response.data.data;
  } catch (error) {
    console.error('✗ Failed to start game:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function getGameByCode(gameCode) {
  try {
    const response = await axios.get(`${API_URL}/games/code/${gameCode}`);
    return response.data.data;
  } catch (error) {
    console.error('✗ Failed to get game by code:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function runTest() {
  console.log('🧪 Testing: Join Game After Start\n');

  try {
    // Step 1: Create test players
    console.log('1. Creating test players...');
    const player1 = await createPlayer(testPlayer1);
    const player2 = await createPlayer(testPlayer2);
    const player3 = await createPlayer(testPlayer3);
    console.log('');

    // Step 2: Create a game with player1 as host
    console.log('2. Creating game...');
    const game = await createGame(player1);
    console.log('');

    // Step 3: Player1 joins their own game (as host)
    console.log('3. Host joining game...');
    await joinGame(game.id, player1);
    console.log('');

    // Step 4: Player2 joins the game to meet minimum requirement
    console.log('4. Second player joining game...');
    await joinGame(game.id, player2);
    console.log('');

    // Step 4.5: Check game state before starting
    console.log('4.5. Checking game state before starting...');
    const gameBeforeStart = await getGameByCode(game.code);
    console.log(`   Player Count: ${gameBeforeStart.playerCount}/${gameBeforeStart.maxPlayers}`);
    console.log('');

    // Step 5: Start the game
    console.log('5. Starting game...');
    const startedGame = await startGame(game.id, player1);
    console.log('');

    // Step 6: Check game settings
    console.log('6. Checking game settings...');
    const gameInfo = await getGameByCode(game.code);
    console.log(`   Game Status: ${gameInfo.status}`);
    console.log(`   Allow Join After Start: ${gameInfo.allowJoinAfterStart}`);
    console.log(`   Player Count: ${gameInfo.playerCount}/${gameInfo.maxPlayers}`);
    console.log('');

    // Step 7: Try to join the started game with player3
    console.log('7. Testing join after start...');
    if (gameInfo.allowJoinAfterStart) {
      await joinGame(game.id, player3);
      console.log('✅ SUCCESS: Player was able to join the game after it started!');
    } else {
      console.log('❌ FAIL: Game does not allow joining after start');
    }

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  }
}

// Run the test
runTest()
  .then(() => {
    console.log('\n🎉 Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  });
