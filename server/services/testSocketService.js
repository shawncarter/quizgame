/**
 * Test Socket Service
 * Provides functionality for Socket.io testing
 */

/**
 * Handle test namespace connections
 * @param {Socket} socket - Socket.io socket instance
 */
function handleTestConnection(socket) {
  console.log(`Test client connected: ${socket.id}`);
  
  // Respond to the client with a welcome message
  socket.emit('test:welcome', { 
    message: 'Connected to test namespace',
    timestamp: Date.now()
  });
  
  // Handle test messages
  socket.on('test:message', (data) => {
    console.log(`Test message received: ${JSON.stringify(data)}`);
    
    // Echo the message back to sender
    socket.emit('test:message', {
      message: `Echo: ${data.message}`,
      timestamp: Date.now(),
      sender: 'server'
    });
    
    // Broadcast to all other sockets in the namespace
    socket.broadcast.emit('test:message', {
      message: data.message,
      timestamp: Date.now(),
      sender: `client-${socket.id.substring(0, 4)}`
    });
  });
  
  // Handle test join
  socket.on('test:join', (data) => {
    console.log(`Test join received: ${JSON.stringify(data)}`);
    
    // Broadcast to all other sockets in the namespace
    socket.broadcast.emit('test:message', {
      message: `A new client has joined the test namespace`,
      timestamp: Date.now(),
      sender: 'server'
    });
  });
  
  // Handle test commands
  socket.on('test:command', (data) => {
    console.log(`Test command received: ${JSON.stringify(data)}`);
    
    const { command } = data;
    
    // Execute test commands
    switch (command) {
      case 'ping':
        socket.emit('test:message', {
          message: 'Pong!',
          timestamp: Date.now(),
          sender: 'server'
        });
        break;
        
      case 'stats':
        socket.emit('test:stats', {
          connections: socket.nsp.sockets.size,
          uptime: process.uptime(),
          timestamp: Date.now(),
          memory: process.memoryUsage()
        });
        break;
        
      default:
        socket.emit('test:message', {
          message: `Unknown command: ${command}`,
          timestamp: Date.now(),
          sender: 'server'
        });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Test client disconnected: ${socket.id}`);
    
    // Notify other clients
    socket.broadcast.emit('test:message', {
      message: 'A client has disconnected from the test namespace',
      timestamp: Date.now(),
      sender: 'server'
    });
  });
}

// Export the handler
module.exports = {
  handleTestConnection
};
