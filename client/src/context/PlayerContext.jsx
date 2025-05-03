import React, { createContext, useState, useEffect, useContext } from 'react';
import playerApiService from '../services/playerApiService';
import playerService from '../services/playerService';

// Create the context
const PlayerContext = createContext();

/**
 * Provider component for player-related state management
 * Handles player authentication, registration, and profile updates
 */
export const PlayerProvider = ({ children }) => {
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load player on initial mount
  useEffect(() => {
    const loadPlayer = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Check if player exists in localStorage or by device ID
        const exists = await playerApiService.loadExistingPlayer();
        
        if (exists) {
          // Get player data from localStorage
          const playerData = playerService.getPlayerData();
          setPlayer(playerData);
        }
      } catch (err) {
        console.error('Error loading player:', err);
        setError('Failed to load player profile');
      } finally {
        setLoading(false);
      }
    };

    loadPlayer();
  }, []);

  /**
   * Register a new player
   * @param {Object} playerData - Player registration data
   * @returns {Promise<Object>} The registered player
   */
  const registerPlayer = async (playerData) => {
    try {
      setLoading(true);
      setError(null);
      
      const newPlayer = await playerApiService.registerPlayer(playerData);
      setPlayer(newPlayer);
      return newPlayer;
    } catch (err) {
      console.error('Error registering player:', err);
      setError(err.response?.data?.message || 'Failed to register player');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update player profile
   * @param {Object} updates - Player data to update
   * @returns {Promise<Object>} The updated player
   */
  const updateProfile = async (updates) => {
    try {
      if (!player || !player._id) {
        throw new Error('No player logged in');
      }
      
      setLoading(true);
      setError(null);
      
      const updatedPlayer = await playerApiService.updatePlayer(player._id, updates);
      setPlayer(updatedPlayer);
      return updatedPlayer;
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.response?.data?.message || 'Failed to update profile');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Log out the current player
   */
  const logoutPlayer = () => {
    playerService.clearPlayerData();
    setPlayer(null);
  };

  /**
   * Delete the player account
   * @returns {Promise<void>}
   */
  const deleteAccount = async () => {
    try {
      if (!player || !player._id) {
        throw new Error('No player logged in');
      }
      
      setLoading(true);
      setError(null);
      
      await playerApiService.deletePlayer(player._id);
      playerService.clearPlayerData();
      setPlayer(null);
    } catch (err) {
      console.error('Error deleting account:', err);
      setError(err.response?.data?.message || 'Failed to delete account');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Context value
  const value = {
    player,
    loading,
    error,
    isLoggedIn: !!player,
    registerPlayer,
    updateProfile,
    logoutPlayer,
    deleteAccount
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
};

// Custom hook for using the player context
export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};

export default PlayerContext;
