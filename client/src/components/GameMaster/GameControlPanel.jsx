import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import './GameControlPanel.css';

/**
 * Game Control Panel
 * Provides controls for managing game flow
 */
const GameControlPanel = ({ gameSession, currentRound, currentQuestion, gameStatus }) => {
  const { 
    startGame,
    endGame,
    pauseGame,
    resumeGame,
    startRound,
    endRound,
    nextQuestion,
    revealAnswer
  } = useGame();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  
  // Handle game start
  const handleStartGame = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await startGame();
    } catch (err) {
      console.error('Error starting game:', err);
      setError('Failed to start game');
    } finally {
      setIsLoading(false);
      setConfirmAction(null);
    }
  };
  
  // Handle game end
  const handleEndGame = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await endGame();
    } catch (err) {
      console.error('Error ending game:', err);
      setError('Failed to end game');
    } finally {
      setIsLoading(false);
      setConfirmAction(null);
    }
  };
  
  // Handle game pause/resume
  const handlePauseResumeGame = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (gameStatus === 'active') {
        await pauseGame();
      } else if (gameStatus === 'paused') {
        await resumeGame();
      }
    } catch (err) {
      console.error('Error pausing/resuming game:', err);
      setError(`Failed to ${gameStatus === 'active' ? 'pause' : 'resume'} game`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle round start
  const handleStartRound = async () => {
    if (!currentRound) return;
    
    try {
      setIsLoading(true);
      setError(null);
      await startRound({ roundId: currentRound._id });
    } catch (err) {
      console.error('Error starting round:', err);
      setError('Failed to start round');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle round end
  const handleEndRound = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await endRound();
    } catch (err) {
      console.error('Error ending round:', err);
      setError('Failed to end round');
    } finally {
      setIsLoading(false);
      setConfirmAction(null);
    }
  };
  
  // Handle next question
  const handleNextQuestion = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await nextQuestion();
    } catch (err) {
      console.error('Error moving to next question:', err);
      setError('Failed to move to next question');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle reveal answer
  const handleRevealAnswer = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await revealAnswer();
    } catch (err) {
      console.error('Error revealing answer:', err);
      setError('Failed to reveal answer');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Render game controls based on status
  const renderGameControls = () => {
    switch (gameStatus) {
      case 'created':
        return (
          <button
            onClick={() => setConfirmAction('start-game')}
            className="control-button start"
            disabled={isLoading || !gameSession?.rounds?.length}
          >
            Start Game
          </button>
        );
        
      case 'lobby':
        return (
          <button
            onClick={() => setConfirmAction('start-game')}
            className="control-button start"
            disabled={isLoading || !gameSession?.rounds?.length}
          >
            Start Game
          </button>
        );
        
      case 'active':
        return (
          <>
            <button
              onClick={handlePauseResumeGame}
              className="control-button pause"
              disabled={isLoading}
            >
              Pause Game
            </button>
            <button
              onClick={() => setConfirmAction('end-game')}
              className="control-button end"
              disabled={isLoading}
            >
              End Game
            </button>
          </>
        );
        
      case 'paused':
        return (
          <>
            <button
              onClick={handlePauseResumeGame}
              className="control-button resume"
              disabled={isLoading}
            >
              Resume Game
            </button>
            <button
              onClick={() => setConfirmAction('end-game')}
              className="control-button end"
              disabled={isLoading}
            >
              End Game
            </button>
          </>
        );
        
      case 'completed':
        return (
          <div className="game-completed">
            Game Completed
          </div>
        );
        
      default:
        return null;
    }
  };
  
  // Render round controls based on status
  const renderRoundControls = () => {
    if (!currentRound || gameStatus === 'completed') {
      return null;
    }
    
    if (currentRound.completed) {
      return (
        <div className="round-completed">
          Round Completed
        </div>
      );
    }
    
    if (gameStatus !== 'active' && gameStatus !== 'paused') {
      return null;
    }
    
    if (!currentQuestion) {
      return (
        <button
          onClick={handleStartRound}
          className="control-button start-round"
          disabled={isLoading || gameStatus === 'paused'}
        >
          Start Round
        </button>
      );
    }
    
    return (
      <>
        <button
          onClick={handleNextQuestion}
          className="control-button next-question"
          disabled={isLoading || gameStatus === 'paused'}
        >
          Next Question
        </button>
        <button
          onClick={handleRevealAnswer}
          className="control-button reveal-answer"
          disabled={isLoading || gameStatus === 'paused'}
        >
          Reveal Answer
        </button>
        <button
          onClick={() => setConfirmAction('end-round')}
          className="control-button end-round"
          disabled={isLoading || gameStatus === 'paused'}
        >
          End Round
        </button>
      </>
    );
  };
  
  // Render confirmation dialog
  const renderConfirmation = () => {
    if (!confirmAction) return null;
    
    let message = '';
    let confirmHandler = null;
    
    switch (confirmAction) {
      case 'start-game':
        message = 'Are you sure you want to start the game?';
        confirmHandler = handleStartGame;
        break;
      case 'end-game':
        message = 'Are you sure you want to end the game? This action cannot be undone.';
        confirmHandler = handleEndGame;
        break;
      case 'end-round':
        message = 'Are you sure you want to end the current round? This action cannot be undone.';
        confirmHandler = handleEndRound;
        break;
      default:
        return null;
    }
    
    return (
      <div className="confirmation-dialog">
        <p>{message}</p>
        <div className="confirmation-actions">
          <button
            onClick={() => setConfirmAction(null)}
            className="cancel-button"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={confirmHandler}
            className="confirm-button"
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Confirm'}
          </button>
        </div>
      </div>
    );
  };
  
  return (
    <div className="game-control-panel">
      <div className="panel-header">
        <h2>Game Controls</h2>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {renderConfirmation() || (
        <>
          <div className="game-controls">
            {renderGameControls()}
          </div>
          
          <div className="round-controls">
            {renderRoundControls()}
          </div>
        </>
      )}
    </div>
  );
};

export default GameControlPanel;
