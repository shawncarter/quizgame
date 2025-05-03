import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../../context/PlayerContext';
import { createPlayerSocket, connectSocket, disconnectSocket } from '../../services/gameSocketService';
import BuzzerButton from './BuzzerButton';
import MultipleChoiceAnswers from './MultipleChoiceAnswers';
import PlayerScoreDisplay from './PlayerScoreDisplay';
import GameEventNotification from './GameEventNotification';
import WaitingScreen from './WaitingScreen';
import PointBuilderRoundPlayer from './PointBuilderRoundPlayer';
import GraduatedPointsRoundPlayer from './GraduatedPointsRoundPlayer';
import './PlayerGameInterface.css';

/**
 * Player game interface component
 * Main component for player's game interaction including buzzer and answer selection
 * @param {Object} props - Component props
 * @param {string} props.gameSessionId - Game session ID
 * @param {function} props.onExit - Callback when player exits the game
 */
const PlayerGameInterface = ({ gameSessionId, onExit }) => {
  const navigate = useNavigate();
  const { player } = usePlayer();
  
  // Socket connection state
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  
  // Game state
  const [gameState, setGameState] = useState('waiting'); // waiting, ready, question, buzzer, answer, results
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionType, setQuestionType] = useState(''); // multiple-choice, buzzer
  const [answerOptions, setAnswerOptions] = useState([]);
  const [selectedAnswer, setSelectedAnswer] = useState(-1);
  const [correctAnswer, setCorrectAnswer] = useState(-1);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [timeLimit, setTimeLimit] = useState(0);
  const [buzzerEnabled, setBuzzerEnabled] = useState(false);
  const [buzzed, setBuzzed] = useState(false);
  const [waitingMessage, setWaitingMessage] = useState('Waiting for game to start...');
  const [waitingSubMessage, setWaitingSubMessage] = useState('');
  const [countdown, setCountdown] = useState(0);
  
  // Round state
  const [currentRound, setCurrentRound] = useState(null);
  const [roundType, setRoundType] = useState('');
  
  // Player state
  const [score, setScore] = useState(0);
  const [rank, setRank] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [recentPoints, setRecentPoints] = useState(null);
  const [playerStats, setPlayerStats] = useState({});
  
  // Notification state
  const [notification, setNotification] = useState({
    message: '',
    type: 'info',
    visible: false,
    duration: 3000
  });

  // Initialize socket connection
  useEffect(() => {
    if (!player || !player._id || !gameSessionId) return;
    
    const playerSocket = createPlayerSocket(player._id, gameSessionId);
    setSocket(playerSocket);
    
    connectSocket(playerSocket)
      .then(() => {
        setConnected(true);
        console.log('Connected to game session:', gameSessionId);
        
        // Request initial game state
        playerSocket.emit('game:request_state');
      })
      .catch(error => {
        console.error('Failed to connect to game session:', error);
        showNotification('Failed to connect to game. Please try again.', 'error');
      });
    
    return () => {
      if (playerSocket) {
        disconnectSocket(playerSocket);
        setConnected(false);
      }
    };
  }, [player, gameSessionId]);

  // Set up socket event handlers
  useEffect(() => {
    if (!socket) return;
    
    // Game state events
    socket.on('game:state', handleGameState);
    socket.on('game:players', handleGamePlayers);
    socket.on('game:round', handleGameRound);
    socket.on('question:new', handleNewQuestion);
    socket.on('question:reveal', handleRevealAnswer);
    socket.on('buzzer:enable', handleBuzzerEnable);
    socket.on('buzzer:disable', handleBuzzerDisable);
    socket.on('buzzer:result', handleBuzzerResult);
    socket.on('player:score', handlePlayerScore);
    socket.on('game:notification', handleGameNotification);
    socket.on('game:countdown', handleGameCountdown);
    socket.on('game:end', handleGameEnd);
    
    // Error events
    socket.on('error', handleError);
    
    // Connection events
    socket.on('disconnect', () => {
      setConnected(false);
      showNotification('Disconnected from game server', 'warning');
    });
    
    socket.on('reconnect', () => {
      setConnected(true);
      showNotification('Reconnected to game server', 'success');
      
      // Request current game state
      socket.emit('game:request_state');
    });
    
    return () => {
      socket.off('game:state', handleGameState);
      socket.off('game:players', handleGamePlayers);
      socket.off('game:round', handleGameRound);
      socket.off('question:new', handleNewQuestion);
      socket.off('question:reveal', handleRevealAnswer);
      socket.off('buzzer:enable', handleBuzzerEnable);
      socket.off('buzzer:disable', handleBuzzerDisable);
      socket.off('buzzer:result', handleBuzzerResult);
      socket.off('player:score', handlePlayerScore);
      socket.off('game:notification', handleGameNotification);
      socket.off('game:countdown', handleGameCountdown);
      socket.off('game:end', handleGameEnd);
      socket.off('error', handleError);
    };
  }, [socket]);

  // Event handlers
  const handleGameState = useCallback((data) => {
    console.log('Game state update:', data);
    setGameState(data.state || 'waiting');
    
    // Update player-specific data if available
    if (data.player) {
      if (data.player.score !== undefined) setScore(data.player.score);
      if (data.player.rank !== undefined) setRank(data.player.rank);
      if (data.player.stats) setPlayerStats(data.player.stats);
    }
    
    // Update current question if available
    if (data.question) {
      setCurrentQuestion(data.question);
      setQuestionType(data.question.type || 'multiple-choice');
      
      if (data.question.options) {
        setAnswerOptions(data.question.options);
      }
      
      if (data.question.timeLimit) {
        setTimeLimit(data.question.timeLimit);
      }
    }
    
    // Update round information if available
    if (data.round) {
      setCurrentRound(data.round);
      setRoundType(data.round.type || '');
    }
    
    // Update buzzer state if available
    if (data.buzzerEnabled !== undefined) {
      setBuzzerEnabled(data.buzzerEnabled);
    }
    
    // Update waiting message if available
    if (data.waitingMessage) {
      setWaitingMessage(data.waitingMessage);
    }
    
    if (data.waitingSubMessage) {
      setWaitingSubMessage(data.waitingSubMessage);
    }
  }, []);

  const handleGamePlayers = useCallback((data) => {
    console.log('Game players update:', data);
    if (data.totalPlayers) {
      setTotalPlayers(data.totalPlayers);
    }
    
    // Update player rank if available
    if (data.players && player && player._id) {
      const currentPlayer = data.players.find(p => p.id === player._id);
      if (currentPlayer && currentPlayer.rank) {
        setRank(currentPlayer.rank);
      }
    }
  }, [player]);

  const handleGameRound = useCallback((data) => {
    console.log('Game round update:', data);
    showNotification(`Round ${data.roundNumber}: ${data.roundName}`, 'info');
    
    // Update round information
    setCurrentRound(data);
    setRoundType(data.roundType || '');
    
    // Reset question and answer state for new round
    setCurrentQuestion(null);
    setAnswerOptions([]);
    setSelectedAnswer(-1);
    setCorrectAnswer(-1);
    setShowCorrectAnswer(false);
    setBuzzerEnabled(false);
    setBuzzed(false);
    
    // Update waiting state
    setGameState('waiting');
    setWaitingMessage(`Round ${data.roundNumber}: ${data.roundName}`);
    setWaitingSubMessage(data.roundDescription || 'Get ready for the next round!');
  }, []);

  const handleNewQuestion = useCallback((data) => {
    console.log('New question:', data);
    setGameState('question');
    setCurrentQuestion(data);
    setQuestionType(data.type || 'multiple-choice');
    setAnswerOptions(data.options || []);
    setTimeLimit(data.timeLimit || 0);
    setSelectedAnswer(-1);
    setCorrectAnswer(-1);
    setShowCorrectAnswer(false);
    setBuzzed(false);
    
    // For buzzer questions, the buzzer might be enabled immediately or later
    if (data.type === 'buzzer') {
      setBuzzerEnabled(data.buzzerEnabled || false);
    }
    
    // Play question sound if available
    const questionSound = new Audio('/sounds/new-question.mp3');
    questionSound.play().catch(err => console.error('Error playing question sound:', err));
    
    showNotification('New Question!', 'info');
  }, []);

  const handleRevealAnswer = useCallback((data) => {
    console.log('Answer revealed:', data);
    setGameState('results');
    setCorrectAnswer(data.correctIndex || -1);
    setShowCorrectAnswer(true);
    setBuzzerEnabled(false);
    
    // Show notification with result
    const isCorrect = selectedAnswer === data.correctIndex;
    showNotification(
      isCorrect ? 'Correct Answer!' : 'Incorrect Answer', 
      isCorrect ? 'success' : 'error'
    );
  }, [selectedAnswer]);

  const handleBuzzerEnable = useCallback(() => {
    console.log('Buzzer enabled');
    setBuzzerEnabled(true);
    showNotification('Buzzer Enabled!', 'info');
    
    // Play buzzer ready sound if available
    const buzzerReadySound = new Audio('/sounds/buzzer-ready.mp3');
    buzzerReadySound.play().catch(err => console.error('Error playing buzzer ready sound:', err));
  }, []);

  const handleBuzzerDisable = useCallback(() => {
    console.log('Buzzer disabled');
    setBuzzerEnabled(false);
  }, []);

  const handleBuzzerResult = useCallback((data) => {
    console.log('Buzzer result:', data);
    
    if (data.playerId === player?._id) {
      // This player buzzed in first
      showNotification('You buzzed in first!', 'success');
      setGameState('answer');
    } else {
      // Another player buzzed in first
      showNotification(`${data.playerName} buzzed in first!`, 'info');
      setGameState('waiting');
      setWaitingMessage('Another player buzzed in first');
      setWaitingSubMessage('Please wait while they answer...');
    }
  }, [player]);

  const handlePlayerScore = useCallback((data) => {
    console.log('Player score update:', data);
    
    if (data.score !== undefined) {
      const oldScore = score;
      setScore(data.score);
      
      // Calculate points change for animation
      const pointsChange = data.score - oldScore;
      if (pointsChange !== 0) {
        setRecentPoints(pointsChange);
        
        // Clear recent points after animation
        setTimeout(() => {
          setRecentPoints(null);
        }, 2000);
      }
    }
    
    if (data.rank !== undefined) {
      setRank(data.rank);
    }
    
    if (data.stats) {
      setPlayerStats(data.stats);
    }
  }, [score]);

  const handleGameNotification = useCallback((data) => {
    console.log('Game notification:', data);
    showNotification(data.message, data.type || 'info', data.duration);
  }, []);

  const handleGameCountdown = useCallback((data) => {
    console.log('Game countdown:', data);
    setCountdown(data.seconds || 0);
    
    if (data.message) {
      setWaitingMessage(data.message);
    }
    
    if (data.subMessage) {
      setWaitingSubMessage(data.subMessage);
    }
  }, []);

  const handleGameEnd = useCallback((data) => {
    console.log('Game ended:', data);
    showNotification('Game has ended!', 'info');
    
    // Navigate to results page or show game summary
    setTimeout(() => {
      if (onExit && typeof onExit === 'function') {
        onExit();
      } else {
        navigate('/');
      }
    }, 3000);
  }, [navigate, onExit]);

  const handleError = useCallback((error) => {
    console.error('Game error:', error);
    showNotification(error.message || 'An error occurred', 'error');
  }, []);

  // User interaction handlers
  const handleBuzz = () => {
    if (!buzzerEnabled || !socket || !connected) return;
    
    console.log('Player buzzed in');
    setBuzzed(true);
    setBuzzerEnabled(false);
    
    // Send buzz event to server
    socket.emit('player:buzz', {
      questionId: currentQuestion?.id,
      timestamp: Date.now()
    });
  };

  const handleAnswerSelect = (index) => {
    if (!socket || !connected) return;
    
    console.log('Player selected answer:', index);
    setSelectedAnswer(index);
    
    // Send answer to server
    socket.emit('player:answer', {
      questionId: currentQuestion?.id,
      answerIndex: index,
      timestamp: Date.now()
    });
  };

  const handleExitGame = () => {
    if (socket) {
      socket.emit('player:leave');
      disconnectSocket(socket);
    }
    
    if (onExit && typeof onExit === 'function') {
      onExit();
    } else {
      navigate('/');
    }
  };

  // Helper functions
  const showNotification = (message, type = 'info', duration = 3000) => {
    setNotification({
      message,
      type,
      visible: true,
      duration
    });
    
    // Auto-hide notification after duration (if not persistent)
    if (duration > 0) {
      setTimeout(() => {
        setNotification(prev => ({ ...prev, visible: false }));
      }, duration);
    }
  };

  // Render different game states
  const renderGameContent = () => {
    // If it's a Point Builder round, use the specialized component
    if (roundType === 'point-builder' || roundType === 'pointBuilder') {
      return (
        <PointBuilderRoundPlayer
          socket={socket}
          roundData={currentRound}
          playerData={{
            _id: player?._id,
            score,
            rank,
            totalPlayers,
            stats: playerStats
          }}
          onAnswerSubmit={handleAnswerSelect}
        />
      );
    }
    
    // If it's a Graduated Points round, use the specialized component
    if (roundType === 'graduated-points') {
      return (
        <GraduatedPointsRoundPlayer
          socket={socket}
          roundData={currentRound}
          playerData={{
            _id: player?._id,
            score,
            rank,
            totalPlayers,
            stats: playerStats
          }}
          onAnswerSubmit={handleAnswerSelect}
        />
      );
    }
    
    // Otherwise use the standard game interface
    switch (gameState) {
      case 'waiting':
        return (
          <WaitingScreen
            message={waitingMessage}
            subMessage={waitingSubMessage}
            countdown={countdown}
            showSpinner={true}
          />
        );
        
      case 'question':
        if (questionType === 'buzzer') {
          return (
            <div className="buzzer-question-container">
              <div className="question-text">
                <h2>{currentQuestion?.text}</h2>
                {currentQuestion?.subText && <p>{currentQuestion.subText}</p>}
              </div>
              
              <BuzzerButton
                disabled={!buzzerEnabled}
                active={buzzerEnabled}
                onBuzz={handleBuzz}
                size="large"
              />
              
              <div className="buzzer-status">
                {buzzerEnabled ? 'Buzzer Ready!' : buzzed ? 'You buzzed in!' : 'Wait for buzzer activation...'}
              </div>
            </div>
          );
        } else {
          // Multiple choice question
          return (
            <div className="multiple-choice-question-container">
              <div className="question-text">
                <h2>{currentQuestion?.text}</h2>
                {currentQuestion?.subText && <p>{currentQuestion.subText}</p>}
              </div>
              
              <MultipleChoiceAnswers
                options={answerOptions}
                onSelect={handleAnswerSelect}
                disabled={false}
                selectedIndex={selectedAnswer}
                correctIndex={showCorrectAnswer ? correctAnswer : -1}
                showCorrect={showCorrectAnswer}
                timeLimit={timeLimit}
              />
            </div>
          );
        }
        
      case 'answer':
        // Player buzzed in and needs to answer
        return (
          <div className="buzzer-answer-container">
            <div className="question-text">
              <h2>{currentQuestion?.text}</h2>
              {currentQuestion?.subText && <p>{currentQuestion.subText}</p>}
            </div>
            
            <div className="answer-prompt">
              <h3>You buzzed in first!</h3>
              <p>Type your answer below:</p>
            </div>
            
            <div className="answer-input-container">
              <input 
                type="text" 
                className="answer-input"
                placeholder="Enter your answer..."
                autoFocus
              />
              <button 
                className="submit-answer-button"
                onClick={() => {
                  const answerInput = document.querySelector('.answer-input');
                  if (answerInput && answerInput.value) {
                    socket.emit('player:answer', {
                      questionId: currentQuestion?.id,
                      answerText: answerInput.value,
                      timestamp: Date.now()
                    });
                    setGameState('waiting');
                    setWaitingMessage('Answer submitted');
                    setWaitingSubMessage('Waiting for host to verify...');
                  }
                }}
              >
                Submit
              </button>
            </div>
          </div>
        );
        
      case 'results':
        return (
          <div className="results-container">
            <div className="question-text">
              <h2>{currentQuestion?.text}</h2>
              {currentQuestion?.subText && <p>{currentQuestion.subText}</p>}
            </div>
            
            {questionType === 'multiple-choice' ? (
              <MultipleChoiceAnswers
                options={answerOptions}
                disabled={true}
                selectedIndex={selectedAnswer}
                correctIndex={correctAnswer}
                showCorrect={true}
              />
            ) : (
              <div className="buzzer-answer-result">
                <h3>Correct Answer:</h3>
                <div className="correct-answer">{currentQuestion?.correctAnswer}</div>
                
                {currentQuestion?.explanation && (
                  <div className="answer-explanation">
                    <h4>Explanation:</h4>
                    <p>{currentQuestion.explanation}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
        
      default:
        return (
          <div className="error-container">
            <h2>Unknown Game State</h2>
            <p>Something went wrong. Please try refreshing the page.</p>
            <button 
              className="exit-button"
              onClick={handleExitGame}
            >
              Exit Game
            </button>
          </div>
        );
    }
  };

  return (
    <div className="player-game-interface">
      <div className="game-header">
        <h1 className="game-title">Quiz Game</h1>
        <button 
          className="exit-button"
          onClick={handleExitGame}
        >
          Exit Game
        </button>
      </div>
      
      {roundType !== 'point-builder' && roundType !== 'pointBuilder' && roundType !== 'graduated-points' && (
        <PlayerScoreDisplay
          score={score}
          rank={rank}
          totalPlayers={totalPlayers}
          recentPoints={recentPoints}
          stats={playerStats}
        />
      )}
      
      <GameEventNotification
        message={notification.message}
        type={notification.type}
        duration={notification.duration}
        visible={notification.visible}
        onClose={() => setNotification(prev => ({ ...prev, visible: false }))}
      />
      
      <div className="game-content">
        {!connected ? (
          <div className="connection-error">
            <h2>Connecting to game...</h2>
            <div className="spinner"></div>
            <p>If this takes too long, please try refreshing the page.</p>
          </div>
        ) : (
          renderGameContent()
        )}
      </div>
    </div>
  );
};

export default PlayerGameInterface;
