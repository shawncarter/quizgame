#!/usr/bin/env node

/**
 * Test script to simulate the exact browser join flow
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:5000';
const API_URL = `${SERVER_URL}/api`;

// Simulate the browser flow
async function testBrowserJoinFlow() {
  console.log('🧪 Testing: Browser Join Flow\n');

  try {
    // Step 1: Create a test player (simulating registration)
    console.log('1. Creating test player (simulating registration)...');
    const playerData = {
      name: 'BrowserTestPlayer',
      age: 25,
      specialistSubject: 'Testing',
      deviceId: `browser_test_${Date.now()}`
    };

    const playerResponse = await axios.post(`${API_URL}/players`, playerData);
    const player = playerResponse.data.data || playerResponse.data;
    console.log(`✓ Created player: ${player.name} (ID: ${player.id})`);
    console.log(`   Device ID: ${player.deviceId}`);
    console.log('');

    // Step 2: Get an existing game by code (simulating entering game code)
    console.log('2. Getting game by code (simulating entering game code)...');
    const gameCode = 'U7GDEG'; // From the logs
    
    const gameResponse = await axios.get(`${API_URL}/games/code/${gameCode}`, {
      headers: {
        'x-auth-token': player.deviceId,
        'Content-Type': 'application/json'
      }
    });
    
    const gameData = gameResponse.data.data;
    console.log(`✓ Found game: ${gameCode} (ID: ${gameData.id})`);
    console.log(`   Status: ${gameData.status}`);
    console.log(`   Allow Join After Start: ${gameData.allowJoinAfterStart}`);
    console.log(`   Player Count: ${gameData.playerCount}/${gameData.maxPlayers}`);
    console.log('');

    // Step 3: Check if game is joinable (simulating client-side validation)
    console.log('3. Checking if game is joinable...');
    if (gameData.status !== 'created' && gameData.status !== 'lobby') {
      if (gameData.status === 'active' && gameData.allowJoinAfterStart) {
        console.log('✓ Game is active but allows joining after start');
      } else {
        console.log('❌ Game cannot be joined at this time');
        console.log(`   Status: ${gameData.status}, Allow Join After Start: ${gameData.allowJoinAfterStart}`);
        return;
      }
    } else {
      console.log('✓ Game is in joinable state');
    }
    console.log('');

    // Step 4: Try to join the game (simulating the HTTP API call)
    console.log('4. Attempting to join game via HTTP API...');
    try {
      const joinResponse = await axios.post(`${API_URL}/games/${gameData.id}/join`, {}, {
        headers: {
          'x-auth-token': player.deviceId,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ SUCCESS: HTTP API join successful!');
      console.log('   Response:', JSON.stringify(joinResponse.data, null, 2));
    } catch (joinError) {
      console.log('❌ FAILED: HTTP API join failed');
      console.log('   Error status:', joinError.response?.status);
      console.log('   Error message:', joinError.response?.data?.error || joinError.message);
      console.log('   Full error response:', JSON.stringify(joinError.response?.data, null, 2));
      
      // Don't throw here, let's continue to see what the issue is
    }
    console.log('');

    // Step 5: Verify the player was added to the game
    console.log('5. Verifying player was added to game...');
    const updatedGameResponse = await axios.get(`${API_URL}/games/code/${gameCode}`, {
      headers: {
        'x-auth-token': player.deviceId,
        'Content-Type': 'application/json'
      }
    });
    
    const updatedGameData = updatedGameResponse.data.data;
    console.log(`   Updated Player Count: ${updatedGameData.playerCount}/${updatedGameData.maxPlayers}`);
    
    if (updatedGameData.playerCount > gameData.playerCount) {
      console.log('✅ SUCCESS: Player count increased, join was successful!');
    } else {
      console.log('⚠️  WARNING: Player count did not increase');
    }

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run the test
testBrowserJoinFlow()
  .then(() => {
    console.log('\n🎉 Test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  });
