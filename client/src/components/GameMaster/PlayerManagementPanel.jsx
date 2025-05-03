import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import './PlayerManagementPanel.css';

/**
 * Player Management Panel
 * Allows the game master to view and manage players
 */
const PlayerManagementPanel = ({ players, gameStatus }) => {
  const { kickPlayer } = useGame();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('joinedAt');
  const [sortDirection, setSortDirection] = useState('asc');
  const [confirmKick, setConfirmKick] = useState(null);
  
  // Filter players by search term
  const filteredPlayers = players.filter(player => 
    player.playerId.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Sort players
  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'name':
        aValue = a.playerId.name.toLowerCase();
        bValue = b.playerId.name.toLowerCase();
        break;
      case 'score':
        aValue = a.score;
        bValue = b.score;
        break;
      case 'position':
        aValue = a.position;
        bValue = b.position;
        break;
      case 'joinedAt':
      default:
        aValue = new Date(a.joinedAt).getTime();
        bValue = new Date(b.joinedAt).getTime();
        break;
    }
    
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });
  
  // Handle sort column click
  const handleSort = (column) => {
    if (sortBy === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      setSortBy(column);
      setSortDirection('asc');
    }
  };
  
  // Handle kick player
  const handleKickPlayer = (playerId) => {
    kickPlayer(playerId);
    setConfirmKick(null);
  };
  
  // Get sort indicator
  const getSortIndicator = (column) => {
    if (sortBy !== column) return null;
    
    return (
      <span className="sort-indicator">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };
  
  return (
    <div className="player-management-panel">
      <div className="panel-header">
        <h2>Players ({players.length})</h2>
        <div className="search-container">
          <input
            type="text"
            placeholder="Search players..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>
      
      {players.length === 0 ? (
        <div className="no-players">
          <p>No players have joined yet.</p>
          <p className="hint">Share the game code or QR code to invite players.</p>
        </div>
      ) : (
        <div className="players-table-container">
          <table className="players-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} className="sortable">
                  Name {getSortIndicator('name')}
                </th>
                <th onClick={() => handleSort('score')} className="sortable">
                  Score {getSortIndicator('score')}
                </th>
                <th onClick={() => handleSort('position')} className="sortable">
                  Position {getSortIndicator('position')}
                </th>
                <th onClick={() => handleSort('joinedAt')} className="sortable">
                  Joined {getSortIndicator('joinedAt')}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player) => (
                <tr key={player.playerId._id} className={player.active ? '' : 'inactive'}>
                  <td className="player-name">
                    <div className="avatar">
                      {player.playerId.avatar ? (
                        <img src={player.playerId.avatar} alt="Avatar" />
                      ) : (
                        player.playerId.name.charAt(0)
                      )}
                    </div>
                    {player.playerId.name}
                    {!player.active && <span className="inactive-badge">Inactive</span>}
                  </td>
                  <td>{player.score}</td>
                  <td>{player.position > 0 ? `#${player.position}` : '-'}</td>
                  <td>
                    {new Date(player.joinedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td>
                    {confirmKick === player.playerId._id ? (
                      <div className="confirm-actions">
                        <button
                          onClick={() => handleKickPlayer(player.playerId._id)}
                          className="confirm-button"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmKick(null)}
                          className="cancel-button"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmKick(player.playerId._id)}
                        className="kick-button"
                        disabled={gameStatus === 'completed'}
                      >
                        Kick
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PlayerManagementPanel;
