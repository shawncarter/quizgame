import React, { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import QuestionDisplayPanel from './QuestionDisplayPanel';
import PlayerStatusPanel from './PlayerStatusPanel';
import './PointBuilderRound.css';

/**
 * Point Builder Round Component for Game Master
 * Manages the Point Builder round where all players can answer for equal points
 */
const PointBuilderRound = ({ gameSession, currentRound, socket }) => {
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
    pointsPerQuestion: 10,
    timeLimit: 30,
    allowNegativePoints: false
  });
  
  // Initialize round
  useEffect(() => {
    if (currentRound && currentRound.type === 'pointBuilder') {
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
          pointsPerQuestion: currentRound.settings.pointsPerQuestion || 10,
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
      }
    };
    
    socket.on('player:answer', handlePlayerAnswer);
    socket.on('question:timer', handleQuestionTimer);
    
    return () => {
      socket.off('player:answer', handlePlayerAnswer);
      socket.off('question:timer', handleQuestionTimer);
    };
  }, [socket, currentQuestion]);
  
  // Start the round
  const startRound = () => {
    if (!socket || roundStatus !== 'ready') return;
    
    socket.emit('round:start', {
      roundNumber: currentRound.roundNumber,
      roundType: 'point-builder',
      pointsPerQuestion: settings.pointsPerQuestion,
      timeLimit: settings.timeLimit,
      allowNegativePoints: settings.allowNegativePoints
    });
    
    setRoundStatus('active');
    
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
    const correctAnswers = questionAnswers.filter(a => a.isCorrect).length;
    const incorrectAnswers = questionAnswers.length - correctAnswers;
    
    // Update round stats
    setRoundStats(prev => ({
      ...prev,
      correctAnswers: prev.correctAnswers + correctAnswers,
      incorrectAnswers: prev.incorrectAnswers + incorrectAnswers
    }));
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
  
  // Get answers for current question
  const getCurrentQuestionAnswers = () => {
    if (!currentQuestion) return [];
    
    return playerAnswers.filter(a => a.questionId === currentQuestion.id);
  };
  
  // Render round controls
  const renderRoundControls = () => {
    switch (roundStatus) {
      case 'ready':
        return (
          <button 
            className="start-round-button"
            onClick={startRound}
          >
            Start Round
          </button>
        );
        
      case 'active':
        return (
          <div className="round-controls">
            <button 
              className="pause-round-button"
              onClick={pauseRound}
            >
              Pause Round
            </button>
            <button 
              className="reveal-answer-button"
              onClick={revealAnswer}
            >
              Reveal Answer
            </button>
            <button 
              className="next-question-button"
              onClick={nextQuestion}
            >
              {currentQuestionIndex >= questions.length - 1 ? 'End Round' : 'Next Question'}
            </button>
          </div>
        );
        
      case 'paused':
        return (
          <button 
            className="resume-round-button"
            onClick={resumeRound}
          >
            Resume Round
          </button>
        );
        
      case 'completed':
        return (
          <div className="round-completed">
            <h3>Round Completed</h3>
            <p>All questions have been answered.</p>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  // Render round progress
  const renderRoundProgress = () => {
    const progress = questions.length > 0 
      ? Math.round(((currentQuestionIndex + 1) / questions.length) * 100)
      : 0;
      
    return (
      <div className="round-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="progress-text">
          Question {currentQuestionIndex + 1} of {questions.length}
        </div>
      </div>
    );
  };
  
  // Render round stats
  const renderRoundStats = () => {
    return (
      <div className="round-stats">
        <div className="stat-item">
          <div className="stat-value">{roundStats.answeredQuestions}</div>
          <div className="stat-label">Questions</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{roundStats.correctAnswers}</div>
          <div className="stat-label">Correct</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{roundStats.incorrectAnswers}</div>
          <div className="stat-label">Incorrect</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{settings.pointsPerQuestion}</div>
          <div className="stat-label">Points Each</div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="point-builder-round">
      <div className="round-header">
        <h2>Point Builder Round: {currentRound?.title}</h2>
        {renderRoundProgress()}
      </div>
      
      {renderRoundStats()}
      
      {currentQuestion && (
        <QuestionDisplayPanel 
          question={currentQuestion}
          timeRemaining={timeRemaining}
          timeLimit={settings.timeLimit}
          playerAnswers={getCurrentQuestionAnswers()}
          showCorrectAnswer={roundStatus === 'completed'}
        />
      )}
      
      <div className="round-actions">
        {renderRoundControls()}
      </div>
      
      <PlayerStatusPanel 
        gameSession={gameSession}
        currentQuestion={currentQuestion}
        playerAnswers={playerAnswers}
      />
    </div>
  );
};

export default PointBuilderRound;
