import React, { useState, useEffect } from 'react';
import MultipleChoiceAnswers from './MultipleChoiceAnswers';
import PlayerScoreDisplay from './PlayerScoreDisplay';
import GameEventNotification from './GameEventNotification';
import WaitingScreen from './WaitingScreen';
import './PointBuilderRoundPlayer.css';

/**
 * Point Builder Round component for Player interface
 * Handles the player experience during a Point Builder round
 * @param {Object} props - Component props
 * @param {Object} props.socket - Socket.io socket instance
 * @param {Object} props.roundData - Current round data
 * @param {Object} props.playerData - Current player data
 * @param {function} props.onAnswerSubmit - Callback when answer is submitted
 */
const PointBuilderRoundPlayer = ({ 
  socket, 
  roundData, 
  playerData,
  onAnswerSubmit 
}) => {
  // Question state
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [options, setOptions] = useState([]);
  const [selectedAnswer, setSelectedAnswer] = useState(-1);
  const [correctAnswer, setCorrectAnswer] = useState(-1);
  const [showCorrect, setShowCorrect] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  
  // Round state
  const [roundStatus, setRoundStatus] = useState('waiting'); // waiting, question, answered, revealed, completed
  const [notification, setNotification] = useState({
    message: '',
    type: 'info',
    visible: false
  });
  const [waitingMessage, setWaitingMessage] = useState('Waiting for next question...');
  const [waitingSubMessage, setWaitingSubMessage] = useState('');
  
  // Score state
  const [score, setScore] = useState(playerData?.score || 0);
  const [recentPoints, setRecentPoints] = useState(null);
  
  // Settings
  const pointsPerQuestion = roundData?.settings?.pointsPerQuestion || 10;
  const timeLimit = roundData?.settings?.timeLimit || 30;
  
  // Handle new question from server
  useEffect(() => {
    if (!socket) return;
    
    const handleNewQuestion = (data) => {
      console.log('New question received:', data);
      
      setCurrentQuestion(data);
      setOptions(data.options || []);
      setSelectedAnswer(-1);
      setCorrectAnswer(-1);
      setShowCorrect(false);
      setHasAnswered(false);
      setIsRevealed(false);
      setTimeRemaining(data.timeLimit || timeLimit);
      setRoundStatus('question');
      
      showNotification('New Question!', 'info');
    };
    
    socket.on('question:new', handleNewQuestion);
    
    return () => {
      socket.off('question:new', handleNewQuestion);
    };
  }, [socket, timeLimit]);
  
  // Handle answer reveal from server
  useEffect(() => {
    if (!socket) return;
    
    const handleAnswerReveal = (data) => {
      console.log('Answer revealed:', data);
      
      setCorrectAnswer(data.correctIndex || 0);
      setShowCorrect(true);
      setIsRevealed(true);
      setRoundStatus('revealed');
      
      // Check if player's answer was correct
      const isCorrect = selectedAnswer === data.correctIndex;
      
      // Show notification
      showNotification(
        isCorrect ? 'Correct Answer!' : 'Incorrect Answer', 
        isCorrect ? 'success' : 'error'
      );
      
      // Update score if needed
      if (data.playerResults && data.playerResults[playerData?._id]) {
        const result = data.playerResults[playerData._id];
        if (result.pointsEarned) {
          setRecentPoints(result.pointsEarned);
          setScore(prev => prev + result.pointsEarned);
          
          // Clear recent points after animation
          setTimeout(() => {
            setRecentPoints(null);
          }, 2000);
        }
      }
    };
    
    socket.on('question:reveal', handleAnswerReveal);
    
    return () => {
      socket.off('question:reveal', handleAnswerReveal);
    };
  }, [socket, selectedAnswer, playerData]);
  
  // Handle round end from server
  useEffect(() => {
    if (!socket) return;
    
    const handleRoundEnd = (data) => {
      console.log('Round ended:', data);
      
      setRoundStatus('completed');
      setWaitingMessage('Round Completed');
      setWaitingSubMessage('Waiting for the next round to begin...');
      
      showNotification('Round Completed!', 'info');
    };
    
    socket.on('round:end', handleRoundEnd);
    
    return () => {
      socket.off('round:end', handleRoundEnd);
    };
  }, [socket]);
  
  // Handle timer updates
  useEffect(() => {
    if (!socket) return;
    
    const handleTimerUpdate = (data) => {
      if (data.questionId === currentQuestion?.id) {
        setTimeRemaining(data.timeRemaining);
      }
    };
    
    socket.on('question:timer', handleTimerUpdate);
    
    return () => {
      socket.off('question:timer', handleTimerUpdate);
    };
  }, [socket, currentQuestion]);
  
  // Handle local timer countdown
  useEffect(() => {
    if (roundStatus !== 'question' || hasAnswered || timeRemaining <= 0) return;
    
    const timer = setTimeout(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1));
      
      // Auto-submit when time runs out
      if (timeRemaining === 1 && !hasAnswered) {
        handleTimeUp();
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [roundStatus, hasAnswered, timeRemaining]);
  
  // Handle answer selection
  const handleAnswerSelect = (index) => {
    if (hasAnswered || isRevealed) return;
    
    setSelectedAnswer(index);
    setHasAnswered(true);
    setRoundStatus('answered');
    
    // Send answer to server
    if (socket && currentQuestion) {
      socket.emit('player:answer', {
        questionId: currentQuestion.id,
        answerIndex: index,
        timestamp: Date.now()
      });
      
      // Call the callback if provided
      if (onAnswerSubmit && typeof onAnswerSubmit === 'function') {
        onAnswerSubmit({
          questionId: currentQuestion.id,
          answerIndex: index,
          timestamp: Date.now()
        });
      }
    }
    
    showNotification('Answer Submitted!', 'success');
  };
  
  // Handle time up (no answer selected)
  const handleTimeUp = () => {
    if (hasAnswered || isRevealed) return;
    
    setHasAnswered(true);
    setRoundStatus('answered');
    
    // Send timeout to server
    if (socket && currentQuestion) {
      socket.emit('player:answer', {
        questionId: currentQuestion.id,
        answerIndex: -1, // No answer
        timestamp: Date.now(),
        timedOut: true
      });
      
      // Call the callback if provided
      if (onAnswerSubmit && typeof onAnswerSubmit === 'function') {
        onAnswerSubmit({
          questionId: currentQuestion.id,
          answerIndex: -1,
          timestamp: Date.now(),
          timedOut: true
        });
      }
    }
    
    showNotification('Time\'s Up!', 'warning');
  };
  
  // Show notification helper
  const showNotification = (message, type = 'info', duration = 3000) => {
    setNotification({
      message,
      type,
      visible: true
    });
    
    // Auto-hide notification
    if (duration > 0) {
      setTimeout(() => {
        setNotification(prev => ({ ...prev, visible: false }));
      }, duration);
    }
  };
  
  // Render based on round status
  const renderContent = () => {
    switch (roundStatus) {
      case 'waiting':
        return (
          <WaitingScreen
            message={waitingMessage}
            subMessage={waitingSubMessage}
            showSpinner={true}
          />
        );
        
      case 'question':
      case 'answered':
        return (
          <div className="question-container">
            <div className="question-header">
              <div className="question-points">
                <span className="points-value">{pointsPerQuestion}</span>
                <span className="points-label">points</span>
              </div>
              <div className="question-timer">
                <span className="timer-value">{timeRemaining}</span>
                <span className="timer-label">seconds</span>
              </div>
            </div>
            
            <div className="question-text">
              <h2>{currentQuestion?.text}</h2>
              {currentQuestion?.subText && <p>{currentQuestion.subText}</p>}
            </div>
            
            <MultipleChoiceAnswers
              options={options}
              onSelect={handleAnswerSelect}
              disabled={hasAnswered}
              selectedIndex={selectedAnswer}
              timeLimit={timeLimit}
            />
            
            {hasAnswered && (
              <div className="answer-status">
                <div className="status-icon">✓</div>
                <div className="status-text">Answer Submitted</div>
                <div className="status-subtext">Waiting for other players...</div>
              </div>
            )}
          </div>
        );
        
      case 'revealed':
        return (
          <div className="question-container">
            <div className="question-header">
              <div className="question-result">
                {selectedAnswer === correctAnswer ? (
                  <div className="result-correct">
                    <span className="result-icon">✓</span>
                    <span className="result-text">Correct!</span>
                    <span className="result-points">+{pointsPerQuestion} points</span>
                  </div>
                ) : (
                  <div className="result-incorrect">
                    <span className="result-icon">✗</span>
                    <span className="result-text">Incorrect</span>
                    <span className="result-points">+0 points</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="question-text">
              <h2>{currentQuestion?.text}</h2>
              {currentQuestion?.subText && <p>{currentQuestion.subText}</p>}
            </div>
            
            <MultipleChoiceAnswers
              options={options}
              disabled={true}
              selectedIndex={selectedAnswer}
              correctIndex={correctAnswer}
              showCorrect={true}
            />
            
            {currentQuestion?.explanation && (
              <div className="answer-explanation">
                <h3>Explanation:</h3>
                <p>{currentQuestion.explanation}</p>
              </div>
            )}
          </div>
        );
        
      case 'completed':
        return (
          <WaitingScreen
            message={waitingMessage}
            subMessage={waitingSubMessage}
            showSpinner={true}
          />
        );
        
      default:
        return (
          <div className="error-container">
            <h2>Unknown Round Status</h2>
            <p>Something went wrong. Please try refreshing the page.</p>
          </div>
        );
    }
  };
  
  return (
    <div className="point-builder-round-player">
      <PlayerScoreDisplay
        score={score}
        rank={playerData?.rank || 0}
        totalPlayers={playerData?.totalPlayers || 0}
        recentPoints={recentPoints}
      />
      
      <GameEventNotification
        message={notification.message}
        type={notification.type}
        visible={notification.visible}
        onClose={() => setNotification(prev => ({ ...prev, visible: false }))}
      />
      
      {renderContent()}
    </div>
  );
};

export default PointBuilderRoundPlayer;
