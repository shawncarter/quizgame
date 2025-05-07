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
        roundTypes: Object.keys(settings.roundTypes)
          .filter(key => settings.roundTypes[key])
          .map(key => key)
      };

      console.log('Creating game with settings:', gameSettings);

      // Create game session
      const createdGame = await gameSessionService.createGameSession(gameSettings);
      console.log('Game created successfully:', createdGame);

      if (!createdGame || !createdGame._id) {
        throw new Error('Invalid game session data returned from server');
      }

      // Connect to host namespace
      connectToNamespace('host', {
        playerId: player._id,
        gameSessionId: createdGame._id,
        isHost: true
      });

      // Store game session ID in localStorage for recovery if needed
      localStorage.setItem('lastCreatedGameId', createdGame._id);
      localStorage.setItem('lastCreatedGameCode', createdGame.code);

      // Create a simplified version of the game session to pass in state
      // This avoids potential circular reference issues
      const gameSessionForState = {
        _id: createdGame._id,
        code: createdGame.code,
        hostId: createdGame.hostId,
        status: createdGame.status,
        settings: createdGame.settings
      };

      console.log('Automatically navigating to Game Master Console');
      console.log('Passing game session to state:', gameSessionForState);

      // Navigate directly to the Game Master Console
      navigate(`/game-master/${createdGame._id}`, {
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
