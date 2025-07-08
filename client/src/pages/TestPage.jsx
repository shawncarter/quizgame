import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';

/**
 * Test Page
 * A simple page for testing functionality
 */
const TestPage = () => {
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
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h1>Test Page</h1>
      <p>This page is for testing functionality</p>
      
      <div style={{ 
        backgroundColor: '#f5f5f5', 
        padding: '20px', 
        borderRadius: '8px',
        marginTop: '20px'
      }}>
        <h2>Test Game Creator</h2>
        
        {error && (
          <div style={{ 
            backgroundColor: '#ffebee', 
            color: '#d32f2f', 
            padding: '10px', 
            borderRadius: '4px',
            marginBottom: '15px'
          }}>
            <p>{error}</p>
          </div>
        )}
        
        {!gameData ? (
          <button 
            style={{
              backgroundColor: '#673ab7',
              color: 'white',
              border: 'none',
              padding: '10px 15px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
            onClick={createTestGame}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Test Game'}
          </button>
        ) : (
          <div style={{
            backgroundColor: '#e8f5e9',
            border: '1px solid #c8e6c9',
            borderRadius: '4px',
            padding: '10px',
            marginTop: '15px'
          }}>
            <p><strong>Game Created!</strong></p>
            <p>Game ID: {gameData.gameId}</p>
            <p>Game Code: <strong>{gameData.gameCode}</strong></p>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <button 
                style={{
                  backgroundColor: '#4caf50',
                  color: 'white',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
                onClick={joinTestGame}
              >
                Join as Player
              </button>
              
              <button 
                style={{
                  backgroundColor: '#2196f3',
                  color: 'white',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
                onClick={goToGameMaster}
              >
                Go to Game Master
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <button 
          style={{
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            padding: '10px 15px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
          onClick={() => navigate('/')}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
};

export default TestPage;
