import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import './GameConfigPanel.css';

/**
 * Game Configuration Panel
 * Allows the game master to configure game settings
 */
const GameConfigPanel = ({ gameSession, gameStatus }) => {
  const { updateGameSettings } = useGame();
  
  // Initialize form state with current settings
  const [settings, setSettings] = useState({
    maxPlayers: gameSession?.settings?.maxPlayers || 10,
    publicGame: gameSession?.settings?.publicGame !== undefined ? gameSession.settings.publicGame : true,
    allowJoinAfterStart: gameSession?.settings?.allowJoinAfterStart !== undefined ? gameSession.settings.allowJoinAfterStart : false,
    questionPoolSize: gameSession?.settings?.questionPoolSize || 30
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  
  // Check if game is in a state where settings can be edited
  const canEditSettings = ['created', 'lobby'].includes(gameStatus);
  
  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value, 10) : value
    }));
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setIsSaving(true);
      setError(null);
      
      // Update game settings
      await updateGameSettings({
        settings
      });
      
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating game settings:', err);
      setError('Failed to update game settings');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Cancel editing
  const handleCancel = () => {
    // Reset to current game settings
    setSettings({
      maxPlayers: gameSession?.settings?.maxPlayers || 10,
      publicGame: gameSession?.settings?.publicGame !== undefined ? gameSession.settings.publicGame : true,
      allowJoinAfterStart: gameSession?.settings?.allowJoinAfterStart !== undefined ? gameSession.settings.allowJoinAfterStart : false,
      questionPoolSize: gameSession?.settings?.questionPoolSize || 30
    });
    
    setIsEditing(false);
    setError(null);
  };
  
  return (
    <div className="game-config-panel">
      <div className="panel-header">
        <h2>Game Configuration</h2>
        {!isEditing && canEditSettings && (
          <button 
            onClick={() => setIsEditing(true)}
            className="edit-button"
          >
            Edit
          </button>
        )}
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {isEditing ? (
        <form onSubmit={handleSubmit} className="settings-form">
          <div className="form-group">
            <label htmlFor="maxPlayers">Max Players:</label>
            <input
              type="number"
              id="maxPlayers"
              name="maxPlayers"
              value={settings.maxPlayers}
              onChange={handleChange}
              min="1"
              max="50"
              disabled={isSaving}
            />
          </div>
          
          <div className="form-group checkbox">
            <label htmlFor="publicGame">
              <input
                type="checkbox"
                id="publicGame"
                name="publicGame"
                checked={settings.publicGame}
                onChange={handleChange}
                disabled={isSaving}
              />
              Public Game
            </label>
          </div>
          
          <div className="form-group checkbox">
            <label htmlFor="allowJoinAfterStart">
              <input
                type="checkbox"
                id="allowJoinAfterStart"
                name="allowJoinAfterStart"
                checked={settings.allowJoinAfterStart}
                onChange={handleChange}
                disabled={isSaving}
              />
              Allow Join After Start
            </label>
          </div>
          
          <div className="form-group">
            <label htmlFor="questionPoolSize">Question Pool Size:</label>
            <input
              type="number"
              id="questionPoolSize"
              name="questionPoolSize"
              value={settings.questionPoolSize}
              onChange={handleChange}
              min="10"
              max="100"
              disabled={isSaving}
            />
          </div>
          
          <div className="form-actions">
            <button
              type="button"
              onClick={handleCancel}
              className="cancel-button"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="save-button"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      ) : (
        <div className="settings-display">
          <div className="setting-item">
            <span className="setting-label">Max Players:</span>
            <span className="setting-value">{gameSession?.settings?.maxPlayers || 10}</span>
          </div>
          
          <div className="setting-item">
            <span className="setting-label">Public Game:</span>
            <span className="setting-value">
              {gameSession?.settings?.publicGame ? 'Yes' : 'No'}
            </span>
          </div>
          
          <div className="setting-item">
            <span className="setting-label">Allow Join After Start:</span>
            <span className="setting-value">
              {gameSession?.settings?.allowJoinAfterStart ? 'Yes' : 'No'}
            </span>
          </div>
          
          <div className="setting-item">
            <span className="setting-label">Question Pool Size:</span>
            <span className="setting-value">{gameSession?.settings?.questionPoolSize || 30}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameConfigPanel;
