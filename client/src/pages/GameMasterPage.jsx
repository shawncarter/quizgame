import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { usePlayer } from '../context/PlayerContext';
import GameMasterDashboard from '../components/GameMaster/GameMasterDashboard';
import DebugPanel from '../components/Debug/DebugPanel';
import './GameMasterPage.css';

/**
 * Game Master Page
 * Container for the Game Master dashboard with additional navigation and error handling
 */
const GameMasterPage = () => {
  // Get the game ID from URL parameters
  const params = useParams();
  const urlGameId = params.gameId;

  // Use state to store the actual game ID we'll use
  const [gameId, setGameId] = useState(urlGameId);
  // Add state for local error handling
  const [localError, setLocalError] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { player, isLoggedIn } = usePlayer();
  const {
    gameSession,
    connectToGame,
    disconnectFromGame,
    error,
    gameStatus
  } = useGame();

  // State to track if we're using a game ID from location state
  const [usingLocationState, setUsingLocationState] = useState(false);

  // Extract game ID from URL on mount
  useEffect(() => {
    console.log('URL path:', window.location.pathname);
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length >= 3) {
      const idFromPath = pathParts[2];
      console.log('Extracted game ID from URL path:', idFromPath);
      if (idFromPath && idFromPath !== 'undefined') {
        setGameId(idFromPath);
      }
    }
  }, []);

  // Debug information
  console.log('GameMasterPage - Game ID:', gameId);
  console.log('GameMasterPage - Player:', player);
  console.log('GameMasterPage - Is Logged In:', isLoggedIn);
  console.log('GameMasterPage - Game Session:', gameSession);
  console.log('GameMasterPage - Game Status:', gameStatus);
  console.log('GameMasterPage - Error:', error);

  // Check if player is registered - but be more lenient during loading
  useEffect(() => {
    // Give more time for player data to load before redirecting
    const checkPlayerTimeout = setTimeout(() => {
      if (!isLoggedIn && player === null) {
        console.log('Player not logged in after timeout, redirecting to register');
        // Store the game ID in localStorage before redirecting
        if (gameId) {
          localStorage.setItem('lastCreatedGameId', gameId);
        }
        navigate('/register', {
          state: {
            returnTo: `/game-master/${gameId}`,
            gameId: gameId
          }
        });
      } else {
        console.log('Player is logged in, no need to redirect to register');
      }
    }, 2000); // Wait 2 seconds for player data to load

    return () => clearTimeout(checkPlayerTimeout);
  }, [isLoggedIn, navigate, gameId, player]);

  // Check for game session in location state (passed from HostGamePage)
  useEffect(() => {
    console.log('Location state check - Current location state:', location.state);

    if (location.state?.gameSession && location.state?.fromHostPage) {
      const gameSessionFromState = location.state.gameSession;
      const gameSessionStateId = gameSessionFromState.id || gameSessionFromState.id; // Support both ID formats
      console.log('Found game session in location state:', gameSessionStateId);
      setUsingLocationState(true);

      // If we have a game session in location state but no gameId, use it
      if ((!gameId || gameId === 'undefined') && gameSessionStateId) {
        console.log('Using game ID from location state');
        console.log('Game ID from state:', gameSessionStateId);

        // Store in localStorage as a backup
        localStorage.setItem('lastCreatedGameId', gameSessionStateId);

        // Set the game ID state
        setGameId(gameSessionStateId);
      }
    } else {
      console.log('No game session in location state or not from host page');

      // If we still don't have a valid game ID, check localStorage
      if (!gameId || gameId === 'undefined') {
        const lastCreatedGameId = localStorage.getItem('lastCreatedGameId');
        if (lastCreatedGameId) {
          console.log('Using game ID from localStorage:', lastCreatedGameId);
          setGameId(lastCreatedGameId);
        }
      }
    }
  }, [location, gameId, navigate]);

  // Connect to game on mount
  useEffect(() => {
    console.log('=== GAME MASTER PAGE - CONNECT TO GAME EFFECT ===');
    console.log('Connect to game effect - gameId:', gameId);
    console.log('Connect to game effect - player:', player);
    console.log('Connect to game effect - isLoggedIn:', isLoggedIn);
    console.log('Connect to game effect - gameStatus:', gameStatus);
    console.log('Connect to game effect - gameSession:', gameSession);
    console.log('Connect to game effect - localStorage lastCreatedGameId:', localStorage.getItem('lastCreatedGameId'));

    // If we already have a game session and it matches the current gameId, don't reconnect
    const gameSessionId = gameSession?.id || gameSession?.id; // Support both ID formats
    if (gameSession && gameSessionId && gameSessionId.toString() === gameId.toString() && gameStatus !== 'error') {
      console.log('Already connected to the correct game session, skipping reconnection');
      console.log('Game session ID:', gameSessionId, 'URL game ID:', gameId);
      return;
    }

    // First check if we have a valid game ID
    if (!gameId || gameId === 'undefined') {
      console.error('Game ID is missing or invalid');

      // Try to get the game ID from localStorage as a last resort
      const lastCreatedGameId = localStorage.getItem('lastCreatedGameId');
      if (lastCreatedGameId) {
        console.log(`Found game ID in localStorage: ${lastCreatedGameId}`);
        // Set the game ID state
        setGameId(lastCreatedGameId);
      } else {
        console.error('No game ID found in localStorage');
        navigate('/host', {
          state: {
            error: 'Game session ID is missing. Please create a new game.'
          }
        });
      }
      return;
    }

    // Define an async function to handle the connection logic
    const handleGameConnection = async () => {
      // Check if we're connected to a different game than the one in the URL
      const currentGameSessionId = gameSession?.id || gameSession?.id; // Support both ID formats
      if (gameSession && currentGameSessionId && currentGameSessionId.toString() !== gameId.toString()) {
        console.log('Connected to a different game than the one in the URL');
        console.log('Current game session ID:', currentGameSessionId);
        console.log('URL game ID:', gameId);

        // Disconnect from the current game - IMPORTANT: Don't preserve state here
        console.log('Disconnecting from current game to connect to the new one');
        disconnectFromGame(false); // Force state reset

        // Wait a moment for the disconnect to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Always attempt to connect if we have a valid gameId and player
      if (gameId && player && (player?.id || player?.id)) {
        const playerId = player?.id || player?.id; // Support both ID formats
        console.log(`Connecting to game ${gameId} as player ${playerId}`);

        try {
          // Check if we have game session data in location state
          const locationState = location.state;
          const gameSessionFromState = locationState?.gameSession;

          console.log('=== GAME MASTER CONNECTION DEBUG ===');
          console.log('Location state:', locationState);
          console.log('Game session from state:', gameSessionFromState);
          console.log('Game ID we want to connect to:', gameId);

          // Make sure the game ID is valid before connecting
          if (gameId && gameId !== 'undefined') {
            console.log('Connecting to game with ID:', gameId);

            // If we have game session data in location state, pass it to connectToGame
            const gameSessionStateId = gameSessionFromState?.id || gameSessionFromState?.id; // Support both ID formats
            console.log('Game session state ID:', gameSessionStateId);
            
            if (gameSessionFromState && gameSessionStateId === gameId) {
              console.log('Using game session data from location state');
              console.log('Passing gameSessionData to connectToGame:', gameSessionFromState);
              await connectToGame(gameId, { gameSessionData: gameSessionFromState });
            } else {
              console.log('No matching game session data in location state, fetching from API');
              await connectToGame(gameId);
            }
          } else {
            console.error('Cannot connect: Invalid game ID');
            setLocalError('Invalid game ID. Please create a new game.');
          }
        } catch (err) {
          console.error('Error connecting to game:', err);
          setLocalError(`Failed to connect to game: ${err.message || 'Unknown error'}`);
        }
      } else {
        const playerId = player?.id || player?.id; // Support both ID formats
        console.log('Missing gameId or player:', { gameId, playerId });
        // If we have a gameId but no player, wait for player to load
        if (gameId && (!player || (!player?.id && !player?.id))) {
          console.log('Have gameId but no player, waiting for player to load...');
        }
      }
    };

    // Execute the connection logic with a small delay to ensure all state is initialized
    const connectWithDelay = setTimeout(() => {
      handleGameConnection();
    }, 100);

    return () => {
      // Clear the timeout if the component unmounts before it fires
      clearTimeout(connectWithDelay);

      // Don't disconnect when unmounting to prevent flickering
      // The game context will handle cleanup on its own
    };
  }, [gameId, player, gameSession, gameStatus, disconnectFromGame, connectToGame, navigate, location.state]);

  // Handle loading state
  if (gameStatus === 'loading') {
    return (
      <div className="game-master-page loading">
        <h2>Loading Game Session...</h2>
        <div className="loading-spinner"></div>
        <p>Game ID: {gameId}</p>
        <p>Player ID: {player?.id}</p>
        <DebugPanel />
      </div>
    );
  }

  // Handle error state
  if (error || localError) {
    const displayError = error || localError;
    return (
      <div className="game-master-page error">
        <h2>Error</h2>
        <p>{displayError}</p>
        <div className="error-actions">
          <button onClick={() => {
            setLocalError(null);
            if (gameId) {
              connectToGame(gameId);
            } else {
              navigate('/host');
            }
          }}>Try Again</button>
          <button onClick={() => navigate('/host')}>Back to Host</button>
        </div>
        <div className="error-details">
          <p>Game ID: {gameId}</p>
          <p>Player ID: {player?.id}</p>
          <p>Status: {gameStatus}</p>
        </div>
        <DebugPanel />
      </div>
    );
  }

  // Handle no game session
  if (!gameSession && gameStatus !== 'loading') {
    return (
      <div className="game-master-page not-found">
        <h2>Game Session Not Found</h2>
        <p>The game session you're looking for doesn't exist or you don't have permission to access it.</p>
        <div className="error-actions">
          <button onClick={() => {
            setLocalError(null);
            if (gameId) {
              connectToGame(gameId);
            } else {
              navigate('/host');
            }
          }}>Try Again</button>
          <button onClick={() => navigate('/host')}>Back to Host</button>
        </div>
        <div className="error-details">
          <p>Game ID: {gameId}</p>
          <p>Player ID: {player?.id}</p>
          <p>Status: {gameStatus}</p>
          <p>Error: {error || localError || 'No game session data found'}</p>
        </div>
        <DebugPanel />
      </div>
    );
  }

  return (
    <div className="game-master-page">
      <GameMasterDashboard />
      <DebugPanel />
    </div>
  );
};

export default GameMasterPage;
