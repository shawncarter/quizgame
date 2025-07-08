import React, { useState } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import './RegistrationPrompt.css';

/**
 * Registration Prompt Component
 * Shows a modal-style prompt for new users to register
 */
const RegistrationPrompt = ({ onClose, onRegister, gameCode = null }) => {
  const [formData, setFormData] = useState({
    name: '',
    age: 25,
    specialistSubject: 'General Knowledge'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { registerPlayer } = usePlayer();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Please enter your name');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      // Register the player
      await registerPlayer({
        ...formData,
        age: parseInt(formData.age, 10),
        avatar: 'default-avatar',
        buzzerSound: 'default-buzzer'
      });

      // Call the onRegister callback if provided
      if (onRegister) {
        onRegister(formData);
      }

      // Close the prompt
      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.message || 'Failed to register. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="registration-prompt-overlay">
      <div className="registration-prompt">
        <div className="prompt-header">
          <h2>Welcome to QuizGame!</h2>
          <p>
            {gameCode 
              ? `To join game ${gameCode}, please create your player profile:`
              : 'Please create your player profile to continue:'
            }
          </p>
        </div>

        {error && (
          <div className="prompt-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="prompt-form">
          <div className="form-group">
            <label htmlFor="name">Your Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter your name"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="age">Age</label>
            <input
              type="number"
              id="age"
              name="age"
              value={formData.age}
              onChange={handleInputChange}
              min="13"
              max="100"
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="specialistSubject">Specialist Subject</label>
            <select
              id="specialistSubject"
              name="specialistSubject"
              value={formData.specialistSubject}
              onChange={handleInputChange}
              disabled={isSubmitting}
            >
              <option value="General Knowledge">General Knowledge</option>
              <option value="Science">Science</option>
              <option value="History">History</option>
              <option value="Sports">Sports</option>
              <option value="Movies">Movies & TV</option>
              <option value="Music">Music</option>
              <option value="Literature">Literature</option>
              <option value="Geography">Geography</option>
              <option value="Art">Art</option>
              <option value="Technology">Technology</option>
            </select>
          </div>

          <div className="prompt-actions">
            <button
              type="submit"
              className="register-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating Profile...' : 'Create Profile'}
            </button>
            
            {onClose && (
              <button
                type="button"
                className="cancel-button"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="prompt-footer">
          <p className="privacy-note">
            Your profile is stored locally on this device and linked to your unique device ID.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegistrationPrompt;
