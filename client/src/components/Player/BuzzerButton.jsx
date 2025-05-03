import React, { useState, useEffect } from 'react';
import './BuzzerButton.css';

/**
 * Buzzer button component for players to buzz in during quiz games
 * @param {Object} props - Component props
 * @param {boolean} props.disabled - Whether the buzzer is disabled
 * @param {boolean} props.active - Whether the buzzer is currently active/available
 * @param {function} props.onBuzz - Callback function when buzzer is pressed
 * @param {string} props.soundEffect - Path to sound effect file (optional)
 */
const BuzzerButton = ({ 
  disabled = false, 
  active = true, 
  onBuzz, 
  soundEffect = '/sounds/buzzer.mp3',
  size = 'large' 
}) => {
  const [pressed, setPressed] = useState(false);
  const [audio] = useState(new Audio(soundEffect));
  const [feedback, setFeedback] = useState('');

  // Reset pressed state after animation completes
  useEffect(() => {
    let timer;
    if (pressed) {
      timer = setTimeout(() => {
        setPressed(false);
      }, 300);
    }
    return () => clearTimeout(timer);
  }, [pressed]);

  // Handle buzzer press
  const handleBuzz = () => {
    if (disabled || !active) return;
    
    setPressed(true);
    
    // Play sound effect if available
    if (soundEffect) {
      audio.currentTime = 0;
      audio.play().catch(err => console.error('Error playing buzzer sound:', err));
    }
    
    // Show visual feedback
    setFeedback('Buzzed!');
    setTimeout(() => setFeedback(''), 1500);
    
    // Call the callback function
    if (onBuzz && typeof onBuzz === 'function') {
      onBuzz();
    }
  };

  // Determine button classes based on state
  const buttonClasses = [
    'buzzer-button',
    size,
    pressed ? 'pressed' : '',
    disabled ? 'disabled' : '',
    active ? 'active' : 'inactive'
  ].filter(Boolean).join(' ');

  return (
    <div className="buzzer-container">
      <button 
        className={buttonClasses}
        onClick={handleBuzz}
        disabled={disabled || !active}
        aria-label="Buzzer"
      >
        <span className="buzzer-text">BUZZ</span>
      </button>
      {feedback && <div className="buzzer-feedback">{feedback}</div>}
    </div>
  );
};

export default BuzzerButton;
