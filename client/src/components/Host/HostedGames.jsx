import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../../context/PlayerContext';
import gameApiService from '../../services/gameApiService';
import './HostedGames.css';

/**
 * Hosted Games Component
 * Displays a list of games hosted by the current player
 */
const HostedGames = () => {
  const navigate = useNavigate();
  const { player } = usePlayer();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hostedGames, setHostedGames] = useState([]);

  // Fetch hosted games on component mount
  useEffect(() => {
    if (!player || !player?.id) return;

    const fetchHostedGames = async () => {
      try {
        setLoading(true);
        const games = await gameApiService.getHostedGames();
        setHostedGames(games);
        setError(null);
      } catch (err) {
        console.error('Error fetching hosted games:', err);
        setError('Failed to load your hosted games');
      } finally {
        setLoading(false);
      }
    };

    fetchHostedGames();
  }, [player]);

  // Navigate to game master console
  const goToGameMaster = (gameId, gameCode) => {
    navigate(`/game-master/${gameId}`, {
      state: {
        gameSession: {
          _id: gameId,
          code: gameCode,
          status: 'lobby'
        },
        fromHostPage: true
      }
    });
  };

  // Delete a game
  const deleteGame = async (gameId) => {
    if (!confirm('Are you sure you want to delete this game? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      await gameApiService.deleteGameSession(gameId);

      // Remove the game from the list
      setHostedGames(prevGames => prevGames.filter(game => game.id !== gameId));

      // If this was the last created game, clear localStorage
      const lastCreatedGameId = localStorage.getItem('lastCreatedGameId');
      if (lastCreatedGameId === gameId) {
        localStorage.removeItem('lastCreatedGameId');
        localStorage.removeItem('lastCreatedGameCode');
      }
    } catch (err) {
      console.error('Error deleting game:', err);
      setError('Failed to delete the game. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Delete all hosted games
  const deleteAllGames = async () => {
    if (!confirm('Are you sure you want to delete ALL your hosted games? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);

      // Delete each game one by one
      const deletePromises = hostedGames.map(game =>
        gameApiService.deleteGameSession(game.id)
          .catch(err => {
            console.error(`Error deleting game ${game.id}:`, err);
            return null; // Continue with other deletions even if one fails
          })
      );

      await Promise.all(deletePromises);

      // Clear the list
      setHostedGames([]);

      // Clear localStorage
      localStorage.removeItem('lastCreatedGameId');
      localStorage.removeItem('lastCreatedGameCode');
    } catch (err) {
      console.error('Error deleting all games:', err);
      setError('Failed to delete all games. Some games may have been deleted.');
    } finally {
      setLoading(false);
    }
  };

  // Get status display text and class
  const getStatusInfo = (status) => {
    switch (status) {
      case 'created':
        return { text: 'Created', className: 'status-created' };
      case 'lobby':
        return { text: 'Waiting for Players', className: 'status-lobby' };
      case 'active':
        return { text: 'In Progress', className: 'status-active' };
      case 'paused':
        return { text: 'Paused', className: 'status-paused' };
      case 'completed':
        return { text: 'Completed', className: 'status-completed' };
      default:
        return { text: 'Unknown', className: 'status-unknown' };
    }
  };

  // If no player is logged in, don't show anything
  if (!player || !player?.id) {
    return null;
  }

  // If there are no hosted games and we're not loading, don't show anything
  if (hostedGames.length === 0 && !loading && !error) {
    return null;
  }

  return (
    <div className="hosted-games">
      <div className="hosted-games-header">
        <h3>Your Hosted Games</h3>
        {hostedGames.length > 1 && (
          <button
            className="clear-all-btn"
            onClick={deleteAllGames}
            disabled={loading}
          >
            Clear All
          </button>
        )}
      </div>

      {error && (
        <div className="hosted-games-error">
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="hosted-games-loading">
          <p>Loading your games...</p>
        </div>
      ) : (
        <div className="hosted-games-list">
          {hostedGames.length === 0 ? (
            <p className="no-games">You haven't hosted any games yet.</p>
          ) : (
            hostedGames.map(game => {
              const statusInfo = getStatusInfo(game.status);

              return (
                <div key={game.id} className="hosted-game-card">
                  <div className="game-info">
                    <h4>{game.title || 'Quiz Game'}</h4>
                    <p className="game-code">Code: <strong>{game.code}</strong></p>
                    <p className={`game-status ${statusInfo.className}`}>
                      Status: {statusInfo.text}
                    </p>
                    {game.players && (
                      <p className="player-count">
                        Players: {game.players.length} / {game.settings?.maxPlayers || '∞'}
                      </p>
                    )}
                  </div>

                  <div className="game-actions">
                    <button
                      className="resume-game-btn"
                      onClick={() => goToGameMaster(game.id, game.code)}
                    >
                      {game.status === 'created' || game.status === 'lobby'
                        ? 'Continue Setup'
                        : game.status === 'completed'
                          ? 'View Results'
                          : 'Resume Game'}
                    </button>
                    <button
                      className="delete-game-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteGame(game.id);
                      }}
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default HostedGames;
