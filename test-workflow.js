#!/bin/bash

# QuizGame Workflow Test Script
# Tests the complete game workflow from creation to gameplay

API_URL="http://localhost:5000/api"
DEVICE_ID="device_vk73372ktty9e2y03otg"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function to make authenticated requests
api_request() {
    local method=$1
    local endpoint=$2
    local data=$3

    if [ -n "$data" ]; then
        curl -s -X "$method" "$API_URL$endpoint" \
            -H "x-auth-token: $DEVICE_ID" \
            -H "Content-Type: application/json" \
            -d "$data"
    else
        curl -s -X "$method" "$API_URL$endpoint" \
            -H "x-auth-token: $DEVICE_ID" \
            -H "Content-Type: application/json"
    fi
}

// Test functions
const testPlayerExists = async () => {
  console.log('🔍 Testing player authentication...');
  try {
    const players = await apiRequest('GET', '/players');
    const player = players.find(p => p.deviceId === DEVICE_ID);
    if (player) {
      console.log(`✅ Player found: ${player.name} (ID: ${player.id})`);
      return player;
    } else {
      throw new Error('Player not found');
    }
  } catch (error) {
    console.log('❌ Player authentication failed');
    throw error;
  }
};

const testGameCreation = async () => {
  console.log('🎮 Testing game creation...');
  const gameSettings = {
    maxPlayers: 10,
    publicGame: true,
    allowJoinAfterStart: true,
    questionPoolSize: 10
  };
  
  const result = await apiRequest('POST', '/games', gameSettings);
  const game = result.data;
  console.log(`✅ Game created: ID ${game.id}, Code: ${game.code}`);
  return game;
};

const testAddTestPlayers = async (gameId) => {
  console.log('👥 Testing test players addition...');
  const result = await apiRequest('POST', `/games/${gameId}/test-players`, { count: 3 });
  console.log(`✅ Added ${result.data.addedPlayers.length} test players`);
  result.data.addedPlayers.forEach(player => {
    console.log(`   - ${player.name} (${player.specialistSubject})`);
  });
  return result.data.gameSession;
};

const testQRCodeGeneration = async (gameId) => {
  console.log('📱 Testing QR code generation...');
  try {
    const result = await apiRequest('GET', `/qr-codes/game-session/${gameId}`);
    console.log('✅ QR code generated successfully');
    return result.qrCode;
  } catch (error) {
    console.log('❌ QR code generation failed');
    throw error;
  }
};

const testGameRetrieval = async (gameId) => {
  console.log('📋 Testing game retrieval...');
  const result = await apiRequest('GET', `/games/${gameId}`);
  const game = result.data;
  console.log(`✅ Game retrieved: ${game.players.length} players, Status: ${game.status}`);
  return game;
};

const testGameWorkflow = async () => {
  console.log('🚀 Starting QuizGame Workflow Test\n');
  
  try {
    // Test 1: Player Authentication
    const player = await testPlayerExists();
    
    // Test 2: Game Creation
    const game = await testGameCreation();
    
    // Test 3: Add Test Players
    const updatedGame = await testAddTestPlayers(game.id);
    
    // Test 4: QR Code Generation
    await testQRCodeGeneration(game.id);
    
    // Test 5: Game Retrieval
    const finalGame = await testGameRetrieval(game.id);
    
    // Summary
    console.log('\n🎉 All tests passed!');
    console.log('📊 Test Summary:');
    console.log(`   - Player: ${player.name}`);
    console.log(`   - Game ID: ${finalGame.id}`);
    console.log(`   - Game Code: ${finalGame.code}`);
    console.log(`   - Players: ${finalGame.players.length}`);
    console.log(`   - Status: ${finalGame.status}`);
    console.log(`   - QR Code URL: http://localhost:5173/qr-code/${finalGame.id}`);
    console.log(`   - Join URL: http://localhost:5173/join/${finalGame.code}`);
    
    return {
      success: true,
      player,
      game: finalGame
    };
    
  } catch (error) {
    console.log('\n❌ Workflow test failed');
    console.error('Error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

// Run the test if this script is executed directly
if (require.main === module) {
  testGameWorkflow()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { testGameWorkflow };
