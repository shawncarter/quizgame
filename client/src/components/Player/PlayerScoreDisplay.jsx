import React from 'react';
import './PlayerScoreDisplay.css';

/**
 * Player score display component
 * @param {Object} props - Component props
 * @param {number} props.score - Player's current score
 * @param {number} props.rank - Player's current rank
 * @param {number} props.totalPlayers - Total number of players
 * @param {Array} props.recentPoints - Recent points earned (for animation)
 * @param {Object} props.stats - Additional player statistics
 */
const PlayerScoreDisplay = ({ 
  score = 0, 
  rank = 0, 
  totalPlayers = 0,
  recentPoints = null,
  stats = {}
}) => {
  // Format rank with suffix (1st, 2nd, 3rd, etc.)
  const formatRank = (rank) => {
    if (rank <= 0) return '-';
    
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const suffix = rank % 100 <= 10 || rank % 100 >= 14 
      ? suffixes[rank % 10] || 'th'
      : 'th';
      
    return `${rank}${suffix}`;
  };

  return (
    <div className="player-score-display">
      <div className="score-section">
        <div className="score-value">
          <span className="score-number">{score}</span>
          {recentPoints && (
            <span className={`recent-points ${recentPoints > 0 ? 'positive' : 'negative'}`}>
              {recentPoints > 0 ? '+' : ''}{recentPoints}
            </span>
          )}
        </div>
        <div className="score-label">Points</div>
      </div>
      
      {rank > 0 && (
        <div className="rank-section">
          <div className="rank-value">{formatRank(rank)}</div>
          <div className="rank-label">
            of {totalPlayers} {totalPlayers === 1 ? 'player' : 'players'}
          </div>
        </div>
      )}
      
      {Object.keys(stats).length > 0 && (
        <div className="stats-section">
          {Object.entries(stats).map(([key, value]) => (
            <div key={key} className="stat-item">
              <div className="stat-value">{value}</div>
              <div className="stat-label">{key}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlayerScoreDisplay;
