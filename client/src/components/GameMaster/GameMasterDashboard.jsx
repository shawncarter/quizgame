import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import './GameMasterDashboard.css';

/**
 * Game Master Dashboard
 * Main container for the Game Master interface
 */
const GameMasterDashboard = () => {
  const { id: gameId } = useParams();
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
    disconnectFromGame,
    socket
  } = useGame();
  
  // Connect to the game session on mount
  useEffect(() => {
    if (gameId) {
      connectToGame(gameId);
    }
    
    // Disconnect when component unmounts
    return () => {
      disconnectFromGame();
    };
  }, [gameId, connectToGame, disconnectFromGame]);
  
  // Handle navigation back to home if no game ID
  useEffect(() => {
    if (!gameId) {
      navigate('/');
    }
  }, [gameId, navigate]);
  
  // Show loading state
  if (!gameSession && gameStatus === 'loading') {
    return (
      <div className="game-master-loading">
        <h2>Loading Game Session...</h2>
        <div className="loading-spinner"></div>
      </div>
    );
  }
  
  // Show error state
  if (error) {
    return (
      <div className="game-master-error">
        <h2>Error</h2>
        <p>{error}</p>
        <button 
          onClick={() => navigate('/')}
          className="error-button"
        >
          Back to Home
        </button>
      </div>
    );
  }
  
  // Show disconnected state
  if (!isConnected && !isReconnecting && gameSession) {
    return (
      <div className="game-master-disconnected">
        <h2>Disconnected from Game Server</h2>
        <p>The connection to the game server has been lost.</p>
        <button 
          onClick={() => connectToGame(gameId)}
          className="reconnect-button"
        >
          Reconnect
        </button>
        <button 
          onClick={() => navigate('/')}
          className="back-button"
        >
          Back to Home
        </button>
      </div>
    );
  }
  
  // Show reconnecting state
  if (isReconnecting) {
    return (
      <div className="game-master-reconnecting">
        <h2>Reconnecting to Game Server...</h2>
        <div className="loading-spinner"></div>
      </div>
    );
  }
  
  // Show no game session state
  if (!gameSession) {
    return (
      <div className="game-master-no-session">
        <h2>No Game Session Found</h2>
        <p>The requested game session could not be found.</p>
        <button 
          onClick={() => navigate('/')}
          className="back-button"
        >
          Back to Home
        </button>
      </div>
    );
  }
  
  // Determine which round interface to show based on the current round type
  const renderRoundInterface = () => {
    if (!currentRound) return null;
    
    // Check if it's a Point Builder round
    if (currentRound.type === 'pointBuilder' || currentRound.type === 'point-builder') {
      return (
        <PointBuilderRound 
          gameSession={gameSession}
          currentRound={currentRound}
          socket={socket}
        />
      );
    }
    
    // Check if it's a Graduated Points round
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
      <>
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
      </>
    );
  };
  
  return (
    <div className="game-master-dashboard">
      <div className="dashboard-header">
        <GameSessionInfo gameSession={gameSession} />
      </div>
      
      <div className="dashboard-main">
        <div className="dashboard-left">
          <GameConfigPanel 
            gameSession={gameSession} 
            gameStatus={gameStatus}
          />
          <RoundSelectionPanel 
            gameSession={gameSession}
            currentRound={currentRound}
            gameStatus={gameStatus}
          />
          <PlayerManagementPanel 
            players={players}
            gameStatus={gameStatus}
          />
        </div>
        
        <div className="dashboard-center">
          {renderRoundInterface()}
        </div>
        
        <div className="dashboard-right">
          <PlayerStatusPanel 
            players={players}
            currentQuestion={currentQuestion}
            gameStatus={gameStatus}
          />
        </div>
      </div>
    </div>
  );
};

export default GameMasterDashboard;
