import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import PlayerGameInterface from '../components/Player/PlayerGameInterface';
import './PlayerGamePage.css';

/**
 * Player game page component
 * Displays the player game interface for a specific game session
 */
const PlayerGamePage = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { player } = usePlayer();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gameSession, setGameSession] = useState(null);
  
  // Get game session information from location state or fetch it
  useEffect(() => {
    if (!player || !player._id) {
      setError('You must be registered to join a game');
      setLoading(false);
      return;
    }
    
    if (!gameId) {
      setError('Invalid game session');
      setLoading(false);
      return;
    }
    
    // If game session info is passed via location state, use it
    if (location.state && location.state.gameSession) {
      setGameSession(location.state.gameSession);
      setLoading(false);
    } else {
      // Otherwise fetch game session info
      fetchGameSession();
    }
  }, [player, gameId, location.state]);
  
  // Fetch game session information
  const fetchGameSession = async () => {
    try {
      // In a real app, you would fetch game session details from the server
      // For now, we'll just use the gameId as the session ID
      setGameSession({
        id: gameId,
        name: 'Quiz Game Session',
        hostId: 'host-123',
        status: 'active'
      });
      setLoading(false);
    } catch (err) {
      console.error('Error fetching game session:', err);
      setError('Failed to load game session');
      setLoading(false);
    }
  };
  
  // Handle exit game
  const handleExitGame = () => {
    navigate('/');
  };
  
  if (loading) {
    return (
      <div className="player-game-page loading">
        <div className="loading-spinner"></div>
        <p>Joining game session...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="player-game-page error">
        <h2>Error</h2>
        <p>{error}</p>
        <button 
          className="back-button"
          onClick={() => navigate('/')}
        >
          Back to Home
        </button>
      </div>
    );
  }
  
  return (
    <div className="player-game-page">
      <PlayerGameInterface 
        gameSessionId={gameSession.id}
        onExit={handleExitGame}
      />
    </div>
  );
};

export default PlayerGamePage;
