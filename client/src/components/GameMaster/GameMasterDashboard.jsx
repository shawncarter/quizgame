import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import GameSessionInfo from './GameSessionInfo';
import GameConfigPanel from './GameConfigPanel';
import RoundSelectionPanel from './RoundSelectionPanel';
import PlayerManagementPanel from './PlayerManagementPanel';
import QuestionDisplayPanel from './QuestionDisplayPanel';
import GameControlPanel from './GameControlPanel';
import PlayerStatusPanel from './PlayerStatusPanel';
import PointBuilderRound from './PointBuilderRound';
import GraduatedPointsRound from './GraduatedPointsRound';
import SidebarNav from './SidebarNav';
import './GameMasterDashboard.css';

/**
 * Game Master Dashboard
 * Main container for the Game Master interface
 */
const GameMasterDashboard = () => {
  // Get the game ID from URL parameters as a fallback
  const params = useParams();
  const urlGameId = params.gameId;

  // State for active section - moved to top level to fix React Hook linting error
  const [activeSection, setActiveSection] = useState('game-settings');

  const navigate = useNavigate();
  const {
    gameSession,
    players,
    currentRound,
    currentQuestion,
    gameStatus,
    error,
    isConnected,
    isReconnecting,
    connectToGame,
    socket
  } = useGame();

  // We don't need to connect to the game session here as it's already handled in GameMasterPage
  // This prevents duplicate connection attempts
  useEffect(() => {
    console.log('GameMasterDashboard mounted with gameSession:', gameSession ? gameSession.id : 'none');
    console.log('URL game ID:', urlGameId);
    console.log('Game session already connected in parent component:', !!gameSession);

    // Don't disconnect when component unmounts - let the parent component handle this
    // This prevents the game session from being reset when the component remounts
    return () => {
      console.log('GameMasterDashboard unmounting, but NOT disconnecting from game');
    };
  }, [gameSession, urlGameId]);

  // Add detailed debugging information
  console.log('GameMasterDashboard - Detailed State:');
  console.log('- gameSession:', gameSession);
  console.log('- players:', players);
  console.log('- gameStatus:', gameStatus);
  console.log('- isConnected:', isConnected);
  console.log('- error:', error);
  console.log('- urlGameId:', urlGameId);

  // Handle loading, error, and connection states
  if (error) {
    return (
      <div className="game-master-error">
        <h2>Error Connecting to Game</h2>
        <p>{error}</p>
        <button onClick={() => connectToGame(urlGameId)}>Retry Connection</button>
        <button onClick={() => navigate('/')}>Return to Home</button>
        <div className="debug-info">
          <p>Game ID: {urlGameId}</p>
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!isConnected && isReconnecting) {
    return (
      <div className="game-master-reconnecting">
        <h2>Reconnecting...</h2>
        <p>Attempting to reestablish connection to the game session.</p>
        <button onClick={() => navigate('/')}>Cancel and Return to Home</button>
        <div className="debug-info">
          <p>Game ID: {urlGameId}</p>
          <p>Status: Reconnecting</p>
        </div>
      </div>
    );
  }

  if (!isConnected && !isReconnecting) {
    return (
      <div className="game-master-disconnected">
        <h2>Disconnected from Game</h2>
        <p>The connection to the game session has been lost.</p>
        <button
          onClick={() => {
            console.log('Attempting to connect to game with ID:', urlGameId);
            if (urlGameId) {
              connectToGame(urlGameId);
            } else {
              // Try to get the game ID from localStorage
              const lastCreatedGameId = localStorage.getItem('lastCreatedGameId');
              if (lastCreatedGameId) {
                console.log('Using game ID from localStorage:', lastCreatedGameId);
                connectToGame(lastCreatedGameId);
              } else {
                alert('No game ID found. Please create a new game.');
                navigate('/host');
              }
            }
          }}
          className="reconnect-button"
        >
          Reconnect
        </button>
        <button onClick={() => navigate('/')} className="back-button">Return to Home</button>
        <div className="debug-info">
          <p>Game ID: {urlGameId || 'Not found in URL'}</p>
          <p>Last Created Game ID: {localStorage.getItem('lastCreatedGameId') || 'None'}</p>
          <p>Status: Disconnected</p>
        </div>
      </div>
    );
  }

  if (!gameSession) {
    return (
      <div className="game-master-loading">
        <h2>Loading Game Session...</h2>
        <p>Please wait while we connect to your game.</p>
        <div className="debug-info">
          <p>Game ID: {urlGameId}</p>
          <p>Status: Loading</p>
          <p>Game Status: {gameStatus}</p>
        </div>
      </div>
    );
  }

  // Determine which round interface to show based on the current round type
  const renderRoundInterface = () => {
    if (!currentRound) {
      return (
        <div className="no-round-selected">
          <h3>No Round Selected</h3>
          <p>Select or create a round from the Rounds tab to begin.</p>
        </div>
      );
    }

    // Render the appropriate round interface based on type
    if (currentRound.type === 'pointBuilder' || currentRound.type === 'point-builder') {
      return (
        <PointBuilderRound
          gameSession={gameSession}
          currentRound={currentRound}
          socket={socket}
        />
      );
    }

    if (currentRound.type === 'graduated-points') {
      return (
        <GraduatedPointsRound
          gameSession={gameSession}
          currentRound={currentRound}
          socket={socket}
        />
      );
    }

    // Default round interface
    return (
      <div className="standard-round-interface">
        <QuestionDisplayPanel
          currentQuestion={currentQuestion}
          currentRound={currentRound}
          gameStatus={gameStatus}
        />
        <GameControlPanel
          gameSession={gameSession}
          currentRound={currentRound}
          currentQuestion={currentQuestion}
          gameStatus={gameStatus}
        />
      </div>
    );
  };

  // Navigation items
  const navItems = [
    {
      id: 'game-settings',
      label: 'Game Settings',
      icon: '⚙️'
    },
    {
      id: 'rounds',
      label: 'Rounds',
      icon: '🔄'
    },
    {
      id: 'players',
      label: 'Players',
      icon: '👥'
    }
  ];

  // Render content based on active section
  const renderContent = () => {
    switch (activeSection) {
      case 'game-settings':
        return (
          <div className="content-section">
            <h2 className="section-title">Game Settings</h2>
            <div className="content-grid">
              <div className="content-panel">
                <GameConfigPanel
                  gameSession={gameSession}
                  gameStatus={gameStatus}
                />
              </div>
            </div>
          </div>
        );
      case 'rounds':
        return (
          <div className="content-section">
            <h2 className="section-title">Rounds</h2>
            <div className="content-grid">
              <div className="content-panel">
                <RoundSelectionPanel
                  gameSession={gameSession}
                  currentRound={currentRound}
                  gameStatus={gameStatus}
                />
              </div>
            </div>

            {currentRound && (
              <div className="current-round-interface">
                <h3 className="subsection-title">Current Round: {currentRound.name || 'Unnamed Round'}</h3>
                {renderRoundInterface()}
              </div>
            )}
          </div>
        );
      case 'players':
        return (
          <div className="content-section">
            <h2 className="section-title">Players</h2>
            <div className="content-grid">
              <div className="content-panel">
                <PlayerManagementPanel
                  players={players}
                  gameStatus={gameStatus}
                  gameSession={gameSession}
                />
              </div>
            </div>

            <div className="player-status-section">
              <h3 className="subsection-title">Player Status</h3>
              <div className="content-grid">
                <div className="content-panel">
                  <PlayerStatusPanel
                    players={players}
                    currentQuestion={currentQuestion}
                    gameStatus={gameStatus}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // We're using the navItems defined earlier

  return (
    <div className="game-master-dashboard">
      <div className="dashboard-header">
        <GameSessionInfo gameSession={gameSession} />
      </div>

      <div className="dashboard-main">
        <div className="dashboard-sidebar">
          <SidebarNav
            items={navItems}
            activeItem={activeSection}
            onItemClick={setActiveSection}
          />
        </div>

        <div className="dashboard-content">
          {renderContent()}
        </div>
      </div>
      
      {/* Always show game controls at the bottom of the dashboard */}
      <div className="dashboard-footer">
        <GameControlPanel
          gameSession={gameSession}
          currentRound={currentRound}
          currentQuestion={currentQuestion}
          gameStatus={gameStatus}
        />
      </div>
    </div>
  );
};

export default GameMasterDashboard;
