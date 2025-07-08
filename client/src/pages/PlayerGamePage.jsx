import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import PlayerGameInterface from '../components/Player/PlayerGameInterface';
// import gameApiService from '../services/gameApiService'; // Uncomment if you implement actual API call
import './PlayerGamePage.css';

/**
 * Player game page component
 * Displays the player game interface for a specific game session
 */
const PlayerGamePage = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { player, loading: playerLoading, error: playerError } = usePlayer();
  
  const [gameSessionLoading, setGameSessionLoading] = useState(true);
  const [localError, setLocalError] = useState(null);
  const [gameSession, setGameSession] = useState(null);

  const fetchGameSession = useCallback(async () => {
    if (!gameId) {
      setLocalError('Invalid game session ID.');
      setGameSessionLoading(false);
      return;
    }
    console.log(`PlayerGamePage: Fetching game session for ID: ${gameId}`);
    setGameSessionLoading(true);
    setLocalError(null); // Clear previous errors
    try {
      // In a real app, you would fetch game session details from the server
      // e.g., const sessionData = await gameApiService.getGameSessionById(gameId);
      // if (!sessionData) throw new Error('Game session not found.');
      // setGameSession(sessionData);

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 300)); 
      
      // For now, we'll just use a mock session based on gameId
      setGameSession({
        id: gameId,
        name: `Quiz Game Session ${gameId}`,
        hostId: 'mock-host-123',
        status: 'active' 
      });
      console.log(`PlayerGamePage: Mock game session set for ID: ${gameId}`);
    } catch (err) {
      console.error('PlayerGamePage: Error fetching game session:', err);
      setLocalError(err.message || 'Failed to load game session details.');
    } finally {
      setGameSessionLoading(false);
    }
  }, [gameId]); // gameId is a dependency for fetchGameSession
  
  useEffect(() => {
    console.log('PlayerGamePage useEffect triggered. playerLoading:', playerLoading, 'Player:', player);
    if (playerLoading) {
      // Player context is still loading, wait.
      // The main loading display (playerLoading || gameSessionLoading) will handle this.
      return; 
    }

    // Player context has loaded. Now check for player.
    if (!player || !player?.id) {
      console.log('PlayerGamePage: No player found after context load.');
      setLocalError('You must be registered to join a game. Please register or log in.');
      setGameSessionLoading(false); // Stop any game session loading if no player
      return;
    }
    
    // Player exists, proceed with game session logic
    if (!gameId) {
      console.log('PlayerGamePage: Invalid gameId.');
      setLocalError('Invalid game session ID provided.');
      setGameSessionLoading(false);
      return;
    }
    
    console.log('PlayerGamePage: Player and gameId are valid. Location state:', location.state);
    if (location.state && location.state.gameSession) {
      console.log('PlayerGamePage: Using game session from location state.');
      setGameSession(location.state.gameSession);
      setGameSessionLoading(false);
    } else {
      console.log('PlayerGamePage: No game session in location state, fetching...');
      fetchGameSession();
    }
  }, [player, playerLoading, gameId, location.state, fetchGameSession]);
  
  const handleExitGame = () => {
    navigate('/');
  };
  
  if (playerLoading || gameSessionLoading) {
    return (
      <div className="player-game-page loading">
        <div className="loading-spinner"></div>
        <p>{playerLoading ? 'Verifying player...' : 'Joining game session...'}</p>
      </div>
    );
  }
  
  if (playerError) {
    return (
      <div className="player-game-page error">
        <h2>Authentication Error</h2>
        <p>{typeof playerError === 'string' ? playerError : (playerError.message || 'Could not verify player details.')}</p>
        <button className="back-button" onClick={() => navigate('/')}>Back to Home</button>
      </div>
    );
  }

  if (localError) {
    return (
      <div className="player-game-page error">
        <h2>Error</h2>
        <p>{localError}</p>
        <button className="back-button" onClick={() => navigate('/')}>Back to Home</button>
      </div>
    );
  }

  if (!gameSession) {
    // This case should ideally be caught by localError if fetchGameSession fails.
    // Adding as a safeguard.
    return (
        <div className="player-game-page error">
            <h2>Error</h2>
            <p>Game session could not be loaded. Please try again.</p>
            <button className="back-button" onClick={() => navigate('/')}>Back to Home</button>
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

