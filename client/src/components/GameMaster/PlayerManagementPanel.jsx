import React, { useState, useCallback } from 'react';
import { useGame } from '../../context/GameContext';
import gameSessionService from '../../services/gameSessionService';
import './PlayerManagementPanel.css';

/**
 * Player Management Panel
 * Allows the game master to view and manage players
 */
const PlayerManagementPanel = ({ players, gameStatus, gameSession }) => {
  const { kickPlayer } = useGame();
  
  // State hooks must be at the top level
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('joinedAt');
  const [sortDirection, setSortDirection] = useState('asc');
  const [confirmKick, setConfirmKick] = useState(null);
  const [addingTestPlayers, setAddingTestPlayers] = useState(false);
  
  // Handle adding test players
  const handleAddTestPlayers = useCallback(async () => {
    if (!gameSession?.id) {
      alert('No game session found');
      return;
    }

    setAddingTestPlayers(true);
    try {
      const result = await gameSessionService.addTestPlayers(gameSession.id, 1); // Add just 1 test player
      console.log('Test player added:', result);
      alert(`Added test player successfully!`);
      window.location.reload();
    } catch (error) {
      console.error('Error adding test player:', error);
      alert('Failed to add test player: ' + (error.message || 'Unknown error'));
    } finally {
      setAddingTestPlayers(false);
    }
  }, [gameSession]);
  
  // Add comprehensive error boundary protection and debugging
  console.log('PlayerManagementPanel - Raw players data:', players);
  console.log('PlayerManagementPanel - Players type:', typeof players);
  
  // Handle different cases for players data
  let playersArray = [];
  
  if (Array.isArray(players)) {
    playersArray = players;
  } else if (players && typeof players === 'object' && players.players && Array.isArray(players.players)) {
    // Handle case where players is an object with a players array property
    playersArray = players.players;
  } else if (gameSession?.players && Array.isArray(gameSession.players)) {
    // Fallback to gameSession.players if available
    playersArray = gameSession.players;
  }
  
  console.log('PlayerManagementPanel - Processed players array:', playersArray);
  console.log('PlayerManagementPanel - Players length:', playersArray.length);

  if (!playersArray || playersArray.length === 0) {
    console.log('PlayerManagementPanel - No players data available');
    return (
      <div className="player-management-panel">
        <div className="panel-header">
          <h2>Players (0)</h2>
        </div>
        <div className="no-players">
          <p>No players have joined yet.</p>
          <button 
            onClick={handleAddTestPlayers} 
            className="add-test-players-btn"
            disabled={addingTestPlayers || gameStatus === 'completed'}
          >
            {addingTestPlayers ? 'Adding...' : '+ Add Test Player'}
          </button>
        </div>
      </div>
    );
  }

  if (!Array.isArray(players)) {
    console.error('PlayerManagementPanel - Players is not an array:', players);
    return (
      <div className="player-management-panel">
        <div className="panel-header">
          <h2>Players (Error)</h2>
        </div>
        <div className="no-players">
          <p style={{ color: 'red' }}>Error: Players data is not an array</p>
          <pre style={{ fontSize: '12px', background: '#f0f0f0', padding: '10px' }}>
            {JSON.stringify(players, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  if (players.length === 0) {
    console.log('PlayerManagementPanel - Empty players array');
    return (
      <div className="player-management-panel">
        <div className="panel-header">
          <h2>Players (0)</h2>
        </div>
        <div className="no-players">
          <p>No players have joined yet.</p>
        </div>
      </div>
    );
  }
  
  // Filter players by search term - handle both regular and test players
  console.log('PlayerManagementPanel - Filtering players with search term:', searchTerm);
  const filteredPlayers = players.filter((player, index) => {
    try {
      const playerName = player.playerId?.name || player.name || '';
      console.log(`Player ${index}:`, {
        player,
        playerName,
        hasPlayerId: !!player.playerId,
        hasName: !!player.name
      });
      return playerName.toLowerCase().includes(searchTerm.toLowerCase());
    } catch (error) {
      console.error(`Error filtering player ${index}:`, error, player);
      return false;
    }
  });
  console.log('PlayerManagementPanel - Filtered players:', filteredPlayers);
  
  // Sort players - handle both regular and test players
  console.log('PlayerManagementPanel - Sorting players by:', sortBy, sortDirection);
  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    try {
      let aValue, bValue;

      switch (sortBy) {
        case 'name':
          aValue = (a.playerId?.name || a.name || '').toLowerCase();
          bValue = (b.playerId?.name || b.name || '').toLowerCase();
          break;
        case 'score':
          aValue = a.score || 0;
          bValue = b.score || 0;
          break;
        case 'position':
          aValue = a.position || 999;
          bValue = b.position || 999;
          break;
        case 'joinedAt':
        default:
          aValue = new Date(a.joinedAt || 0).getTime();
          bValue = new Date(b.joinedAt || 0).getTime();
          break;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    } catch (error) {
      console.error('Error sorting players:', error, { a, b });
      return 0;
    }
  });
  console.log('PlayerManagementPanel - Sorted players:', sortedPlayers);
  
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

  // End of sort indicator helper function
  
  return (
    <div className="player-management-panel">
      <div className="panel-header">
        <h2>Players ({players.length})</h2>
        <div className="panel-actions">
          <button
            onClick={handleAddTestPlayers}
            disabled={addingTestPlayers || gameStatus === 'completed'}
            className="add-test-players-btn"
          >
            {addingTestPlayers ? 'Adding...' : '+ Add Test Players'}
          </button>
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
              {sortedPlayers.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                    No players match the current search criteria
                  </td>
                </tr>
              ) : (
                sortedPlayers.map((player, index) => {
                  try {
                    console.log(`Rendering player ${index}:`, player);

                    // Handle both regular players (with playerId object) and test players (direct structure)
                    const playerId = player.playerId?.id || player.playerId?.id || player?.id || `player-${index}`;
                    const playerName = player.playerId?.name || player.name || 'Unknown Player';
                    const playerAvatar = player.playerId?.avatar || player.avatar;
                    const playerScore = player.score || 0;
                    const playerPosition = player.position || 0;
                    const playerJoinedAt = player.joinedAt;
                    const isActive = player.active !== false; // Default to active if not specified

                    console.log(`Player ${index} extracted data:`, {
                      playerId, playerName, playerAvatar, playerScore, playerPosition, playerJoinedAt, isActive
                    });

                    return (
                      <tr key={playerId} className={isActive ? '' : 'inactive'}>
                        <td className="player-name">
                          <div className="avatar">
                            {playerAvatar && playerAvatar !== 'test-avatar' ? (
                              <img src={playerAvatar} alt="Avatar" />
                            ) : (
                              playerName?.charAt(0) || '?'
                            )}
                          </div>
                          {playerName || 'Unknown Player'}
                          {!isActive && <span className="inactive-badge">Inactive</span>}
                        </td>
                        <td>{playerScore}</td>
                        <td>{playerPosition > 0 ? `#${playerPosition}` : '-'}</td>
                        <td>
                          {playerJoinedAt ? new Date(playerJoinedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : '-'}
                        </td>
                        <td>
                          {confirmKick === playerId ? (
                            <div className="confirm-actions">
                              <button
                                onClick={() => handleKickPlayer(playerId)}
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
                              onClick={() => setConfirmKick(playerId)}
                              className="kick-button"
                              disabled={gameStatus === 'completed'}
                            >
                              Kick
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  } catch (error) {
                    console.error('Error rendering player:', player, error);
                    return (
                      <tr key={`error-${index}`}>
                        <td colSpan="5" style={{ color: 'red', textAlign: 'center' }}>
                          Error displaying player data: {error.message}
                        </td>
                      </tr>
                    );
                  }
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PlayerManagementPanel;
