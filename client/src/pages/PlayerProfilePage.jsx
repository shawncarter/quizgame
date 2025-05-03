import React from 'react';
import { Link } from 'react-router-dom';
import PlayerProfile from '../components/Player/PlayerProfile';
import './PlayerProfilePage.css';

/**
 * Player Profile Page
 * Displays the player's profile information and statistics
 */
const PlayerProfilePage = () => {
  return (
    <div className="player-profile-page">
      <div className="page-header">
        <h1>Player Profile</h1>
        <p className="page-description">
          View and manage your player information and game statistics.
        </p>
      </div>
      
      <PlayerProfile />
      
      <div className="profile-page-footer">
        <Link to="/" className="back-link">Back to Home</Link>
        <Link to="/players" className="player-lobby-link">View Player Lobby</Link>
      </div>
    </div>
  );
};

export default PlayerProfilePage;
