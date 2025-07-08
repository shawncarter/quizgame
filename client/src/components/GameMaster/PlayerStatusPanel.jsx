import React, { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import './PlayerStatusPanel.css';

/**
 * Player Status Panel
 * Displays real-time player status and scores during the game
 */
const PlayerStatusPanel = ({ players, currentQuestion, gameStatus }) => {
  const { socket } = useGame();
  
  const [playerAnswers, setPlayerAnswers] = useState({});
  const [displayMode, setDisplayMode] = useState('status'); // 'status' or 'leaderboard'
  
  // Sort players by score for leaderboard
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  
  // Listen for player answers
  useEffect(() => {
    if (!socket || !currentQuestion) return;
    
    const handlePlayerAnswer = (data) => {
      setPlayerAnswers(prev => ({
        ...prev,
        [data.playerId]: {
          answered: true,
          correct: data.correct,
          timestamp: new Date()
        }
      }));
    };
    
    socket.on('player:answer', handlePlayerAnswer);
    
    return () => {
      socket.off('player:answer', handlePlayerAnswer);
    };
  }, [socket, currentQuestion]);
  
  // Reset player answers when question changes
  useEffect(() => {
    if (currentQuestion) {
      setPlayerAnswers({});
    }
  }, [currentQuestion]);
  
  // Calculate stats
  const calculateStats = () => {
    const total = players.length;
    const answered = Object.keys(playerAnswers).length;
    const correct = Object.values(playerAnswers).filter(a => a.correct).length;
    
    return {
      total,
      answered,
      correct,
      percentAnswered: total > 0 ? Math.round((answered / total) * 100) : 0,
      percentCorrect: answered > 0 ? Math.round((correct / answered) * 100) : 0
    };
  };
  
  const stats = calculateStats();
  
  // Get player answer status
  const getPlayerAnswerStatus = (playerId) => {
    if (!playerAnswers[playerId]) {
      return 'waiting';
    }
    return playerAnswers[playerId].correct ? 'correct' : 'incorrect';
  };
  
  // Render player status view
  const renderPlayerStatus = () => {
    return (
      <div className="player-status-list">
        {players.map(player => (
          <div 
            key={player.playerId.id} 
            className={`player-status-item ${!player.active ? 'inactive' : ''} ${getPlayerAnswerStatus(player.playerId.id)}`}
          >
            <div className="player-info">
              <div className="player-avatar">
                {player.playerId.avatar ? (
                  <img src={player.playerId.avatar} alt="Avatar" />
                ) : (
                  player.playerId.name.charAt(0)
                )}
              </div>
              <div className="player-name">
                {player.playerId.name}
                {!player.active && <span className="inactive-badge">Offline</span>}
              </div>
            </div>
            <div className="player-score">{player.score}</div>
            <div className="answer-status">
              {playerAnswers[player.playerId.id] ? (
                playerAnswers[player.playerId.id].correct ? (
                  <span className="correct-badge">✓</span>
                ) : (
                  <span className="incorrect-badge">✗</span>
                )
              ) : (
                <span className="waiting-badge">...</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  // Render leaderboard view
  const renderLeaderboard = () => {
    return (
      <div className="leaderboard">
        {sortedPlayers.slice(0, 10).map((player, index) => (
          <div 
            key={player.playerId.id} 
            className={`leaderboard-item ${index < 3 ? 'top-three' : ''}`}
          >
            <div className="rank">#{index + 1}</div>
            <div className="player-info">
              <div className="player-avatar">
                {player.playerId.avatar ? (
                  <img src={player.playerId.avatar} alt="Avatar" />
                ) : (
                  player.playerId.name.charAt(0)
                )}
              </div>
              <div className="player-name">
                {player.playerId.name}
              </div>
            </div>
            <div className="player-score">{player.score}</div>
          </div>
        ))}
      </div>
    );
  };
  
  return (
    <div className="player-status-panel">
      <div className="panel-header">
        <h2>Player Status</h2>
        <div className="view-toggle">
          <button 
            className={`toggle-button ${displayMode === 'status' ? 'active' : ''}`}
            onClick={() => setDisplayMode('status')}
          >
            Status
          </button>
          <button 
            className={`toggle-button ${displayMode === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setDisplayMode('leaderboard')}
          >
            Leaderboard
          </button>
        </div>
      </div>
      
      {players.length === 0 ? (
        <div className="no-players">
          <p>No players have joined yet.</p>
        </div>
      ) : (
        <>
          <div className="stats-bar">
            <div className="stat-item">
              <div className="stat-label">Players</div>
              <div className="stat-value">{stats.total}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Answered</div>
              <div className="stat-value">{stats.answered} ({stats.percentAnswered}%)</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Correct</div>
              <div className="stat-value">{stats.correct} ({stats.percentCorrect}%)</div>
            </div>
          </div>
          
          {displayMode === 'status' ? renderPlayerStatus() : renderLeaderboard()}
        </>
      )}
    </div>
  );
};

export default PlayerStatusPanel;
