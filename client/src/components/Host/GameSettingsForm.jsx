import React, { useState } from 'react';
import './GameSettingsForm.css';

/**
 * Game Settings Form Component
 * Allows hosts to configure game session settings
 */
const GameSettingsForm = ({ onSubmit, isSubmitting }) => {
  const [settings, setSettings] = useState({
    maxPlayers: 10,
    publicGame: true,
    allowJoinAfterStart: false,
    questionPoolSize: 30,
    timeLimit: 30,
    roundTypes: {
      pointBuilder: true,
      graduatedPoints: true,
      fastestFinger: true,
      specialist: true
    }
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('roundTypes.')) {
      const roundType = name.split('.')[1];
      setSettings(prev => ({
        ...prev,
        roundTypes: {
          ...prev.roundTypes,
          [roundType]: checked
        }
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value, 10) : value
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(settings);
  };

  return (
    <form className="game-settings-form" onSubmit={handleSubmit}>
      <h2>Game Settings</h2>
      
      <div className="form-group">
        <label htmlFor="maxPlayers">Maximum Players:</label>
        <input
          type="number"
          id="maxPlayers"
          name="maxPlayers"
          min="2"
          max="50"
          value={settings.maxPlayers}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="questionPoolSize">Number of Questions:</label>
        <input
          type="number"
          id="questionPoolSize"
          name="questionPoolSize"
          min="5"
          max="100"
          value={settings.questionPoolSize}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="timeLimit">Time Limit per Question (seconds):</label>
        <input
          type="number"
          id="timeLimit"
          name="timeLimit"
          min="10"
          max="120"
          value={settings.timeLimit}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            name="publicGame"
            checked={settings.publicGame}
            onChange={handleChange}
          />
          Public Game (visible in lobby)
        </label>
      </div>
      
      <div className="form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            name="allowJoinAfterStart"
            checked={settings.allowJoinAfterStart}
            onChange={handleChange}
          />
          Allow Players to Join After Game Starts
        </label>
      </div>
      
      <div className="form-section">
        <h3>Round Types</h3>
        <p className="form-help">Select which round types to include in this game</p>
        
        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              name="roundTypes.pointBuilder"
              checked={settings.roundTypes.pointBuilder}
              onChange={handleChange}
            />
            Point Builder (Standard points for correct answers)
          </label>
        </div>
        
        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              name="roundTypes.graduatedPoints"
              checked={settings.roundTypes.graduatedPoints}
              onChange={handleChange}
            />
            Graduated Points (Faster answers earn more points)
          </label>
        </div>
        
        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              name="roundTypes.fastestFinger"
              checked={settings.roundTypes.fastestFinger}
              onChange={handleChange}
            />
            Fastest Finger (Only first correct answer gets points)
          </label>
        </div>
        
        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              name="roundTypes.specialist"
              checked={settings.roundTypes.specialist}
              onChange={handleChange}
            />
            Specialist (Questions on players' specialist subjects)
          </label>
        </div>
      </div>
      
      <div className="form-actions">
        <button type="submit" className="create-button" disabled={isSubmitting}>
          {isSubmitting ? 'Creating Game...' : 'Create Game'}
        </button>
      </div>
    </form>
  );
};

export default GameSettingsForm;
