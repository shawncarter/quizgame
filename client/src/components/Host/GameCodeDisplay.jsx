import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './GameCodeDisplay.css';

/**
 * Game Code Display Component
 * Shows the game code and provides options to share it
 */
const GameCodeDisplay = ({ gameCode, gameId, gameSession }) => {
  const navigate = useNavigate();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(gameCode);
    alert('Game code copied to clipboard!');
  };

  const handleGoToGameMaster = () => {
    console.log('Navigating to game master console with game ID:', gameId);

    // Store game ID in localStorage for recovery
    localStorage.setItem('lastCreatedGameId', gameId);
    localStorage.setItem('lastCreatedGameCode', gameCode || '');

    // Create a simplified version of the game session to pass in state
    const gameSessionForState = gameSession || {
      _id: gameId,
      code: gameCode,
      status: 'created'
    };

    // Navigate to the game master page with state
    navigate(`/game-master/${gameId}`, {
      state: {
        gameSession: gameSessionForState,
        fromHostPage: true
      }
    });
  };

  return (
    <div className="game-code-display">
      <h2>Game Created!</h2>
      <p className="instructions">Share this code with players to join your game:</p>

      <div className="code-container">
        <div className="game-code">{gameCode}</div>
        <button className="copy-button" onClick={copyToClipboard}>
          Copy
        </button>
      </div>

      <div className="qr-link">
        <Link to={`/qr-code/${gameId}`} className="qr-button">
          Show QR Code
        </Link>
      </div>

      <div className="actions">
        <button onClick={handleGoToGameMaster} className="start-button">
          Go to Game Master Console
        </button>
      </div>

      <p className="player-count">
        <span className="count">0</span> players have joined
      </p>
    </div>
  );
};

export default GameCodeDisplay;
