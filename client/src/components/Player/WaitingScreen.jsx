import React, { useState, useEffect } from 'react';
import './WaitingScreen.css';

/**
 * Waiting screen component for transitions between game states
 * @param {Object} props - Component props
 * @param {string} props.message - Main waiting message
 * @param {string} props.subMessage - Secondary message or instruction
 * @param {number} props.countdown - Countdown timer in seconds (0 for no countdown)
 * @param {function} props.onCountdownComplete - Callback when countdown reaches zero
 * @param {boolean} props.showSpinner - Whether to show the loading spinner
 */
const WaitingScreen = ({ 
  message = 'Please wait...', 
  subMessage = '', 
  countdown = 0,
  onCountdownComplete,
  showSpinner = true
}) => {
  const [timeRemaining, setTimeRemaining] = useState(countdown);
  
  // Handle countdown timer
  useEffect(() => {
    setTimeRemaining(countdown);
    
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            if (onCountdownComplete && typeof onCountdownComplete === 'function') {
              onCountdownComplete();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => clearInterval(timer);
  }, [countdown, onCountdownComplete]);

  return (
    <div className="waiting-screen">
      <div className="waiting-content">
        {showSpinner && (
          <div className="spinner-container">
            <div className="spinner"></div>
          </div>
        )}
        
        <h2 className="waiting-message">{message}</h2>
        
        {subMessage && (
          <p className="waiting-submessage">{subMessage}</p>
        )}
        
        {countdown > 0 && (
          <div className="countdown-timer">
            <div className="countdown-circle">
              <svg viewBox="0 0 100 100">
                <circle 
                  className="countdown-circle-bg" 
                  cx="50" 
                  cy="50" 
                  r="45"
                />
                <circle 
                  className="countdown-circle-progress" 
                  cx="50" 
                  cy="50" 
                  r="45"
                  style={{
                    strokeDashoffset: `${(1 - timeRemaining / countdown) * 283}`
                  }}
                />
              </svg>
              <div className="countdown-number">{timeRemaining}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WaitingScreen;
