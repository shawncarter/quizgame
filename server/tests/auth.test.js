/**
 * Authentication Service Tests
 * Tests for JWT token generation, verification, and game code generation
 */
const { 
  generateGameMasterToken, 
  generatePlayerToken, 
  verifyToken,
  generateGameCode
} = require('../services/tokenService');

describe('Authentication Service', () => {
  const mockPlayerId = '507f1f77bcf86cd799439011';
  const mockGameSessionId = '507f1f77bcf86cd799439022';

  describe('Token Generation', () => {
    test('should generate game master token', () => {
      const token = generateGameMasterToken(mockPlayerId, mockGameSessionId);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    test('should generate player token', () => {
      const token = generatePlayerToken(mockPlayerId, mockGameSessionId);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    test('should generate different tokens for different users', () => {
      const token1 = generateGameMasterToken(mockPlayerId, mockGameSessionId);
      const token2 = generateGameMasterToken('different-player-id', mockGameSessionId);
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('Token Verification', () => {
    test('should verify valid game master token', () => {
      const token = generateGameMasterToken(mockPlayerId, mockGameSessionId);
      const decoded = verifyToken(token);
      
      expect(decoded).toBeDefined();
      expect(decoded.id).toBe(mockPlayerId);
      expect(decoded.sessionId).toBe(mockGameSessionId);
      expect(decoded.role).toBe('game_master');
    });

    test('should verify valid player token', () => {
      const token = generatePlayerToken(mockPlayerId, mockGameSessionId);
      const decoded = verifyToken(token);
      
      expect(decoded).toBeDefined();
      expect(decoded.id).toBe(mockPlayerId);
      expect(decoded.sessionId).toBe(mockGameSessionId);
      expect(decoded.role).toBe('player');
    });

    test('should return null for invalid token', () => {
      const invalidToken = 'invalid.token.here';
      const decoded = verifyToken(invalidToken);
      
      expect(decoded).toBeNull();
    });

    test('should return null for malformed token', () => {
      const malformedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const decoded = verifyToken(malformedToken);
      
      expect(decoded).toBeNull();
    });
  });

  describe('Game Code Generation', () => {
    test('should generate 6-character game code', () => {
      const code = generateGameCode();
      
      expect(code).toBeDefined();
      expect(typeof code).toBe('string');
      expect(code.length).toBe(6);
    });

    test('should generate unique codes', () => {
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        codes.add(generateGameCode());
      }
      
      // Should have generated many unique codes
      expect(codes.size).toBeGreaterThan(90);
    });

    test('should only contain valid characters', () => {
      const validChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const code = generateGameCode();
      
      for (let char of code) {
        expect(validChars.includes(char)).toBe(true);
      }
    });

    test('should not contain confusing characters', () => {
      const confusingChars = ['0', '1', 'I', 'O'];
      const code = generateGameCode();
      
      for (let char of confusingChars) {
        expect(code.includes(char)).toBe(false);
      }
    });
  });
});