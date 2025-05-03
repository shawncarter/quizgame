import React, { useState, useEffect } from 'react';
import MultipleChoiceAnswers from './MultipleChoiceAnswers';
import PlayerScoreDisplay from './PlayerScoreDisplay';
import GameEventNotification from './GameEventNotification';
import WaitingScreen from './WaitingScreen';
import './GraduatedPointsRoundPlayer.css';

/**
 * Graduated Points Round component for Player interface
 * Handles the player experience during a Graduated Points round
 * where faster responses earn more points
 * @param {Object} props - Component props
 * @param {Object} props.socket - Socket.io socket instance
 * @param {Object} props.roundData - Current round data
 * @param {Object} props.playerData - Current player data
 * @param {function} props.onAnswerSubmit - Callback when answer is submitted
 */
const GraduatedPointsRoundPlayer = ({ 
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
  const [responseStartTime, setResponseStartTime] = useState(null);
  
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
  const [isFastest, setIsFastest] = useState(false);
  
  // Points visualization
  const [currentPointValue, setCurrentPointValue] = useState(0);
  const [earnedPoints, setEarnedPoints] = useState(null);
  
  // Settings
  const maxPoints = roundData?.settings?.maxPoints || 20;
  const minPoints = roundData?.settings?.minPoints || 5;
  const decreaseRate = roundData?.settings?.decreaseRate || 0.5; // points per second
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
      setResponseStartTime(Date.now());
      setCurrentPointValue(maxPoints);
      setEarnedPoints(null);
      setIsFastest(false);
      
      showNotification('New Question!', 'info');
    };
    
    socket.on('question:new', handleNewQuestion);
    
    return () => {
      socket.off('question:new', handleNewQuestion);
    };
  }, [socket, timeLimit, maxPoints]);
  
  // Handle answer reveal from server
  useEffect(() => {
    if (!socket) return;
    
    const handleAnswerReveal = (data) => {
      console.log('Answer revealed:', data);
      
      setCorrectAnswer(data.correctIndex || 0);
      setShowCorrect(true);
      setIsRevealed(true);
      setRoundStatus('revealed');
      
      // Check if player's answer was correct and if they were fastest
      const isCorrect = selectedAnswer === data.correctIndex;
      const wasFastest = data.fastestPlayerId === playerData?._id;
      
      if (wasFastest) {
        setIsFastest(true);
        showNotification('Fastest Correct Answer! 🏆', 'success');
      } else {
        // Show notification
        showNotification(
          isCorrect ? 'Correct Answer!' : 'Incorrect Answer', 
          isCorrect ? 'success' : 'error'
        );
      }
      
      // Update score if needed
      if (data.playerResults && data.playerResults[playerData?._id]) {
        const result = data.playerResults[playerData._id];
        if (result.pointsEarned) {
          setEarnedPoints(result.pointsEarned);
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
        
        // Update current point value based on elapsed time
        const elapsedTime = timeLimit - data.timeRemaining;
        const pointValue = Math.max(
          minPoints,
          maxPoints - Math.floor(elapsedTime * decreaseRate)
        );
        setCurrentPointValue(pointValue);
      }
    };
    
    socket.on('question:timer', handleTimerUpdate);
    
    return () => {
      socket.off('question:timer', handleTimerUpdate);
    };
  }, [socket, currentQuestion, timeLimit, maxPoints, minPoints, decreaseRate]);
  
  // Handle local timer countdown
  useEffect(() => {
    if (roundStatus !== 'question' || hasAnswered || timeRemaining <= 0) return;
    
    const timer = setTimeout(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1));
      
      // Update current point value
      const elapsedTime = timeLimit - (timeRemaining - 1);
      const pointValue = Math.max(
        minPoints,
        maxPoints - Math.floor(elapsedTime * decreaseRate)
      );
      setCurrentPointValue(pointValue);
      
      // Auto-submit when time runs out
      if (timeRemaining === 1 && !hasAnswered) {
        handleTimeUp();
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [roundStatus, hasAnswered, timeRemaining, timeLimit, maxPoints, minPoints, decreaseRate]);
  
  // Handle answer selection
  const handleAnswerSelect = (index) => {
    if (hasAnswered || isRevealed) return;
    
    setSelectedAnswer(index);
    setHasAnswered(true);
    setRoundStatus('answered');
    
    // Calculate response time
    const responseTime = (Date.now() - responseStartTime) / 1000;
    
    // Send answer to server
    if (socket && currentQuestion) {
      socket.emit('player:answer', {
        questionId: currentQuestion.id,
        answerIndex: index,
        timestamp: Date.now(),
        responseTime
      });
      
      // Call the callback if provided
      if (onAnswerSubmit && typeof onAnswerSubmit === 'function') {
        onAnswerSubmit({
          questionId: currentQuestion.id,
          answerIndex: index,
          timestamp: Date.now(),
          responseTime
        });
      }
    }
    
    showNotification('Answer Submitted!', 'success');
  };
  
  // Handle time up (auto-submit)
  const handleTimeUp = () => {
    setHasAnswered(true);
    setRoundStatus('answered');
    
    // Send timeout to server
    if (socket && currentQuestion) {
      socket.emit('player:answer', {
        questionId: currentQuestion.id,
        timedOut: true,
        timestamp: Date.now()
      });
      
      // Call the callback if provided
      if (onAnswerSubmit && typeof onAnswerSubmit === 'function') {
        onAnswerSubmit({
          questionId: currentQuestion.id,
          timedOut: true,
          timestamp: Date.now()
        });
      }
    }
    
    showNotification('Time\'s up!', 'warning');
  };
  
  // Show notification
  const showNotification = (message, type = 'info') => {
    setNotification({
      message,
      type,
      visible: true
    });
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setNotification(prev => ({
        ...prev,
        visible: false
      }));
    }, 3000);
  };
  
  // Render point value display
  const renderPointValueDisplay = () => {
    if (roundStatus !== 'question' || hasAnswered) return null;
    
    return (
      <div className="point-value-container">
        <div className="point-value-label">Current Point Value</div>
        <div className="point-value">{currentPointValue}</div>
        <div className="point-value-progress">
          <div 
            className="point-value-bar" 
            style={{ 
              width: `${((currentPointValue - minPoints) / (maxPoints - minPoints)) * 100}%` 
            }}
          ></div>
        </div>
      </div>
    );
  };
  
  // Render earned points display
  const renderEarnedPointsDisplay = () => {
    if (!earnedPoints) return null;
    
    return (
      <div className={`earned-points ${earnedPoints > 0 ? 'positive' : 'negative'}`}>
        <div className="earned-points-label">
          {earnedPoints > 0 ? 'Points Earned' : 'Points Lost'}
        </div>
        <div className="earned-points-value">
          {earnedPoints > 0 ? '+' : ''}{earnedPoints}
        </div>
        {isFastest && (
          <div className="fastest-badge">Fastest Answer! 🏆</div>
        )}
      </div>
    );
  };
  
  // Render waiting screen
  if (roundStatus === 'waiting' || roundStatus === 'completed') {
    return (
      <WaitingScreen 
        message={waitingMessage}
        subMessage={waitingSubMessage}
      />
    );
  }
  
  return (
    <div className="graduated-points-round-player">
      <GameEventNotification 
        message={notification.message}
        type={notification.type}
        visible={notification.visible}
      />
      
      <div className="round-header">
        <h2>Graduated Points Round</h2>
        <PlayerScoreDisplay 
          score={score}
          recentPoints={recentPoints}
        />
      </div>
      
      {renderPointValueDisplay()}
      
      <div className="question-container">
        {currentQuestion && (
          <>
            <div className="question-header">
              <div className="question-number">
                Question {currentQuestion.questionNumber || ''}
              </div>
              <div className="question-timer">
                {timeRemaining > 0 && `${timeRemaining}s`}
              </div>
            </div>
            
            <div className="question-text">
              {currentQuestion.text}
            </div>
            
            <MultipleChoiceAnswers 
              options={options}
              selectedAnswer={selectedAnswer}
              correctAnswer={showCorrect ? correctAnswer : -1}
              onSelect={handleAnswerSelect}
              disabled={hasAnswered || isRevealed}
            />
            
            {hasAnswered && !isRevealed && (
              <div className="answer-waiting">
                Waiting for answer reveal...
              </div>
            )}
            
            {isRevealed && renderEarnedPointsDisplay()}
            
            {isRevealed && currentQuestion.explanation && (
              <div className="question-explanation">
                <h3>Explanation</h3>
                <p>{currentQuestion.explanation}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GraduatedPointsRoundPlayer;
