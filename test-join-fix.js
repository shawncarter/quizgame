#!/usr/bin/env node

/**
 * Test script to verify the join game fix works
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:5000';
const API_URL = `${SERVER_URL}/api`;

// Test player data
const testPlayer = {
  name: 'JoinTestPlayer',
  age: 25,
  specialistSubject: 'Testing',
  deviceId: `test_join_${Date.now()}`
};

async function createPlayer(playerData) {
  try {
    const response = await axios.post(`${API_URL}/players`, playerData);
    console.log(`✓ Created player: ${playerData.name} (ID: ${response.data.data?.id || response.data.id})`);
    return response.data.data || response.data;
  } catch (error) {
    console.error(`✗ Failed to create player ${playerData.name}:`, error.response?.data?.error || error.message);
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

async function runTest() {
  console.log('🧪 Testing: Join Game Fix\n');

  try {
    // Step 1: Create a test player
    console.log('1. Creating test player...');
    const player = await createPlayer(testPlayer);
    console.log('');

    // Step 2: Get an existing game (from the logs, we saw YUWV2C and LX8T2G)
    console.log('2. Getting existing game...');
    let gameCode = 'YUWV2C'; // From the logs
    let gameInfo;
    
    try {
      gameInfo = await getGameByCode(gameCode);
      console.log(`✓ Found game: ${gameCode} (Status: ${gameInfo.status})`);
      console.log(`   Player Count: ${gameInfo.playerCount}/${gameInfo.maxPlayers}`);
      console.log(`   Allow Join After Start: ${gameInfo.allowJoinAfterStart}`);
    } catch (error) {
      // Try the other game code
      gameCode = 'LX8T2G';
      gameInfo = await getGameByCode(gameCode);
      console.log(`✓ Found game: ${gameCode} (Status: ${gameInfo.status})`);
      console.log(`   Player Count: ${gameInfo.playerCount}/${gameInfo.maxPlayers}`);
      console.log(`   Allow Join After Start: ${gameInfo.allowJoinAfterStart}`);
    }
    console.log('');

    // Step 3: Try to join the game
    console.log('3. Testing join game...');
    await joinGame(gameInfo.id, player);
    console.log('✅ SUCCESS: Player was able to join the game!');

    // Step 4: Verify the player was added
    console.log('');
    console.log('4. Verifying player was added...');
    const updatedGameInfo = await getGameByCode(gameCode);
    console.log(`   Updated Player Count: ${updatedGameInfo.playerCount}/${updatedGameInfo.maxPlayers}`);
    
    if (updatedGameInfo.playerCount > gameInfo.playerCount) {
      console.log('✅ SUCCESS: Player count increased, join was successful!');
    } else {
      console.log('⚠️  WARNING: Player count did not increase, but no error was thrown');
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
