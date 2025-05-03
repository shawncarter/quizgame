import React from 'react';
import { Link } from 'react-router-dom';
import PlayerLobby from '../components/Player/PlayerLobby';
import './PlayerLobbyPage.css';

/**
 * Player Lobby Page
 * Displays a list of all registered players
 */
const PlayerLobbyPage = () => {
  return (
    <div className="player-lobby-page">
      <div className="page-header">
        <h1>Player Lobby</h1>
        <p className="page-description">
          View all registered players and invite them to your games.
        </p>
      </div>
      
      <PlayerLobby />
      
      <div className="lobby-page-footer">
        <Link to="/" className="back-link">Back to Home</Link>
        <Link to="/profile" className="profile-link">View Your Profile</Link>
      </div>
    </div>
  );
};

export default PlayerLobbyPage;
