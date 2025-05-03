import React from 'react';
import { Link } from 'react-router-dom';
import './GameSessionInfo.css';

/**
 * Game Session Info Component
 * Displays basic information about the game session
 */
const GameSessionInfo = ({ gameSession }) => {
  if (!gameSession) return null;
  
  const { _id, code, status, players, createdAt, startedAt, endedAt } = gameSession;
  
  // Format dates
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  // Get game duration
  const getDuration = () => {
    if (!startedAt) return 'Not started';
    
    const start = new Date(startedAt);
    const end = endedAt ? new Date(endedAt) : new Date();
    const durationMs = end - start;
    
    // Format duration as mm:ss or hh:mm:ss
    const seconds = Math.floor((durationMs / 1000) % 60);
    const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Get status class
  const getStatusClass = () => {
    switch (status) {
      case 'created':
        return 'status-created';
      case 'lobby':
        return 'status-lobby';
      case 'active':
        return 'status-active';
      case 'paused':
        return 'status-paused';
      case 'completed':
        return 'status-completed';
      default:
        return '';
    }
  };
  
  return (
    <div className="game-session-info">
      <div className="game-session-header">
        <h1>Game Master Dashboard</h1>
        <div className={`game-status ${getStatusClass()}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </div>
      </div>
      
      <div className="game-session-details">
        <div className="detail-item">
          <span className="detail-label">Game Code:</span>
          <span className="detail-value highlight">{code}</span>
        </div>
        
        <div className="detail-item">
          <span className="detail-label">Players:</span>
          <span className="detail-value">{players ? players.length : 0}</span>
        </div>
        
        <div className="detail-item">
          <span className="detail-label">Created:</span>
          <span className="detail-value">{formatDate(createdAt)}</span>
        </div>
        
        <div className="detail-item">
          <span className="detail-label">Duration:</span>
          <span className="detail-value">{getDuration()}</span>
        </div>
        
        <div className="detail-item">
          <span className="detail-label">QR Code:</span>
          <Link to={`/qr-code/${_id}`} className="qr-code-link" target="_blank">
            View QR Code
          </Link>
        </div>
      </div>
    </div>
  );
};

export default GameSessionInfo;
