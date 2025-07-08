#!/usr/bin/env node

/**
 * Test script to verify the ID fix works
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:5000';
const API_URL = `${SERVER_URL}/api`;

async function testIdFix() {
  console.log('🧪 Testing: ID Fix (id vs _id)\n');

  try {
    // Step 1: Create a test player
    console.log('1. Creating test player...');
    const playerData = {
      name: 'IdTestPlayer',
      age: 25,
      specialistSubject: 'Testing',
      deviceId: `id_test_${Date.now()}`
    };

    const playerResponse = await axios.post(`${API_URL}/players`, playerData);
    const player = playerResponse.data.data || playerResponse.data;
    console.log(`✓ Created player: ${player.name}`);
    console.log(`   Player ID: ${player.id} (should be a number)`);
    console.log(`   Player _id: ${player._id} (should be undefined)`);
    console.log(`   Device ID: ${player.deviceId}`);
    
    // Verify the player object structure
    if (player.id && typeof player.id === 'number') {
      console.log('✅ SUCCESS: Player uses "id" field (correct for Sequelize/PostgreSQL)');
    } else {
      console.log('❌ FAILED: Player does not have proper "id" field');
    }
    
    if (player._id) {
      console.log('⚠️  WARNING: Player has "_id" field (MongoDB convention, unexpected)');
    } else {
      console.log('✅ SUCCESS: Player does not have "_id" field (correct for Sequelize/PostgreSQL)');
    }
    console.log('');

    // Step 2: Try to join a game using the correct ID
    console.log('2. Testing join with correct ID...');
    const gameCode = 'ZCKTJB'; // From the logs
    
    const gameResponse = await axios.get(`${API_URL}/games/code/${gameCode}`, {
      headers: {
        'x-auth-token': player.deviceId,
        'Content-Type': 'application/json'
      }
    });
    
    const gameData = gameResponse.data.data;
    console.log(`✓ Found game: ${gameCode} (ID: ${gameData.id})`);
    console.log('');

    // Step 3: Try to join the game
    console.log('3. Attempting to join game...');
    try {
      const joinResponse = await axios.post(`${API_URL}/games/${gameData.id}/join`, {}, {
        headers: {
          'x-auth-token': player.deviceId,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ SUCCESS: Join successful with correct ID!');
      console.log('   Response:', JSON.stringify(joinResponse.data, null, 2));
    } catch (joinError) {
      console.log('❌ FAILED: Join failed');
      console.log('   Error status:', joinError.response?.status);
      console.log('   Error message:', joinError.response?.data?.error || joinError.message);
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
testIdFix()
  .then(() => {
    console.log('\n🎉 ID fix test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  });
