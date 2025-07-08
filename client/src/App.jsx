import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { SocketProvider } from './context/SocketContext'
import { PlayerProvider } from './context/PlayerContext'
import { GameProvider } from './context/GameContext'
import './App.css'

// Import actual components
import Home from './pages/Home'
import ScanPage from './pages/ScanPage'
import GameQRCodePage from './pages/GameQRCodePage'
import PlayerRegistrationPage from './pages/PlayerRegistrationPage'
import PlayerProfilePage from './pages/PlayerProfilePage'
import PlayerProfileEditPage from './pages/PlayerProfileEditPage'
import PlayerLobbyPage from './pages/PlayerLobbyPage'
import PlayerGamePage from './pages/PlayerGamePage'
import HostGamePage from './pages/HostGamePage'
import GameMasterPage from './pages/GameMasterPage'
import JoinGame from './pages/JoinGame'
import TestPage from './pages/TestPage'

// Placeholder components - these will be created in future tasks
const Lobby = () => <div>Game Lobby</div>

function App() {
  return (
    <Router>
      <PlayerProvider>
        <SocketProvider>
          <GameProvider>
            <div className="app-container">
              <header>
                <h1>QuizGame</h1>
              </header>

              <main>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/host" element={<HostGamePage />} />
                  <Route path="/join" element={<JoinGame />} />
                  <Route path="/join/:gameCode" element={<JoinGame />} />
                  <Route path="/scan" element={<ScanPage />} />
                  <Route path="/lobby/:gameId" element={<Lobby />} />
                  <Route path="/game-master/:gameId" element={<GameMasterPage />} />
                  <Route path="/game/:gameId" element={<PlayerGamePage />} />
                  <Route path="/qr-code/:id" element={<GameQRCodePage />} />

                  {/* Player-related routes */}
                  <Route path="/register" element={<PlayerRegistrationPage />} />
                  <Route path="/profile" element={<PlayerProfilePage />} />
                  <Route path="/profile/edit" element={<PlayerProfileEditPage />} />
                  <Route path="/profile/:id" element={<PlayerProfilePage />} />
                  <Route path="/players" element={<PlayerLobbyPage />} />
                  <Route path="/test" element={<TestPage />} />
                </Routes>
              </main>

              <footer>
                <p>&copy; 2025 QuizGame</p>
              </footer>
            </div>
          </GameProvider>
        </SocketProvider>
      </PlayerProvider>
    </Router>
  )
}

export default App
