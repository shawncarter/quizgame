import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import './RoundSelectionPanel.css';

/**
 * Round Selection Panel
 * Allows the game master to select and configure game rounds
 */
const RoundSelectionPanel = ({ gameSession, currentRound, gameStatus }) => {
  const { updateGameSettings } = useGame();
  
  // Round types with descriptions
  const roundTypes = [
    {
      id: 'pointBuilder',
      title: 'Point Builder',
      description: 'Standard round with fixed points per question'
    },
    {
      id: 'graduated-points',
      title: 'Graduated Points',
      description: 'Faster responses earn more points'
    },
    {
      id: 'fastestFinger',
      title: 'Fastest Finger',
      description: 'First correct answer gets the most points'
    },
    {
      id: 'specialist',
      title: 'Specialist',
      description: 'Questions from players\' specialist subjects'
    }
  ];
  
  // State for new round configuration
  const [newRound, setNewRound] = useState({
    type: 'pointBuilder',
    title: '',
    description: '',
    timeLimit: 30
  });
  
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  
  // Check if game is in a state where rounds can be edited
  const canEditRounds = ['created', 'lobby'].includes(gameStatus);
  
  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    
    setNewRound(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) : value
    }));
  };
  
  // Handle round type selection
  const handleRoundTypeSelect = (typeId) => {
    setNewRound(prev => ({
      ...prev,
      type: typeId
    }));
  };
  
  // Handle form submission to add a new round
  const handleAddRound = async (e) => {
    e.preventDefault();
    
    if (!newRound.title.trim()) {
      setError('Round title is required');
      return;
    }
    
    try {
      setIsSaving(true);
      setError(null);
      
      // Get current rounds
      const currentRounds = gameSession.rounds || [];
      
      // Add new round
      const updatedRounds = [...currentRounds, {
        type: newRound.type,
        title: newRound.title,
        description: newRound.description,
        timeLimit: newRound.timeLimit,
        questions: [],
        completed: false
      }];
      
      // Update game settings
      await updateGameSettings({
        rounds: updatedRounds
      });
      
      // Reset form
      setNewRound({
        type: 'pointBuilder',
        title: '',
        description: '',
        timeLimit: 30
      });
      
      setIsAdding(false);
    } catch (err) {
      console.error('Error adding round:', err);
      setError('Failed to add round');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle editing an existing round
  const handleEditRound = (index) => {
    const round = gameSession.rounds[index];
    
    setNewRound({
      type: round.type,
      title: round.title,
      description: round.description || '',
      timeLimit: round.timeLimit || 30
    });
    
    setEditingIndex(index);
    setIsEditing(true);
    setIsAdding(false);
  };
  
  // Handle form submission to update an existing round
  const handleUpdateRound = async (e) => {
    e.preventDefault();
    
    if (!newRound.title.trim()) {
      setError('Round title is required');
      return;
    }
    
    try {
      setIsSaving(true);
      setError(null);
      
      // Get current rounds
      const currentRounds = [...gameSession.rounds];
      
      // Update round at index
      currentRounds[editingIndex] = {
        ...currentRounds[editingIndex],
        type: newRound.type,
        title: newRound.title,
        description: newRound.description,
        timeLimit: newRound.timeLimit
      };
      
      // Update game settings
      await updateGameSettings({
        rounds: currentRounds
      });
      
      // Reset form
      setNewRound({
        type: 'pointBuilder',
        title: '',
        description: '',
        timeLimit: 30
      });
      
      setIsEditing(false);
      setEditingIndex(null);
    } catch (err) {
      console.error('Error updating round:', err);
      setError('Failed to update round');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle removing a round
  const handleRemoveRound = async (index) => {
    try {
      setIsSaving(true);
      setError(null);
      
      // Get current rounds
      const currentRounds = [...gameSession.rounds];
      
      // Remove round at index
      currentRounds.splice(index, 1);
      
      // Update game settings
      await updateGameSettings({
        rounds: currentRounds
      });
    } catch (err) {
      console.error('Error removing round:', err);
      setError('Failed to remove round');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Cancel adding/editing
  const handleCancel = () => {
    setNewRound({
      type: 'pointBuilder',
      title: '',
      description: '',
      timeLimit: 30
    });
    
    setIsAdding(false);
    setIsEditing(false);
    setEditingIndex(null);
    setError(null);
  };
  
  // Render round form (for adding or editing)
  const renderRoundForm = () => (
    <form onSubmit={isEditing ? handleUpdateRound : handleAddRound} className="round-form">
      <div className="form-group">
        <label htmlFor="title">Round Title:</label>
        <input
          type="text"
          id="title"
          name="title"
          value={newRound.title}
          onChange={handleChange}
          disabled={isSaving}
          placeholder="e.g., General Knowledge"
          required
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="description">Description (optional):</label>
        <textarea
          id="description"
          name="description"
          value={newRound.description}
          onChange={handleChange}
          disabled={isSaving}
          placeholder="Brief description of the round"
          rows="2"
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="timeLimit">Time Limit (seconds):</label>
        <input
          type="number"
          id="timeLimit"
          name="timeLimit"
          value={newRound.timeLimit}
          onChange={handleChange}
          min="5"
          max="120"
          disabled={isSaving}
        />
      </div>
      
      <div className="form-group">
        <label>Round Type:</label>
        <div className="round-types">
          {roundTypes.map(type => (
            <div
              key={type.id}
              className={`round-type-option ${newRound.type === type.id ? 'selected' : ''}`}
              onClick={() => handleRoundTypeSelect(type.id)}
            >
              <div className="round-type-name">{type.title}</div>
              <div className="round-type-description">{type.description}</div>
            </div>
          ))}
        </div>
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
          {isSaving ? 'Saving...' : isEditing ? 'Update Round' : 'Add Round'}
        </button>
      </div>
    </form>
  );
  
  return (
    <div className="round-selection-panel">
      <div className="panel-header">
        <h2>Game Rounds</h2>
        {!isAdding && !isEditing && canEditRounds && (
          <button 
            onClick={() => setIsAdding(true)}
            className="add-button"
          >
            Add Round
          </button>
        )}
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {(isAdding || isEditing) ? (
        renderRoundForm()
      ) : (
        <div className="rounds-list">
          {gameSession?.rounds?.length > 0 ? (
            gameSession.rounds.map((round, index) => (
              <div 
                key={index} 
                className={`round-item ${currentRound && currentRound.title === round.title ? 'current' : ''} ${round.completed ? 'completed' : ''}`}
              >
                <div className="round-info">
                  <div className="round-title">
                    {index + 1}. {round.title}
                    {round.completed && <span className="completed-badge">Completed</span>}
                    {currentRound && currentRound.title === round.title && <span className="current-badge">Current</span>}
                  </div>
                  <div className="round-details">
                    <span className="round-type">
                      {roundTypes.find(t => t.id === round.type)?.title || round.type}
                    </span>
                    <span className="round-time">
                      {round.timeLimit || 30}s per question
                    </span>
                  </div>
                  {round.description && (
                    <div className="round-description">{round.description}</div>
                  )}
                </div>
                
                {canEditRounds && !round.completed && (
                  <div className="round-actions">
                    <button 
                      onClick={() => handleEditRound(index)}
                      className="edit-round-button"
                      disabled={isSaving}
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleRemoveRound(index)}
                      className="remove-round-button"
                      disabled={isSaving}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="no-rounds">
              <p>No rounds configured yet.</p>
              {canEditRounds && (
                <button 
                  onClick={() => setIsAdding(true)}
                  className="add-button"
                >
                  Add First Round
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RoundSelectionPanel;
