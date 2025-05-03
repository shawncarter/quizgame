import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../../context/PlayerContext';
import './PlayerRegistrationForm.css';

/**
 * Player registration form component
 * Allows new players to register with name, age, and specialist subject
 */
const PlayerRegistrationForm = () => {
  const navigate = useNavigate();
  const { registerPlayer, isLoggedIn, loading, error } = usePlayer();
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    specialistSubject: '',
    avatar: 'default-avatar',
    buzzerSound: 'default-buzzer'
  });
  
  // Validation state
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Available avatars (placeholders for now)
  const avatars = [
    { id: 'default-avatar', name: 'Default Avatar' },
    { id: 'avatar-1', name: 'Avatar 1' },
    { id: 'avatar-2', name: 'Avatar 2' },
    { id: 'avatar-3', name: 'Avatar 3' }
  ];
  
  // Available buzzer sounds (placeholders for now)
  const buzzerSounds = [
    { id: 'default-buzzer', name: 'Default Buzzer' },
    { id: 'buzzer-1', name: 'Buzzer 1' },
    { id: 'buzzer-2', name: 'Buzzer 2' },
    { id: 'buzzer-3', name: 'Buzzer 3' }
  ];
  
  // Redirect if already logged in
  useEffect(() => {
    if (isLoggedIn) {
      navigate('/');
    }
  }, [isLoggedIn, navigate]);
  
  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prevErrors => ({
        ...prevErrors,
        [name]: null
      }));
    }
  };
  
  // Validate form data
  const validateForm = () => {
    const newErrors = {};
    
    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    
    // Age validation
    if (!formData.age) {
      newErrors.age = 'Age is required';
    } else {
      const ageNum = parseInt(formData.age, 10);
      if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
        newErrors.age = 'Age must be between 1 and 120';
      }
    }
    
    // Specialist subject validation
    if (!formData.specialistSubject.trim()) {
      newErrors.specialistSubject = 'Specialist subject is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Convert age to number
      const playerData = {
        ...formData,
        age: parseInt(formData.age, 10)
      };
      
      await registerPlayer(playerData);
      navigate('/');
    } catch (err) {
      console.error('Registration error:', err);
      // Handle specific error cases
      if (err.response?.status === 400) {
        setErrors(prevErrors => ({
          ...prevErrors,
          form: err.response.data.message || 'Registration failed'
        }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Play buzzer sound sample
  const playBuzzerSound = (soundId) => {
    // Placeholder for actual sound playing functionality
    console.log(`Playing buzzer sound: ${soundId}`);
    // In a real implementation, this would play an audio file
  };
  
  return (
    <div className="player-registration-container">
      <h2>Player Registration</h2>
      
      {error && <div className="error-message">{error}</div>}
      {errors.form && <div className="error-message">{errors.form}</div>}
      
      <form onSubmit={handleSubmit} className="registration-form">
        <div className="form-group">
          <label htmlFor="name">Name:</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            disabled={isSubmitting || loading}
            className={errors.name ? 'error' : ''}
          />
          {errors.name && <div className="error-text">{errors.name}</div>}
        </div>
        
        <div className="form-group">
          <label htmlFor="age">Age:</label>
          <input
            type="number"
            id="age"
            name="age"
            value={formData.age}
            onChange={handleChange}
            min="1"
            max="120"
            disabled={isSubmitting || loading}
            className={errors.age ? 'error' : ''}
          />
          {errors.age && <div className="error-text">{errors.age}</div>}
        </div>
        
        <div className="form-group">
          <label htmlFor="specialistSubject">Specialist Subject:</label>
          <input
            type="text"
            id="specialistSubject"
            name="specialistSubject"
            value={formData.specialistSubject}
            onChange={handleChange}
            disabled={isSubmitting || loading}
            className={errors.specialistSubject ? 'error' : ''}
            placeholder="e.g., History, Science, Movies"
          />
          {errors.specialistSubject && (
            <div className="error-text">{errors.specialistSubject}</div>
          )}
        </div>
        
        <div className="form-group">
          <label>Select Avatar:</label>
          <div className="avatar-selection">
            {avatars.map(avatar => (
              <div
                key={avatar.id}
                className={`avatar-option ${formData.avatar === avatar.id ? 'selected' : ''}`}
                onClick={() => setFormData({ ...formData, avatar: avatar.id })}
              >
                <div className="avatar-image">{avatar.name}</div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="form-group">
          <label>Select Buzzer Sound:</label>
          <div className="buzzer-selection">
            {buzzerSounds.map(buzzer => (
              <div
                key={buzzer.id}
                className={`buzzer-option ${formData.buzzerSound === buzzer.id ? 'selected' : ''}`}
                onClick={() => setFormData({ ...formData, buzzerSound: buzzer.id })}
              >
                <div className="buzzer-name">{buzzer.name}</div>
                <button
                  type="button"
                  className="play-sound-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    playBuzzerSound(buzzer.id);
                  }}
                >
                  Play
                </button>
              </div>
            ))}
          </div>
        </div>
        
        <div className="form-actions">
          <button
            type="submit"
            disabled={isSubmitting || loading}
            className="submit-button"
          >
            {isSubmitting ? 'Registering...' : 'Register'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PlayerRegistrationForm;
