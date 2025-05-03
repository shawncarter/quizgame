/**
 * Socket Error Handler Tests
 */
const { 
  withErrorHandling, 
  handleSocketError, 
  createSocketError 
} = require('../services/socketErrorHandler');

// Mock socket
const createMockSocket = () => ({
  id: 'socket-123',
  playerId: 'player-123',
  gameSessionId: 'game-123',
  gameSessionCode: 'TEST123',
  emit: jest.fn()
});

describe('Socket Error Handler', () => {
  let mockSocket;
  let originalConsoleError;
  
  beforeEach(() => {
    // Create a fresh mock socket for each test
    mockSocket = createMockSocket();
    
    // Mock console.error to prevent noise in test output
    originalConsoleError = console.error;
    console.error = jest.fn();
  });
  
  afterEach(() => {
    // Restore console.error
    console.error = originalConsoleError;
  });
  
  test('createSocketError should create an error with code and details', () => {
    const error = createSocketError('Test error', 'TEST_ERROR', { foo: 'bar' });
    
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.details).toEqual({ foo: 'bar' });
  });
  
  test('handleSocketError should emit error to socket', () => {
    const error = new Error('Test error');
    error.code = 'TEST_ERROR';
    
    handleSocketError(mockSocket, error);
    
    expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
      code: 'TEST_ERROR',
      message: 'Test error',
      timestamp: expect.any(Number)
    }));
    
    expect(console.error).toHaveBeenCalled();
  });
  
  test('withErrorHandling should call handler if no error occurs', async () => {
    const mockHandler = jest.fn();
    const wrappedHandler = withErrorHandling(mockHandler);
    
    await wrappedHandler(mockSocket, { foo: 'bar' });
    
    expect(mockHandler).toHaveBeenCalledWith(mockSocket, { foo: 'bar' });
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });
  
  test('withErrorHandling should handle thrown errors', async () => {
    const mockHandler = jest.fn().mockImplementation(() => {
      throw new Error('Test error');
    });
    
    const wrappedHandler = withErrorHandling(mockHandler);
    
    await wrappedHandler(mockSocket, { foo: 'bar' });
    
    expect(mockHandler).toHaveBeenCalledWith(mockSocket, { foo: 'bar' });
    expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
      code: 'INTERNAL_ERROR',
      message: 'Test error',
      timestamp: expect.any(Number)
    }));
  });
  
  test('withErrorHandling should handle async errors', async () => {
    const mockHandler = jest.fn().mockImplementation(async () => {
      throw new Error('Async error');
    });
    
    const wrappedHandler = withErrorHandling(mockHandler);
    
    await wrappedHandler(mockSocket, { foo: 'bar' });
    
    expect(mockHandler).toHaveBeenCalledWith(mockSocket, { foo: 'bar' });
    expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
      code: 'INTERNAL_ERROR',
      message: 'Async error',
      timestamp: expect.any(Number)
    }));
  });
  
  test('withErrorHandling should preserve error codes', async () => {
    const mockHandler = jest.fn().mockImplementation(() => {
      const error = new Error('Test error with code');
      error.code = 'CUSTOM_ERROR';
      throw error;
    });
    
    const wrappedHandler = withErrorHandling(mockHandler);
    
    await wrappedHandler(mockSocket, { foo: 'bar' });
    
    expect(mockHandler).toHaveBeenCalledWith(mockSocket, { foo: 'bar' });
    expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
      code: 'CUSTOM_ERROR',
      message: 'Test error with code',
      timestamp: expect.any(Number)
    }));
  });
});
