import React from 'react';
import { Link } from 'react-router-dom';
import PlayerProfileEdit from '../components/Player/PlayerProfileEdit';
import './PlayerProfileEditPage.css';

/**
 * Player Profile Edit Page
 * Allows players to edit their profile information
 */
const PlayerProfileEditPage = () => {
  return (
    <div className="player-profile-edit-page">
      <div className="page-header">
        <h1>Edit Your Profile</h1>
        <p className="page-description">
          Update your player information, avatar, and buzzer sound.
        </p>
      </div>
      
      <PlayerProfileEdit />
      
      <div className="edit-page-footer">
        <Link to="/profile" className="back-link">Back to Profile</Link>
      </div>
    </div>
  );
};

export default PlayerProfileEditPage;
