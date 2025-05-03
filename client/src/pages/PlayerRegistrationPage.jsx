import React from 'react';
import { Link } from 'react-router-dom';
import PlayerRegistrationForm from '../components/Player/PlayerRegistrationForm';
import './PlayerRegistrationPage.css';

/**
 * Player Registration Page
 * Contains the registration form and related information
 */
const PlayerRegistrationPage = () => {
  return (
    <div className="player-registration-page">
      <div className="page-header">
        <h1>Join QuizGame</h1>
        <p className="page-description">
          Create your player profile to join games and track your progress.
        </p>
      </div>
      
      <PlayerRegistrationForm />
      
      <div className="registration-footer">
        <p>
          Already registered? Your profile will be automatically loaded based on your device.
        </p>
        <p>
          <Link to="/" className="back-link">Back to Home</Link>
        </p>
      </div>
    </div>
  );
};

export default PlayerRegistrationPage;
