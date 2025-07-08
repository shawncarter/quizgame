# QuizGame - Interactive Multiplayer Quiz Platform

QuizGame is a real-time multiplayer quiz application that allows a Game Master to host interactive quiz sessions for groups of players in the same physical space.

## Socket Connectivity Testing Guidelines

We've added comprehensive socket connectivity tests to ensure the real-time functionality remains reliable. Here's how to work with these tests:

### Server-side Socket Tests

The server includes several test suites for socket connectivity:

1. **Basic Connectivity Tests** (`socket-connectivity.test.js`)
   - Tests basic socket connections, authentication, and namespace functionality
   - Covers reconnection scenarios and room functionality
   - Includes socket recovery and state preservation

2. **Socket Error Handling** (`socketErrorHandler.test.js`)
   - Tests error handling middleware for socket events
   - Ensures errors are properly formatted and sent to clients

3. **Socket Monitoring** (`socketMonitoring.test.js`)
   - Tests the connection monitoring capabilities
   - Verifies metrics collection and health status reporting

4. **Socket Rate Limiting** (`socketRateLimiter.test.js`)
   - Tests protection against rapid-fire socket events
   - Verifies that rate limits are properly enforced

5. **Socket Recovery** (`socketRecovery.test.js`)
   - Tests the ability to recover game state after disconnections
   - Verifies player state is preserved during network issues

### Client-side Socket Tests

The client-side socket service also has tests:

1. **SocketService Tests** (`socketService.test.js`)
   - Tests connection and reconnection logic
   - Tests namespace management
   - Tests state recovery functionality
   - Verifies event callback registration

### Running the Tests

To run the socket tests:

```bash
# Run all server socket tests
cd server
npm test -- tests/socket*.test.js

# Run a specific test suite
npm test -- tests/socket-connectivity.test.js

# Run client tests (in the client directory)
cd ../client
npm test -- src/services/__tests__/socketService.test.js
```

### Writing New Socket Tests

When writing new socket tests:

1. **Use Mocks**: Always mock external dependencies (database, etc.)
2. **Clean Up**: Disconnect sockets and restore mocks after tests
3. **Test Edge Cases**: Include tests for error conditions and reconnections
4. **Namespace Tests**: Test all relevant namespaces (game, player, host)
5. **Isolated Tests**: Make sure tests don't interfere with each other

### Common Socket Test Issues

- **Timeout Errors**: May indicate reconnection issues or missing events
- **"X not a function"**: Usually means a mock is not properly set up
- **"Socket not connected"**: Test is trying to use a socket that's been disconnected

Remember to run the socket tests before and after making changes to socket-related functionality to ensure you haven't broken existing functionality.

## Features

- Game Master creates quiz sessions and generates QR codes for players to join
- Players can join via QR code scan
- Multiple round types with different scoring mechanisms
- AI-generated questions based on player age and interests
- Real-time buzzer system
- Leaderboard and scoring
- Player profiles with specialist subjects

## Technology Stack

- **Frontend**: React, Socket.io client
- **Backend**: Node.js, Express
- **Real-time Communication**: Socket.io
- **Database**: PostgreSQL with Sequelize ORM
- **AI Integration**: Anthropic API

## Project Structure

```
quizgame/
├── client/                # React frontend application
│   ├── public/
│   └── src/
│       ├── components/    # Reusable UI components
│       ├── pages/         # Page components
│       └── services/      # API and socket services
├── server/                # Node.js backend
│   ├── controllers/       # Request handlers
│   ├── models/            # Database models
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   └── config/            # Configuration
└── tasks/                 # Task Master project tasks
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   # Install server dependencies
   cd server
   npm install

   # Install client dependencies
   cd ../client
   npm install
   ```

3. Set up environment variables:
   - Create a `.env` file in the server directory based on `.env.example`
   - Create a `.env` file in the client directory based on `.env.example`

4. Set up PostgreSQL database:
   - Create a PostgreSQL database named `quizgame`
   - The tables will be automatically created when you start the server with `DB_SYNC=true`

5. Start the development servers:
   ```
   # Start the backend server
   cd server
   npm run dev

   # In another terminal, start the frontend
   cd client
   npm run dev
   ```

## License

[Apache](LICENSE)
