/**
 * Manual test file for authentication middleware
 * Run with: node tests/auth.test.js
 */
const { 
  generateGameMasterToken, 
  generatePlayerToken, 
  verifyToken,
  generateGameCode
} = require('../services/tokenService');

// Mock user/game data
const playerId = '507f1f77bcf86cd799439011';
const gameSessionId = '507f1f77bcf86cd799439022';

// Test game master token generation and verification
console.log('\n--- Testing Game Master Token ---');
const gameMasterToken = generateGameMasterToken(playerId, gameSessionId);
console.log('Game Master Token:', gameMasterToken);

const decodedGameMaster = verifyToken(gameMasterToken);
console.log('Decoded Game Master Token:', decodedGameMaster);

// Test player token generation and verification
console.log('\n--- Testing Player Token ---');
const playerToken = generatePlayerToken(playerId, gameSessionId);
console.log('Player Token:', playerToken);

const decodedPlayer = verifyToken(playerToken);
console.log('Decoded Player Token:', decodedPlayer);

// Test invalid token verification
console.log('\n--- Testing Invalid Token ---');
const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
const decodedInvalid = verifyToken(invalidToken);
console.log('Decoded Invalid Token:', decodedInvalid);

// Test game code generation
console.log('\n--- Testing Game Code Generation ---');
for (let i = 0; i < 5; i++) {
  console.log(`Game Code ${i+1}:`, generateGameCode());
}

console.log('\nTests completed.');
