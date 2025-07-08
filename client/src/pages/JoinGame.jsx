import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { useSocket } from '../context/SocketContext';
import { useGame } from '../hooks/useGame';
import gameSessionService from '../services/gameSessionService';
import gameApiService from '../services/gameApiService';
import TestGameCreator from '../components/Debug/TestGameCreator';
import SimpleTest from '../components/Debug/SimpleTest';
import RegistrationPrompt from '../components/Player/RegistrationPrompt';
import './JoinGame.css';

/**
 * Join Game Page
 * Allows players to join a game by entering a game code or via URL parameter
 */
const JoinGame = () => {
  const { gameCode: urlGameCode } = useParams();
  const navigate = useNavigate();
  const { player, isLoggedIn, registerPlayer } = usePlayer();
  const { joinGameSession } = useSocket();
  const { connectToGame } = useGame();

  // State for the form
  const [gameCode, setGameCode] = useState(urlGameCode || '');
  const [playerName, setPlayerName] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState(null);
  const [gameSession, setGameSession] = useState(null);
  const [showRegistrationPrompt, setShowRegistrationPrompt] = useState(false);

  // Check if we have a game code from URL and validate it
  useEffect(() => {
    if (urlGameCode) {
      validateGameCode(urlGameCode);
    }
  }, [urlGameCode]);

  // If player is already logged in, pre-fill the name
  useEffect(() => {
    if (player && player.name) {
      setPlayerName(player.name);
    }
  }, [player]);

  // Validate the game code with the server
  const validateGameCode = async (code) => {
    if (!code) {
      setError('Please enter a game code');
      return null;
    }

    setIsValidating(true);
    setError(null);

    try {
      // First check if the game exists and is joinable
      const gameData = await gameSessionService.getGameSessionByCode(code);

      if (!gameData) {
        setError('Game not found. Please check the code and try again.');
        setIsValidating(false);
        return null;
      }

      // Check if game is in a joinable state
      if (gameData.status !== 'created' && gameData.status !== 'lobby') {
        if (gameData.status === 'active' && gameData.allowJoinAfterStart) {
          // Game is active but allows joining after start
        } else {
          setError('This game cannot be joined at this time.');
          setIsValidating(false);
          return null;
        }
      }

      // Check if game is full
      if (gameData.playerCount >= gameData.maxPlayers) {
        setError('This game is full and cannot accept more players.');
        setIsValidating(false);
        return null;
      }

      console.log('✅ Game validation successful, setting gameSession:', gameData);
      setGameSession(gameData);
      setIsValidating(false);
      console.log('✅ Game validation complete, returning gameData');
      return gameData; // Return the actual game data instead of just true
    } catch (err) {
      console.error('Error validating game code:', err);
      setError('Failed to validate game code. Please try again.');
      setIsValidating(false);
      return null;
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log('🎮 Join game attempt started...');
    console.log('🎮 Current player context state:');
    console.log('   - player:', player);
    console.log('   - isLoggedIn:', isLoggedIn);
    console.log('   - gameCode:', gameCode);

    // Validate the game code
    console.log('🎮 Validating game code...');
    const validatedGameSession = await validateGameCode(gameCode);
    console.log('🎮 Game code validation result:', validatedGameSession);
    if (!validatedGameSession) return;

    // Check if player is logged in
    console.log('🎮 Checking if player is logged in...');
    console.log('🎮 isLoggedIn value:', isLoggedIn);
    console.log('🎮 player object:', player);

    if (!isLoggedIn) {
      console.log('❌ Player not logged in - showing registration prompt');
      // Show registration prompt instead of inline form
      setShowRegistrationPrompt(true);
      return;
    }

    console.log('✅ Player is logged in, proceeding with join...');
    console.log('✅ Final check - player object before join:', player);
    console.log('✅ Final check - player?.id:', player?.id);
    console.log('✅ Final check - validatedGameSession object:', validatedGameSession);
    console.log('✅ Final check - validatedGameSession.id:', validatedGameSession?.id);

    // At this point, we should have a valid game code and a logged-in player
    try {
      // Join the game session using the validated game session data
      await joinGame(validatedGameSession.id, gameCode);
    } catch (err) {
      console.error('Error joining game:', err);
      console.error('Error details:', err.message);
      console.error('Player state at error:', player);
      console.error('isLoggedIn at error:', isLoggedIn);
      setError('Failed to join the game. Please try again.');
    }
  };

  // Handle registration completion
  const handleRegistrationComplete = async (playerData) => {
    console.log('Registration completed:', playerData);
    setShowRegistrationPrompt(false);

    // After registration, automatically join the game
    if (gameSession) {
      try {
        await joinGame(gameSession.id, gameCode);
      } catch (err) {
        console.error('Error joining game after registration:', err);
        setError('Registration successful, but failed to join game. Please try again.');
      }
    }
  };

  // Handle registration cancellation
  const handleRegistrationCancel = () => {
    setShowRegistrationPrompt(false);
    setError('Registration is required to join a game.');
  };

  // Join the game and navigate to the appropriate page
  const joinGame = async (gameSessionId, code) => {
    try {
      console.log('Joining game with ID:', gameSessionId);
      console.log('Game code:', code);
      console.log('Player:', player);

      if (!player || !player?.id) {
        throw new Error('Player not properly registered');
      }

      // First, join the game via HTTP API to add player to the database
      console.log('Calling HTTP API to join game...');
      await gameApiService.joinGameSession(gameSessionId, {});
      console.log('Successfully joined game via HTTP API');

      // Then connect to the game via socket for real-time communication
      console.log('Connecting to game via socket...');
      joinGameSession(gameSessionId, code, player?.id, false);

      // Connect to the game via the game context (convert to string)
      console.log('🎮 About to call connectToGame...');
      await connectToGame(String(gameSessionId));
      console.log('🎮 connectToGame completed successfully');

      // Navigate to the player game page
      console.log('🎮 About to navigate to game page...');
      navigate(`/game/${gameSessionId}`, {
        state: { gameSession }
      });
      console.log('🎮 Navigation call completed');
    } catch (err) {
      console.error('Error joining game:', err);
      setError(`Failed to join game: ${err.message}`);
      throw err;
    }
  };

  return (
    <div className="join-game-page">
      <div className="join-game-header">
        <h1>Join a Game</h1>
        <p>Enter a game code to join an existing game session</p>
      </div>

      {error && (
        <div className="join-game-error">
          <p>{error}</p>
        </div>
      )}

      <div className="join-game-content">
        <form onSubmit={handleSubmit} className="join-game-form">
          <div className="form-group">
            <label htmlFor="gameCode">Game Code:</label>
            <input
              type="text"
              id="gameCode"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              placeholder="Enter game code"
              disabled={isValidating}
              required
            />
          </div>

          {!isLoggedIn && (
            <div className="form-group">
              <p className="registration-notice">
                You'll be prompted to create a player profile after entering a valid game code.
              </p>
            </div>
          )}

          <button
            type="submit"
            className="join-button"
            disabled={isValidating}
          >
            {isValidating ? 'Validating...' : 'Join Game'}
          </button>
        </form>
      </div>

      <div className="join-game-alternative">
        <p>Want to host your own game?</p>
        <button
          className="host-button"
          onClick={() => navigate('/host')}
          disabled={isValidating}
        >
          Host a Game
        </button>
      </div>

      <div className="join-game-scan">
        <p>Or scan a QR code to join:</p>
        <button
          className="scan-button"
          onClick={() => navigate('/scan')}
          disabled={isValidating}
        >
          Scan QR Code
        </button>
      </div>

      {/* Simple test component */}
      <SimpleTest />

      {/* Test Game Creator for development - always show for now */}
      <TestGameCreator />

      {/* Registration Prompt Modal */}
      {showRegistrationPrompt && (
        <RegistrationPrompt
          gameCode={gameCode}
          onRegister={handleRegistrationComplete}
          onClose={handleRegistrationCancel}
        />
      )}
    </div>
  );
};

export default JoinGame;
