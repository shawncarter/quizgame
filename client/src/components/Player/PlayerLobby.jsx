import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import playerApiService from '../../services/playerApiService';
import { usePlayer } from '../../context/PlayerContext';
import './PlayerLobby.css';

/**
 * Player lobby component
 * Displays a list of all registered players
 */
const PlayerLobby = () => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { player: currentPlayer } = usePlayer();

  // Load all players
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        setLoading(true);
        const response = await playerApiService.getAllPlayers();
        setPlayers(response);
      } catch (err) {
        console.error('Error loading players:', err);
        setError('Failed to load players');
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
  }, []);

  if (loading) {
    return <div className="loading">Loading players...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="player-lobby-container">
      <h2>Player Lobby</h2>
      <p className="lobby-description">
        All registered players are listed here. You can invite them to your game or view their profiles.
      </p>

      {players.length === 0 ? (
        <div className="no-players">
          <p>No players have registered yet.</p>
          <Link to="/register" className="button primary-button">Register Now</Link>
        </div>
      ) : (
        <div className="players-list">
          {players.map(player => (
            <div 
              key={player?.id} 
              className={`player-card ${currentPlayer && player?.id === currentPlayer.id ? 'current-player' : ''}`}
            >
              <div className="player-avatar">
                <div className="avatar-image">{player.avatar || 'Default'}</div>
              </div>
              <div className="player-info">
                <h3 className="player-name">{player.name}</h3>
                <p className="player-detail">Age: {player.age}</p>
                <p className="player-detail">Specialist: {player.specialistSubject}</p>
                <p className="player-detail">
                  Games Played: {player.gameHistory ? player.gameHistory.length : 0}
                </p>
              </div>
              <div className="player-actions">
                <Link 
                  to={`/profile/${player?.id}`} 
                  className="button small-button"
                >
                  View Profile
                </Link>
                {currentPlayer && player?.id !== currentPlayer.id && (
                  <button className="button small-button primary-button">
                    Invite to Game
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlayerLobby;
