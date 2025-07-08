import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { useSocket } from '../context/SocketContext';
import GameSettingsForm from '../components/Host/GameSettingsForm';
import gameSessionService from '../services/gameSessionService';
import './HostGamePage.css';

/**
 * Host Game Page
 * Allows users to create and configure new game sessions
 */
const HostGamePage = () => {
  const { player, isLoggedIn } = usePlayer();
  const { connectToNamespace } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Check for error in location state (e.g., redirected from GameMasterPage)
  useEffect(() => {
    if (location?.state?.error) {
      setError(location.state.error);
      // Clear the error from location state
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  // Redirect to registration if not logged in
  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/register');
    }
  }, [isLoggedIn, navigate]);

  // Handle form submission to create a game
  const handleCreateGame = async (settings) => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Prepare game settings for API
      const gameSettings = {
        maxPlayers: settings.maxPlayers,
        publicGame: settings.publicGame,
        allowJoinAfterStart: settings.allowJoinAfterStart,
        questionPoolSize: settings.questionPoolSize,
        timeLimit: settings.timeLimit,
        roundTypes: settings.roundTypes  // Send the full object with boolean values
      };

      console.log('Creating game with settings:', gameSettings);

      // Create game session
      const createdGame = await gameSessionService.createGameSession(gameSettings);
      console.log('Game created successfully:', createdGame);

      if (!createdGame || (!createdGame.id && !createdGame.id)) {
        throw new Error('Invalid game session data returned from server');
      }

      // Use either _id (MongoDB) or id (PostgreSQL) for compatibility
      const gameId = createdGame.id || createdGame.id;
      const gameCode = createdGame.code;

      // Store game session ID in localStorage for recovery if needed
      localStorage.setItem('lastCreatedGameId', gameId);
      localStorage.setItem('lastCreatedGameCode', gameCode);
      localStorage.setItem('lastHostedGameId', gameId);
      localStorage.setItem('lastHostedGameCode', gameCode);

      // Create a simplified version of the game session to pass in state
      // This avoids potential circular reference issues
      const gameSessionForState = {
        _id: gameId, // Use the compatible ID we determined above
        id: gameId,  // Include both for compatibility
        code: gameCode,
        hostId: createdGame.hostId,
        status: createdGame.status,
        settings: createdGame.settings,
        rounds: createdGame.rounds || []  // Include rounds data
      };

      console.log('Automatically navigating to Game Master Console');
      console.log('Passing game session to state:', gameSessionForState);

      // Connect to host namespace with a promise to ensure connection is established
      try {
        console.log('Connecting to host namespace...');
        await connectToNamespace('host', {
          playerId: player?.id || player?.id, // Support both ID formats
          gameSessionId: gameId, // Use the compatible game ID
          isHost: true
        });
        console.log('Socket connection to host namespace established');
      } catch (socketError) {
        console.error('Error connecting to host namespace:', socketError);
        // Continue anyway, as the GameMasterPage will attempt to reconnect
      }

      // Use replace instead of push to prevent back button from returning to this page
      // This helps prevent the flickering issue
      navigate(`/game-master/${gameId}`, {
        replace: true,
        state: {
          gameSession: gameSessionForState,
          fromHostPage: true
        }
      });

    } catch (err) {
      console.error('Error creating game:', err);
      setError(err.response?.data?.message || 'Failed to create game. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <div className="host-game-page">
      <div className="page-header">
        <h1>Host a Game</h1>
        <p className="page-description">
          Configure your game settings and create a new game session.
        </p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <GameSettingsForm
        onSubmit={handleCreateGame}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default HostGamePage;
