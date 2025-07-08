import React, { createContext, useState, useEffect, useContext } from 'react';
import playerApiService from '../services/playerApiService';
import playerService from '../services/playerService';
import socketService from '../services/socketService';

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
    console.log('🚀 PlayerContext useEffect triggered - starting player load...');

    const loadPlayer = async () => {
      try {
        console.log('🔄 Setting loading to true...');
        setLoading(true);
        setError(null);

        // First check localStorage for player data
        console.log('🔍 Checking if player is registered in localStorage...');
        const isRegistered = playerService.isPlayerRegistered();
        console.log('🔍 isPlayerRegistered result:', isRegistered);

        if (isRegistered) {
          // Get player data from localStorage
          console.log('✅ Player found in localStorage, loading data...');
          const playerData = playerService.getPlayerData();
          console.log('✅ Player data from localStorage:', playerData);
          
          // Make sure we have a valid player object
          if (playerData && playerData.id) {
            setPlayer(playerData);
            console.log('✅ Player loaded from localStorage:', playerData?.name);
            
            // Reconnect socket with the existing player credentials
            try {
              // Disconnect current socket if it exists
              socketService.disconnect();
              
              // Reconnect with player ID
              socketService.connect({ playerId: playerData.id });
              console.log('Socket reconnected with existing player credentials');
            } catch (socketError) {
              console.warn('Socket reconnection failed, but player was loaded successfully:', socketError);
            }
          } else {
            console.warn('⚠️ Invalid player data in localStorage, clearing...');
            playerService.clearPlayerData();
            throw new Error('Invalid player data');
          }
        } else {
          // If no localStorage data, check if player exists on server using deviceId
          console.log('🔍 No player in localStorage - checking server with deviceId...');
          const deviceId = playerService.getDeviceId();
          console.log('🔍 Device ID:', deviceId);

          try {
            // Try to find existing player by deviceId
            console.log('🔍 Calling findPlayerByDeviceId...');
            const existingPlayer = await playerApiService.findPlayerByDeviceId();
            console.log('🔍 Server response:', existingPlayer);

            if (existingPlayer && existingPlayer.id) {
              // Player exists on server, save to localStorage and set state
              console.log('✅ Player found on server, restoring to localStorage:', existingPlayer.name);
              playerService.savePlayerId(existingPlayer.id);
              playerService.savePlayerData(existingPlayer);
              setPlayer(existingPlayer);
              
              // Reconnect socket with the restored player credentials
              try {
                socketService.disconnect();
                socketService.connect({ playerId: existingPlayer.id });
                console.log('Socket reconnected with restored player credentials');
              } catch (socketError) {
                console.warn('Socket reconnection failed, but player was restored successfully:', socketError);
              }
              
              console.log('✅ Player restored successfully. Final player state:', existingPlayer);
              console.log('✅ isLoggedIn should now be:', !!existingPlayer);
            } else {
              console.log('❌ No player found on server - registration required');
              console.log('❌ Player state will remain null, isLoggedIn will be false');
            }
          } catch (serverError) {
            console.log('❌ Server check failed - registration required:', serverError.message);
            console.log('❌ Full error:', serverError);
            // Don't set error here, just continue without player
          }
        }
      } catch (err) {
        console.error('❌ Error loading player:', err);
        setError('Failed to load player profile');
      } finally {
        console.log('🔄 Setting loading to false...');
        setLoading(false);
        console.log('🏁 Player load complete. Final state check:');
        console.log('   - loading:', false);
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
      
      // Reconnect socket with the new player credentials
      try {
        // Disconnect current socket if it exists
        socketService.disconnect();
        
        // Reconnect with new player ID
        socketService.connect({ playerId: newPlayer.id });
        console.log('Socket reconnected with new player credentials');
      } catch (socketError) {
        console.warn('Socket reconnection failed, but player was registered successfully:', socketError);
        // Don't throw here as the player registration was successful
      }
      
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
      if (!player || !player?.id) {
        throw new Error('No player logged in');
      }

      setLoading(true);
      setError(null);

      const updatedPlayer = await playerApiService.updatePlayer(player?.id, updates);
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
      if (!player || !player?.id) {
        throw new Error('No player logged in');
      }

      setLoading(true);
      setError(null);

      await playerApiService.deletePlayer(player?.id);
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

  // Debug logging for player state changes
  useEffect(() => {
    console.log('🔍 PlayerContext state changed:');
    console.log('   - player:', player);
    console.log('   - isLoggedIn:', !!player);
    console.log('   - loading:', loading);
    console.log('   - error:', error);
  }, [player, loading, error]);

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


/**
 * Custom hook to use the PlayerContext
 * @returns {Object} Player context data (player, loading, error, actions)
 */
export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};

export default PlayerContext;

