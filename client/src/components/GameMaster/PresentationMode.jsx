import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import './PresentationMode.css';

/**
 * Presentation Mode Component
 * Displays questions on large screens for audience viewing
 */
const PresentationMode = () => {
  const { id: gameId } = useParams();
  const { 
    gameSession, 
    currentRound, 
    currentQuestion,
    gameStatus,
    error,
    isConnected,
    connectToGame
  } = useGame();
  
  const [showAnswers, setShowAnswers] = useState(false);
  const [showResponses, setShowResponses] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [responses, setResponses] = useState([]);
  
  // Connect to the game session on mount
  useEffect(() => {
    if (gameId) {
      connectToGame(gameId);
    }
  }, [gameId, connectToGame]);
  
  // Set up timer when question changes
  useEffect(() => {
    if (currentQuestion && gameStatus === 'active' && !showAnswers) {
      const timeLimit = currentRound?.timeLimit || 30;
      setTimeLeft(timeLimit);
      
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [currentQuestion, currentRound, gameStatus, showAnswers]);
  
  // Reset states when question changes
  useEffect(() => {
    if (currentQuestion) {
      setShowAnswers(false);
      setShowResponses(false);
      setResponses([]);
    }
  }, [currentQuestion]);
  
  // Handle keyboard shortcuts
  const handleKeyPress = (e) => {
    if (e.key === 'a') setShowAnswers(!showAnswers);
    if (e.key === 'r') setShowResponses(!showResponses);
    if (e.key === 'f') toggleFullscreen();
  };
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showAnswers, showResponses]);
  
  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    const element = document.documentElement;
    
    if (!document.fullscreenElement) {
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
      } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
      } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };
  
  // Format time left
  const formatTimeLeft = () => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Get timer class based on time left
  const getTimerClass = () => {
    if (timeLeft <= 5) return 'timer-critical';
    if (timeLeft <= 10) return 'timer-warning';
    return '';
  };
  
  // Render multiple choice options
  const renderOptions = () => {
    if (!currentQuestion || !currentQuestion.options || currentQuestion.options.length === 0) {
      return null;
    }
    
    return (
      <div className="presentation-options">
        {currentQuestion.options.map((option, index) => {
          const isCorrect = currentQuestion.correctAnswer === option || 
                           (Array.isArray(currentQuestion.correctAnswer) && 
                            currentQuestion.correctAnswer.includes(option));
          
          return (
            <div 
              key={index} 
              className={`presentation-option ${showAnswers && isCorrect ? 'correct' : ''}`}
            >
              <div className="option-letter">{String.fromCharCode(65 + index)}</div>
              <div className="option-text">{option}</div>
              {showAnswers && isCorrect && <div className="correct-indicator">✓</div>}
            </div>
          );
        })}
      </div>
    );
  };
  
  // Render response distribution
  const renderResponseDistribution = () => {
    if (!showResponses || !responses || responses.length === 0) {
      return null;
    }
    
    // Count responses by option
    const counts = {};
    responses.forEach(response => {
      counts[response.answer] = (counts[response.answer] || 0) + 1;
    });
    
    // Calculate percentages
    const total = responses.length;
    const percentages = {};
    Object.keys(counts).forEach(option => {
      percentages[option] = Math.round((counts[option] / total) * 100);
    });
    
    return (
      <div className="response-distribution">
        <h3>Response Distribution</h3>
        <div className="distribution-bars">
          {Object.keys(percentages).map((option, index) => (
            <div key={index} className="distribution-bar-container">
              <div className="option-label">{option}</div>
              <div className="distribution-bar-wrapper">
                <div 
                  className="distribution-bar" 
                  style={{ width: `${percentages[option]}%` }}
                >
                  {percentages[option]}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Show loading state
  if (!gameSession && gameStatus === 'loading') {
    return (
      <div className="presentation-loading">
        <h2>Loading Game Session...</h2>
        <div className="loading-spinner"></div>
      </div>
    );
  }
  
  // Show error state
  if (error) {
    return (
      <div className="presentation-error">
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }
  
  // Show disconnected state
  if (!isConnected && gameSession) {
    return (
      <div className="presentation-disconnected">
        <h2>Disconnected from Game Server</h2>
        <p>The connection to the game server has been lost.</p>
      </div>
    );
  }
  
  // Show no question state
  if (!currentQuestion) {
    return (
      <div className="presentation-waiting">
        <div className="game-code">
          <h2>Game Code</h2>
          <div className="code">{gameSession?.code || 'Loading...'}</div>
          <p className="join-instructions">Join at quizgame.app</p>
        </div>
        
        {currentRound ? (
          <div className="round-info">
            <h3>Next Round</h3>
            <p>{currentRound.title}</p>
          </div>
        ) : (
          <div className="waiting-message">
            <p>Waiting for the game to start...</p>
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className="presentation-mode">
      {currentRound && (
        <div className="presentation-header">
          <div className="round-title">{currentRound.title}</div>
          <div className="question-number">Question {currentQuestion.questionNumber || 1}</div>
        </div>
      )}
      
      <div className="presentation-question">
        <h1>{currentQuestion.text}</h1>
        
        {currentQuestion.image && (
          <div className="question-image">
            <img src={currentQuestion.image} alt="Question" />
          </div>
        )}
      </div>
      
      {renderOptions()}
      
      {renderResponseDistribution()}
      
      <div className={`presentation-timer ${getTimerClass()}`}>
        {formatTimeLeft()}
      </div>
      
      <div className="presentation-controls">
        <button onClick={() => setShowAnswers(!showAnswers)}>
          {showAnswers ? 'Hide Answers' : 'Show Answers'}
        </button>
        <button onClick={() => setShowResponses(!showResponses)}>
          {showResponses ? 'Hide Responses' : 'Show Responses'}
        </button>
        <button onClick={toggleFullscreen}>
          Toggle Fullscreen
        </button>
      </div>
      
      <div className="keyboard-shortcuts">
        <p>Keyboard Shortcuts: [A] Show/Hide Answers • [R] Show/Hide Responses • [F] Toggle Fullscreen</p>
      </div>
    </div>
  );
};

export default PresentationMode;
