import React, { useState, useEffect } from 'react';
import './QuestionDisplayPanel.css';

/**
 * Question Display Panel
 * Displays the current question and answer options
 * Suitable for sharing on large screens
 */
const QuestionDisplayPanel = ({ currentQuestion, currentRound, gameStatus }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  
  // Set up timer when question changes
  useEffect(() => {
    if (currentQuestion && gameStatus === 'active' && !showAnswer) {
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
  }, [currentQuestion, currentRound, gameStatus, showAnswer]);
  
  // Reset show answer when question changes
  useEffect(() => {
    setShowAnswer(false);
  }, [currentQuestion]);
  
  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    const displayElement = document.getElementById('question-display');
    
    if (!fullscreen) {
      if (displayElement.requestFullscreen) {
        displayElement.requestFullscreen();
      } else if (displayElement.mozRequestFullScreen) {
        displayElement.mozRequestFullScreen();
      } else if (displayElement.webkitRequestFullscreen) {
        displayElement.webkitRequestFullscreen();
      } else if (displayElement.msRequestFullscreen) {
        displayElement.msRequestFullscreen();
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
  
  // Listen for fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(
        document.fullscreenElement ||
        document.mozFullScreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
      );
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);
  
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
      <div className="question-options">
        {currentQuestion.options.map((option, index) => {
          const isCorrect = currentQuestion.correctAnswer === option || 
                           (Array.isArray(currentQuestion.correctAnswer) && 
                            currentQuestion.correctAnswer.includes(option));
          
          return (
            <div 
              key={index} 
              className={`question-option ${showAnswer && isCorrect ? 'correct' : ''}`}
            >
              <div className="option-letter">{String.fromCharCode(65 + index)}</div>
              <div className="option-text">{option}</div>
              {showAnswer && isCorrect && <div className="correct-indicator">✓</div>}
            </div>
          );
        })}
      </div>
    );
  };
  
  // Render true/false options
  const renderTrueFalse = () => {
    const correctAnswer = currentQuestion.correctAnswer === true || 
                         currentQuestion.correctAnswer === 'true' || 
                         currentQuestion.correctAnswer === 'True';
    
    return (
      <div className="question-options true-false">
        <div 
          className={`question-option ${showAnswer && correctAnswer ? 'correct' : ''}`}
        >
          <div className="option-letter">T</div>
          <div className="option-text">True</div>
          {showAnswer && correctAnswer && <div className="correct-indicator">✓</div>}
        </div>
        <div 
          className={`question-option ${showAnswer && !correctAnswer ? 'correct' : ''}`}
        >
          <div className="option-letter">F</div>
          <div className="option-text">False</div>
          {showAnswer && !correctAnswer && <div className="correct-indicator">✓</div>}
        </div>
      </div>
    );
  };
  
  // Render short answer
  const renderShortAnswer = () => {
    return (
      <div className="short-answer">
        {showAnswer ? (
          <div className="answer-display">
            <div className="answer-label">Answer:</div>
            <div className="answer-text">{currentQuestion.correctAnswer}</div>
          </div>
        ) : (
          <div className="answer-placeholder">
            Short Answer Question
          </div>
        )}
      </div>
    );
  };
  
  // Determine question type and render appropriate options
  const renderQuestionContent = () => {
    if (!currentQuestion) return null;
    
    if (currentQuestion.type === 'multiple-choice') {
      return renderOptions();
    } else if (currentQuestion.type === 'true-false') {
      return renderTrueFalse();
    } else {
      return renderShortAnswer();
    }
  };
  
  // If no question, show placeholder
  if (!currentQuestion) {
    return (
      <div className="question-display-panel">
        <div className="panel-header">
          <h2>Current Question</h2>
        </div>
        <div className="no-question">
          <p>No active question</p>
          {currentRound ? (
            <p className="hint">Start the round to display questions</p>
          ) : (
            <p className="hint">Configure and start a round to display questions</p>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className="question-display-panel">
      <div className="panel-header">
        <h2>Current Question</h2>
        <div className="display-controls">
          <button
            onClick={() => setShowAnswer(!showAnswer)}
            className={`answer-toggle ${showAnswer ? 'active' : ''}`}
          >
            {showAnswer ? 'Hide Answer' : 'Show Answer'}
          </button>
          <button
            onClick={toggleFullscreen}
            className="fullscreen-button"
          >
            {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </div>
      
      <div id="question-display" className={`question-display ${fullscreen ? 'fullscreen' : ''}`}>
        {currentRound && (
          <div className="round-info">
            <span className="round-title">{currentRound.title}</span>
            <span className="round-type">
              {currentRound.type.charAt(0).toUpperCase() + currentRound.type.slice(1)}
            </span>
          </div>
        )}
        
        <div className="question-number">
          Question {currentQuestion.questionNumber || 1}
        </div>
        
        <div className="question-text">
          {currentQuestion.text}
        </div>
        
        {renderQuestionContent()}
        
        <div className={`question-timer ${getTimerClass()}`}>
          {formatTimeLeft()}
        </div>
      </div>
    </div>
  );
};

export default QuestionDisplayPanel;
