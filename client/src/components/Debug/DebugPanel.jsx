import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { usePlayer } from '../../context/PlayerContext';
import './DebugPanel.css';

/**
 * Debug Panel Component
 * Displays debug information about the current game state
 */
const DebugPanel = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { 
    gameSession, 
    players, 
    gameStatus, 
    error, 
    isConnected,
    currentRound,
    currentQuestion
  } = useGame();
  
  const { player, isLoggedIn } = usePlayer();

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // Format data for display
  const formatData = (data) => {
    if (data === null || data === undefined) return 'null';
    if (typeof data === 'object') {
      try {
        return JSON.stringify(data, null, 2);
      } catch (e) {
        return 'Error formatting object';
      }
    }
    return String(data);
  };

  return (
    <div className={`debug-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="debug-header" onClick={toggleExpand}>
        <h3>Debug Panel {isExpanded ? '▼' : '▶'}</h3>
        {error && <span className="debug-error-indicator">⚠️</span>}
      </div>
      
      {isExpanded && (
        <div className="debug-content">
          <div className="debug-section">
            <h4>Connection Status</h4>
            <p>Socket Connected: <span className={isConnected ? 'status-ok' : 'status-error'}>{isConnected ? 'Yes' : 'No'}</span></p>
            <p>Game Status: <span className={`status-${gameStatus}`}>{gameStatus}</span></p>
            {error && <p className="debug-error">Error: {error}</p>}
          </div>
          
          <div className="debug-section">
            <h4>Player Info</h4>
            <p>Logged In: <span className={isLoggedIn ? 'status-ok' : 'status-error'}>{isLoggedIn ? 'Yes' : 'No'}</span></p>
            <p>Player ID: {player?._id || 'Not logged in'}</p>
            <p>Player Name: {player?.name || 'Not logged in'}</p>
          </div>
          
          <div className="debug-section">
            <h4>Game Info</h4>
            <p>Game ID: {gameSession?._id || 'No game'}</p>
            <p>Game Code: {gameSession?.code || 'No game'}</p>
            <p>Players: {players?.length || 0}</p>
            <p>Current Round: {currentRound?.roundNumber || 'None'}</p>
            <p>Current Question: {currentQuestion?.questionNumber || 'None'}</p>
          </div>
          
          <div className="debug-section">
            <h4>Local Storage</h4>
            <p>Last Created Game ID: {localStorage.getItem('lastCreatedGameId') || 'None'}</p>
            <p>Last Created Game Code: {localStorage.getItem('lastCreatedGameCode') || 'None'}</p>
            <p>Player Token: {localStorage.getItem('playerToken') ? 'Exists' : 'None'}</p>
          </div>
          
          <div className="debug-actions">
            <button onClick={() => console.log('Game Session:', gameSession)}>Log Game Session</button>
            <button onClick={() => console.log('Players:', players)}>Log Players</button>
            <button onClick={() => console.log('Player:', player)}>Log Player</button>
            <button onClick={() => localStorage.clear()}>Clear Local Storage</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebugPanel;
