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

  // Check if player is registered
  useEffect(() => {
    if (!isLoggedIn && player === null) {
      console.log('Player not logged in, redirecting to register');
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
  }, [isLoggedIn, navigate, gameId, player]);

  // Check for game session in location state (passed from HostGamePage)
  useEffect(() => {
    console.log('Location state check - Current location state:', location.state);

    if (location.state?.gameSession && location.state?.fromHostPage) {
      console.log('Found game session in location state:', location.state.gameSession._id);
      setUsingLocationState(true);

      // If we have a game session in location state but no gameId, use it
      if ((!gameId || gameId === 'undefined') && location.state.gameSession._id) {
        console.log('Using game ID from location state');
        const gameIdFromState = location.state.gameSession._id;
        console.log('Game ID from state:', gameIdFromState);

        // Store in localStorage as a backup
        localStorage.setItem('lastCreatedGameId', gameIdFromState);

        // Set the game ID state
        setGameId(gameIdFromState);
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
    console.log('Connect to game effect - usingLocationState:', usingLocationState);
    console.log('Connect to game effect - location.state:', location.state);
    console.log('Connect to game effect - player:', player);
    console.log('Connect to game effect - isLoggedIn:', isLoggedIn);
    console.log('Connect to game effect - gameStatus:', gameStatus);
    console.log('Connect to game effect - gameSession:', gameSession);
    console.log('Connect to game effect - localStorage lastCreatedGameId:', localStorage.getItem('lastCreatedGameId'));
    console.log('Connect to game effect - localStorage lastCreatedGameCode:', localStorage.getItem('lastCreatedGameCode'));

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
      if (gameSession && gameSession._id !== gameId) {
        console.log('Connected to a different game than the one in the URL');
        console.log('Current game session ID:', gameSession._id);
        console.log('URL game ID:', gameId);

        // Disconnect from the current game - IMPORTANT: Don't preserve state here
        console.log('Disconnecting from current game to connect to the new one');
        disconnectFromGame(false); // Force state reset

        // Wait a moment for the disconnect to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Connect if we're not already connected to this specific game
      const shouldConnect =
        // Not connected at all
        (gameStatus !== 'active' && gameStatus !== 'loading' && !gameSession) ||
        // Connected to a different game
        (gameSession && gameSession._id !== gameId);

      if (shouldConnect) {
        // If we have a game ID and player, connect to the game
        if (gameId && player && player._id) {
          console.log(`Connecting to game ${gameId} as player ${player._id}`);

          // If we have a game session in location state, pass it to connectToGame
          if (location.state?.gameSession && location.state.gameSession._id === gameId) {
            console.log('Using game session from location state for connectToGame');
            console.log('Game session from state:', location.state.gameSession);
            connectToGame(gameId, { gameSessionData: location.state.gameSession });
          } else {
            // Double check localStorage as a backup
            const lastCreatedGameId = localStorage.getItem('lastCreatedGameId');
            if (lastCreatedGameId === gameId) {
              console.log('Game ID matches localStorage ID, using it for connection');
            } else {
              console.log('Game ID does not match localStorage ID, using provided game ID');
            }

            // Make sure the game ID is valid before connecting
            if (gameId && gameId !== 'undefined') {
              console.log('Connecting to game with ID:', gameId);
              connectToGame(gameId);
            } else {
              console.error('Cannot connect: Invalid game ID');
              setLocalError('Invalid game ID. Please create a new game.');
            }
          }
        } else {
          console.log('Missing gameId or player:', { gameId, playerId: player?._id });
          // If we have a gameId but no player, wait for player to load
          if (gameId && (!player || !player._id)) {
            console.log('Have gameId but no player, waiting for player to load...');
          }
        }
      } else {
        console.log('Already connected to the correct game, skipping connection');
        console.log('Current game status:', gameStatus);
        console.log('Current game session ID:', gameSession?._id);
      }
    };

    // Execute the connection logic
    handleGameConnection();

    return () => {
      console.log('GameMasterPage unmounting, disconnecting from game but preserving state');
      // Preserve the game state when unmounting to prevent flickering
      disconnectFromGame(true);
    };
  }, [gameId, player, gameSession, gameStatus, disconnectFromGame, connectToGame, navigate]);

  // Handle loading state
  if (gameStatus === 'loading') {
    return (
      <div className="game-master-page loading">
        <h2>Loading Game Session...</h2>
        <div className="loading-spinner"></div>
        <p>Game ID: {gameId}</p>
        <p>Player ID: {player?._id}</p>
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
          <p>Player ID: {player?._id}</p>
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
          <p>Player ID: {player?._id}</p>
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
