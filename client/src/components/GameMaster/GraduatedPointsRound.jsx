import React, { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import QuestionDisplayPanel from './QuestionDisplayPanel';
import PlayerStatusPanel from './PlayerStatusPanel';
import './GraduatedPointsRound.css';

/**
 * Graduated Points Round Component for Game Master
 * Manages the Graduated Points round where faster responses get more points
 */
const GraduatedPointsRound = ({ gameSession, currentRound, socket }) => {
  const { updateGameState } = useGame();
  
  // Round state
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [roundStatus, setRoundStatus] = useState('ready'); // ready, active, paused, completed
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [playerAnswers, setPlayerAnswers] = useState([]);
  const [roundStats, setRoundStats] = useState({
    totalQuestions: 0,
    answeredQuestions: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    averageScore: 0
  });
  
  // Settings
  const [settings, setSettings] = useState({
    maxPoints: 20,
    minPoints: 5,
    decreaseRate: 0.5, // points per second
    timeLimit: 30,
    allowNegativePoints: false
  });
  
  // Points visualization
  const [currentPointValue, setCurrentPointValue] = useState(0);
  const [fastestResponse, setFastestResponse] = useState(null);
  
  // Initialize round
  useEffect(() => {
    if (currentRound && currentRound.type === 'graduatedPoints') {
      // Set questions from current round
      if (currentRound.questions) {
        setQuestions(currentRound.questions);
        setRoundStats(prev => ({
          ...prev,
          totalQuestions: currentRound.questions.length
        }));
      }
      
      // Set settings from current round
      if (currentRound.settings) {
        setSettings({
          maxPoints: currentRound.settings.maxPoints || 20,
          minPoints: currentRound.settings.minPoints || 5,
          decreaseRate: currentRound.settings.decreaseRate || 0.5,
          timeLimit: currentRound.settings.timeLimit || 30,
          allowNegativePoints: currentRound.settings.allowNegativePoints || false
        });
      }
      
      // Set round status
      setRoundStatus(currentRound.status || 'ready');
    }
  }, [currentRound]);
  
  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;
    
    // Listen for player answers
    const handlePlayerAnswer = (data) => {
      setPlayerAnswers(prev => {
        // Check if player already answered this question
        const existingAnswerIndex = prev.findIndex(
          a => a.playerId === data.playerId && a.questionId === data.questionId
        );
        
        if (existingAnswerIndex >= 0) {
          // Update existing answer
          const newAnswers = [...prev];
          newAnswers[existingAnswerIndex] = data;
          return newAnswers;
        } else {
          // Add new answer
          return [...prev, data];
        }
      });
    };
    
    // Listen for question timer updates
    const handleQuestionTimer = (data) => {
      if (data.questionId === currentQuestion?.id) {
        setTimeRemaining(data.timeRemaining);
        
        // Update current point value based on elapsed time
        const elapsedTime = settings.timeLimit - data.timeRemaining;
        const pointValue = Math.max(
          settings.minPoints,
          settings.maxPoints - Math.floor(elapsedTime * settings.decreaseRate)
        );
        setCurrentPointValue(pointValue);
      }
    };
    
    socket.on('player:answer', handlePlayerAnswer);
    socket.on('question:timer', handleQuestionTimer);
    
    return () => {
      socket.off('player:answer', handlePlayerAnswer);
      socket.off('question:timer', handleQuestionTimer);
    };
  }, [socket, currentQuestion, settings]);
  
  // Start the round
  const startRound = () => {
    if (!socket || roundStatus !== 'ready') return;
    
    socket.emit('round:start', {
      roundNumber: currentRound.roundNumber,
      roundType: 'graduated-points',
      maxPoints: settings.maxPoints,
      minPoints: settings.minPoints,
      decreaseRate: settings.decreaseRate,
      timeLimit: settings.timeLimit,
      allowNegativePoints: settings.allowNegativePoints
    });
    
    setRoundStatus('active');
    setCurrentPointValue(settings.maxPoints);
    
    // Start with first question if available
    if (questions.length > 0) {
      setCurrentQuestionIndex(0);
      setCurrentQuestion(questions[0]);
      
      // Send first question
      socket.emit('question:next', {
        questionId: questions[0].id,
        roundNumber: currentRound.roundNumber
      });
    }
  };
  
  // Move to next question
  const nextQuestion = () => {
    if (!socket || currentQuestionIndex >= questions.length - 1) {
      // End of round
      endRound();
      return;
    }
    
    const nextIndex = currentQuestionIndex + 1;
    setCurrentQuestionIndex(nextIndex);
    setCurrentQuestion(questions[nextIndex]);
    setFastestResponse(null);
    setCurrentPointValue(settings.maxPoints);
    
    // Reset player answers for the new question
    setPlayerAnswers(prev => prev.filter(a => a.questionId !== questions[nextIndex].id));
    
    // Send next question
    socket.emit('question:next', {
      questionId: questions[nextIndex].id,
      roundNumber: currentRound.roundNumber
    });
    
    // Update stats
    setRoundStats(prev => ({
      ...prev,
      answeredQuestions: nextIndex
    }));
  };
  
  // Reveal answer for current question
  const revealAnswer = () => {
    if (!socket || !currentQuestion) return;
    
    socket.emit('question:reveal', {
      questionId: currentQuestion.id,
      roundNumber: currentRound.roundNumber
    });
    
    // Calculate stats for this question
    const questionAnswers = playerAnswers.filter(a => a.questionId === currentQuestion.id);
    
    // Find fastest correct answer
    let fastestTime = Infinity;
    let fastestPlayer = null;
    
    questionAnswers.forEach(answer => {
      if (answer.responseTime && answer.responseTime < fastestTime) {
        fastestTime = answer.responseTime;
        fastestPlayer = answer.playerName;
      }
    });
    
    if (fastestTime !== Infinity) {
      setFastestResponse({
        playerName: fastestPlayer,
        time: fastestTime.toFixed(2)
      });
    }
  };
  
  // End the round
  const endRound = () => {
    if (!socket) return;
    
    socket.emit('round:end', {
      roundNumber: currentRound.roundNumber
    });
    
    setRoundStatus('completed');
  };
  
  // Pause the round
  const pauseRound = () => {
    if (!socket || roundStatus !== 'active') return;
    
    socket.emit('round:pause', {
      roundNumber: currentRound.roundNumber
    });
    
    setRoundStatus('paused');
  };
  
  // Resume the round
  const resumeRound = () => {
    if (!socket || roundStatus !== 'paused') return;
    
    socket.emit('round:resume', {
      roundNumber: currentRound.roundNumber
    });
    
    setRoundStatus('active');
  };
  
  // Calculate current standings
  const getStandings = () => {
    if (!socket) return;
    
    socket.emit('round:standings', {
      roundNumber: currentRound.roundNumber,
      roundType: 'graduated-points'
    });
  };
  
  // Render point value display
  const renderPointValueDisplay = () => {
    return (
      <div className="point-value-display">
        <h3>Current Point Value</h3>
        <div className="point-value">{currentPointValue}</div>
        <div className="point-range">
          <span>{settings.minPoints}</span>
          <div className="point-progress">
            <div 
              className="point-progress-bar" 
              style={{ 
                width: `${((currentPointValue - settings.minPoints) / (settings.maxPoints - settings.minPoints)) * 100}%` 
              }}
            ></div>
          </div>
          <span>{settings.maxPoints}</span>
        </div>
      </div>
    );
  };
  
  // Render fastest response display
  const renderFastestResponse = () => {
    if (!fastestResponse) return null;
    
    return (
      <div className="fastest-response">
        <h3>Fastest Correct Answer</h3>
        <div className="fastest-player">{fastestResponse.playerName}</div>
        <div className="fastest-time">{fastestResponse.time}s</div>
      </div>
    );
  };
  
  // Render player answers
  const renderPlayerAnswers = () => {
    if (!currentQuestion) return null;
    
    const questionAnswers = playerAnswers.filter(a => a.questionId === currentQuestion.id);
    
    return (
      <div className="player-answers">
        <h3>Player Answers</h3>
        {questionAnswers.length === 0 ? (
          <p>No answers yet</p>
        ) : (
          <ul>
            {questionAnswers.map((answer, index) => (
              <li key={index} className="player-answer-item">
                <span className="player-name">{answer.playerName}</span>
                <span className="answer-time">
                  {answer.responseTime ? `${answer.responseTime.toFixed(2)}s` : 'N/A'}
                </span>
                {answer.pointsEarned && (
                  <span className="points-earned">
                    {answer.pointsEarned > 0 ? '+' : ''}{answer.pointsEarned}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };
  
  return (
    <div className="graduated-points-round">
      <div className="round-header">
        <h2>Graduated Points Round</h2>
        <div className="round-status">Status: {roundStatus}</div>
        {timeRemaining > 0 && (
          <div className="timer">Time: {timeRemaining}s</div>
        )}
      </div>
      
      <div className="round-content">
        <div className="left-panel">
          {currentQuestion ? (
            <QuestionDisplayPanel 
              question={currentQuestion}
              timeRemaining={timeRemaining}
              showAnswer={roundStatus === 'completed'}
            />
          ) : (
            <div className="no-question">
              <p>No question selected</p>
            </div>
          )}
          
          {roundStatus === 'active' && renderPointValueDisplay()}
          {roundStatus === 'revealed' && renderFastestResponse()}
        </div>
        
        <div className="right-panel">
          <PlayerStatusPanel 
            players={gameSession?.players || []}
            currentQuestion={currentQuestion}
            playerAnswers={playerAnswers}
          />
          
          {renderPlayerAnswers()}
        </div>
      </div>
      
      <div className="round-controls">
        {roundStatus === 'ready' && (
          <button className="start-button" onClick={startRound}>Start Round</button>
        )}
        
        {roundStatus === 'active' && (
          <>
            <button className="reveal-button" onClick={revealAnswer}>Reveal Answer</button>
            <button className="pause-button" onClick={pauseRound}>Pause</button>
          </>
        )}
        
        {roundStatus === 'paused' && (
          <button className="resume-button" onClick={resumeRound}>Resume</button>
        )}
        
        {roundStatus === 'revealed' && (
          <button className="next-button" onClick={nextQuestion}>Next Question</button>
        )}
        
        {roundStatus === 'active' || roundStatus === 'paused' || roundStatus === 'revealed' ? (
          <button className="end-button" onClick={endRound}>End Round</button>
        ) : null}
        
        <button className="standings-button" onClick={getStandings}>View Standings</button>
      </div>
      
      <div className="round-stats">
        <h3>Round Stats</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-label">Questions</div>
            <div className="stat-value">{roundStats.answeredQuestions} / {roundStats.totalQuestions}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Correct Answers</div>
            <div className="stat-value">{roundStats.correctAnswers}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Incorrect Answers</div>
            <div className="stat-value">{roundStats.incorrectAnswers}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GraduatedPointsRound;
