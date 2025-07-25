import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeDisplay } from '../components/QRCode';
import gameSessionService from '../services/gameSessionService';
import './GameQRCodePage.css';

/**
 * Game QR Code Page
 * Displays a QR code for a game session that players can scan to join
 */
const GameQRCodePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [gameSession, setGameSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) {
      setError('No game session ID provided');
      setLoading(false);
      return;
    }

    console.log('Fetching game session with ID:', id);

    // Fetch game session details using the gameSessionService
    gameSessionService.getGameSessionById(id)
      .then(data => {
        console.log('Game session data received:', data);
        setGameSession(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching game session:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  // Handle QR code error
  const handleQRCodeError = (err) => {
    console.error('QR Code error:', err);
    setError('Error generating QR code: ' + err.message);
  };

  // Handle back to game button click
  const handleBackToGame = () => {
    navigate(`/game-master/${id}`);
  };

  if (loading) {
    return (
      <div className="game-qr-page loading">
        <div className="loading-spinner"></div>
        <p>Loading game session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="game-qr-page error">
        <h2>Error</h2>
        <p>{error}</p>
        <button
          className="game-qr-page-back-btn"
          onClick={() => navigate('/host')}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!gameSession) {
    return (
      <div className="game-qr-page error">
        <h2>Game Not Found</h2>
        <p>The requested game session could not be found.</p>
        <button
          className="game-qr-page-back-btn"
          onClick={() => navigate('/host')}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="game-qr-page">
      <div className="game-qr-page-header">
        <h1>Join Game: {gameSession.title || 'Quiz Game'}</h1>
        <p>Scan this QR code to join the game</p>
      </div>

      <div className="game-qr-page-content">
        {console.log('Rendering QRCodeDisplay with code:', gameSession.code)}
        <QRCodeDisplay
          gameCode={gameSession.code}
          size={300}
          includeText={true}
          onError={handleQRCodeError}
        />
      </div>

      <div className="game-qr-page-info">
        <div className="game-qr-page-info-item">
          <span className="label">Game Code:</span>
          <span className="value">{gameSession.code}</span>
        </div>

        <div className="game-qr-page-info-item">
          <span className="label">Status:</span>
          <span className="value status">{gameSession.status}</span>
        </div>

        <div className="game-qr-page-info-item">
          <span className="label">Players:</span>
          <span className="value">{gameSession.players?.length || 0}</span>
        </div>
      </div>

      <div className="game-qr-page-actions">
        <button
          className="game-qr-page-back-btn"
          onClick={handleBackToGame}
        >
          Back to Game
        </button>

        <button
          className="game-qr-page-print-btn"
          onClick={() => window.print()}
        >
          Print QR Code
        </button>
      </div>

      <div className="game-qr-page-instructions">
        <h3>Instructions for Players</h3>
        <ol>
          <li>Open the camera app on your smartphone</li>
          <li>Point your camera at the QR code above</li>
          <li>Tap on the notification that appears</li>
          <li>Enter your name to join the game</li>
        </ol>
        <p className="alternative">
          Alternatively, players can go to <strong>{import.meta.env.VITE_APP_URL || window.location.origin}/join</strong> and enter the game code: <strong>{gameSession.code}</strong>
        </p>
      </div>

      {import.meta.env.VITE_ENABLE_DEBUG === 'true' && (
        <div className="game-qr-page-debug">
          <h4>Debug Information</h4>
          <p>App URL: {import.meta.env.VITE_APP_URL || 'Not set'}</p>
          <p>Server URL: {import.meta.env.VITE_SERVER_URL || 'Not set'}</p>
          <p>API URL: {import.meta.env.VITE_API_URL || 'Not set'}</p>
          <p>Window Origin: {window.location.origin}</p>
          <p>Game Code: {gameSession.code}</p>
        </div>
      )}
    </div>
  );
};

export default GameQRCodePage;
