import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../../context/PlayerContext';
import './TestGameCreator.css';

/**
 * Test Game Creator Component
 * A debug component for creating test games and joining them
 */
const TestGameCreator = () => {
  const navigate = useNavigate();
  const { player } = usePlayer();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gameData, setGameData] = useState(null);
  
  // Create a test game
  const createTestGame = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': player?.id || ''
        },
        body: JSON.stringify({
          maxPlayers: 10,
          publicGame: true,
          allowJoinAfterStart: true,
          questionPoolSize: 10
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create test game');
      }
      
      setGameData({
        gameId: data.data.id,
        gameCode: data.data.code,
        hostId: data.data.hostId,
        joinUrl: `/join/${data.data.code}`
      });
    } catch (err) {
      console.error('Error creating test game:', err);
      setError(err.message || 'Failed to create test game');
    } finally {
      setLoading(false);
    }
  };
  
  // Join the created test game
  const joinTestGame = () => {
    if (!gameData) return;
    
    navigate(`/join/${gameData.gameCode}`);
  };
  
  // Go to game master console
  const goToGameMaster = () => {
    if (!gameData) return;
    
    navigate(`/game-master/${gameData.gameId}`, {
      state: {
        gameSession: {
          _id: gameData.gameId,
          code: gameData.gameCode,
          status: 'lobby'
        },
        fromHostPage: true
      }
    });
  };
  
  return (
    <div className="test-game-creator">
      <h3>Test Game Creator</h3>
      
      {error && (
        <div className="test-game-error">
          <p>{error}</p>
        </div>
      )}
      
      {!gameData ? (
        <button 
          className="create-test-game-btn"
          onClick={createTestGame}
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create Test Game'}
        </button>
      ) : (
        <div className="test-game-info">
          <p><strong>Game Created!</strong></p>
          <p>Game ID: {gameData.gameId}</p>
          <p>Game Code: <strong>{gameData.gameCode}</strong></p>
          
          <div className="test-game-actions">
            <button 
              className="join-test-game-btn"
              onClick={joinTestGame}
            >
              Join as Player
            </button>
            
            <button 
              className="game-master-btn"
              onClick={goToGameMaster}
            >
              Go to Game Master
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestGameCreator;
