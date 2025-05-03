import React, { useState, useEffect } from 'react';
import './GameEventNotification.css';

/**
 * Game event notification component
 * @param {Object} props - Component props
 * @param {string} props.message - Notification message
 * @param {string} props.type - Notification type (info, success, warning, error)
 * @param {number} props.duration - Duration in milliseconds (0 for persistent)
 * @param {boolean} props.visible - Whether the notification is visible
 * @param {function} props.onClose - Callback function when notification is closed
 */
const GameEventNotification = ({ 
  message = '', 
  type = 'info', 
  duration = 3000, 
  visible = false,
  onClose
}) => {
  const [isVisible, setIsVisible] = useState(visible);
  
  // Handle visibility changes
  useEffect(() => {
    setIsVisible(visible);
    
    let timer;
    if (visible && duration > 0) {
      timer = setTimeout(() => {
        setIsVisible(false);
        if (onClose && typeof onClose === 'function') {
          onClose();
        }
      }, duration);
    }
    
    return () => clearTimeout(timer);
  }, [visible, duration, onClose]);
  
  // Handle close button click
  const handleClose = () => {
    setIsVisible(false);
    if (onClose && typeof onClose === 'function') {
      onClose();
    }
  };
  
  // Get icon based on notification type
  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M0 0h24v24H0V0z" fill="none"/>
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          </svg>
        );
      case 'warning':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M0 0h24v24H0V0z" fill="none"/>
            <path d="M12 5.99L19.53 19H4.47L12 5.99M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z"/>
          </svg>
        );
      case 'error':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M0 0h24v24H0V0z" fill="none"/>
            <path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
          </svg>
        );
      default: // info
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M0 0h24v24H0V0z" fill="none"/>
            <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
          </svg>
        );
    }
  };
  
  if (!isVisible) return null;
  
  return (
    <div className={`game-notification ${type}`}>
      <div className="notification-icon">
        {getIcon()}
      </div>
      <div className="notification-content">
        {message}
      </div>
      {duration === 0 && (
        <button className="notification-close" onClick={handleClose} aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M0 0h24v24H0V0z" fill="none"/>
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
          </svg>
        </button>
      )}
    </div>
  );
};

export default GameEventNotification;
