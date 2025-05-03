# QuizGame - Interactive Multiplayer Quiz Platform

QuizGame is a real-time multiplayer quiz application that allows a Game Master to host interactive quiz sessions for groups of players in the same physical space.

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
- **Database**: MongoDB
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
- MongoDB
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
   - Create a `.env` file in the server directory
   - Create a `.env` file in the client directory

4. Start the development servers:
   ```
   # Start the backend server
   cd server
   npm run dev

   # In another terminal, start the frontend
   cd client
   npm run dev
   ```

## License

[MIT](LICENSE)
