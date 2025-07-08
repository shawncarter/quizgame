import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePlayer } from '../../context/PlayerContext';
import playerApiService from '../../services/playerApiService';
import './PlayerProfile.css';

/**
 * Player profile component
 * Displays player information and game statistics
 */
const PlayerProfile = () => {
  const navigate = useNavigate();
  const { player, logoutPlayer, deleteAccount, isLoggedIn, loading } = usePlayer();
  
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  
  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !isLoggedIn) {
      navigate('/register');
    }
  }, [isLoggedIn, loading, navigate]);
  
  // Load player stats
  useEffect(() => {
    const fetchStats = async () => {
      if (player && player?.id) {
        try {
          setLoadingStats(true);
          const playerStats = await playerApiService.getPlayerStats(player?.id);
          setStats(playerStats);
        } catch (err) {
          console.error('Error loading player stats:', err);
          setError('Failed to load player statistics');
        } finally {
          setLoadingStats(false);
        }
      }
    };
    
    fetchStats();
  }, [player]);
  
  // Handle edit profile button
  const handleEditProfile = () => {
    navigate('/profile/edit');
  };
  
  // Handle logout button
  const handleLogout = () => {
    logoutPlayer();
    navigate('/');
  };
  
  // Handle delete account button
  const handleDeleteAccount = async () => {
    try {
      await deleteAccount();
      navigate('/');
    } catch (err) {
      console.error('Error deleting account:', err);
      setError('Failed to delete account');
    }
  };
  
  if (loading) {
    return <div className="loading">Loading profile...</div>;
  }
  
  if (!player) {
    return (
      <div className="player-profile-container">
        <h2>Profile Not Found</h2>
        <p>You need to register or log in to view your profile.</p>
        <div className="profile-actions">
          <Link to="/register" className="button primary-button">Register</Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="player-profile-container">
      <h2>Player Profile</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="profile-card">
        <div className="profile-header">
          <div className="avatar-display">
            <div className="avatar-image">{player.avatar || 'Default Avatar'}</div>
          </div>
          <div className="profile-info">
            <h3>{player.name}</h3>
            <p className="profile-detail">Age: {player.age}</p>
            <p className="profile-detail">Specialist Subject: {player.specialistSubject}</p>
          </div>
        </div>
        
        <div className="profile-stats">
          <h4>Game Statistics</h4>
          {loadingStats ? (
            <p>Loading statistics...</p>
          ) : stats ? (
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Games Played</span>
                <span className="stat-value">{stats.totalGames}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Average Score</span>
                <span className="stat-value">{stats.averageScore.toFixed(1)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Wins</span>
                <span className="stat-value">{stats.totalWins}</span>
              </div>
            </div>
          ) : (
            <p>No statistics available</p>
          )}
        </div>
        
        <div className="profile-actions">
          <button 
            onClick={handleEditProfile}
            className="button primary-button"
          >
            Edit Profile
          </button>
          <button 
            onClick={handleLogout}
            className="button secondary-button"
          >
            Logout
          </button>
          <button 
            onClick={() => setShowConfirmDelete(true)}
            className="button danger-button"
          >
            Delete Account
          </button>
        </div>
      </div>
      
      {showConfirmDelete && (
        <div className="confirm-delete-modal">
          <div className="modal-content">
            <h3>Confirm Account Deletion</h3>
            <p>Are you sure you want to delete your account? This action cannot be undone.</p>
            <div className="modal-actions">
              <button 
                onClick={() => setShowConfirmDelete(false)}
                className="button secondary-button"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteAccount}
                className="button danger-button"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerProfile;
