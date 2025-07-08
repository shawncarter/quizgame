import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { getBaseUrl, API_URL } from '../../config/config';
import './QRCodeDisplay.css';

/**
 * QR Code Display Component
 * Displays a QR code for a game session
 */
const QRCodeDisplay = ({
  gameSessionId,
  gameCode,
  size = 256,
  includeText = true,
  errorCorrectionLevel = 'M',
  darkColor = '#000000',
  lightColor = '#ffffff',
  onError
}) => {
  const [joinUrl, setJoinUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('QRCodeDisplay props:', { gameCode, gameSessionId, size });
    console.log('API_URL from config:', API_URL);

    if (gameCode) {
      // If game code is provided directly, construct the join URL
      const baseUrl = getBaseUrl();
      console.log('🔍 QR Code Debug Info:');
      console.log('Base URL for QR code:', baseUrl);
      console.log('Environment variables:', {
        VITE_APP_URL: import.meta.env.VITE_APP_URL,
        VITE_SERVER_URL: import.meta.env.VITE_SERVER_URL,
        VITE_API_URL: import.meta.env.VITE_API_URL,
        VITE_SOCKET_URL: import.meta.env.VITE_SOCKET_URL
      });
      console.log('window.location.origin:', window.location.origin);
      const finalUrl = `${baseUrl}/join/${gameCode}`;
      setJoinUrl(finalUrl);
      console.log('🎯 Final QR Code URL:', finalUrl);
      console.log('🎯 This URL should contain 192.168.0.87, not localhost!');
    } else if (gameSessionId) {
      // If game session ID is provided, fetch the game code
      setIsLoading(true);
      console.log('Fetching game session from:', `${API_URL}/games/${gameSessionId}`);
      axios.get(`${API_URL}/games/${gameSessionId}`)
        .then(response => {
          console.log('API response status:', response.status);
          console.log('API response data:', response.data);
          return response.data;
        })
        .then(data => {
          console.log('API response data:', data);
          const gameData = data.data || data;
          console.log('Game data extracted:', gameData);
          const baseUrl = getBaseUrl();
          setJoinUrl(`${baseUrl}/join/${gameData.code}`);
          console.log('QR Code URL:', `${baseUrl}/join/${gameData.code}`);
          setIsLoading(false);
        })
        .catch(err => {
          console.error('Error fetching game session:', err);
          console.error('Error details:', err.response ? err.response.data : 'No response data');
          setError(err.message || 'Failed to fetch game data');
          setIsLoading(false);
          if (onError) {
            onError(err);
          }
        });
    } else {
      setError('Either gameSessionId or gameCode must be provided');
      if (onError) {
        onError(new Error('Either gameSessionId or gameCode must be provided'));
      }
    }
  }, [gameSessionId, gameCode, onError]);

  // Handle download QR code as PNG
  const handleDownload = () => {
    const canvas = document.getElementById('qr-code-canvas');
    if (canvas) {
      const pngUrl = canvas
        .toDataURL('image/png')
        .replace('image/png', 'image/octet-stream');

      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `quizgame-${gameCode || 'session'}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  if (isLoading) {
    return <div className="qr-code-loading">Loading QR Code...</div>;
  }

  if (error) {
    return <div className="qr-code-error">Error: {error}</div>;
  }

  if (!joinUrl) {
    return null;
  }

  return (
    <div className="qr-code-container">
      <div className="qr-code">
        <QRCodeSVG
          id="qr-code-svg"
          value={joinUrl}
          size={size}
          level={errorCorrectionLevel}
          fgColor={darkColor}
          bgColor={lightColor}
          includeMargin={true}
          imageSettings={{
            src: '/logo.png',
            excavate: true,
            height: size * 0.1,
            width: size * 0.1,
          }}
        />
        <canvas
          id="qr-code-canvas"
          style={{ display: 'none' }}
          width={size}
          height={size}
        />
      </div>

      {includeText && (
        <div className="qr-code-text">
          <p className="qr-code-instructions">Scan to join the game</p>
          <p className="qr-code-game-code">Game Code: <strong>{gameCode}</strong></p>
          <p className="qr-code-url">{joinUrl}</p>
        </div>
      )}

      <div className="qr-code-actions">
        <button
          className="qr-code-download-btn"
          onClick={handleDownload}
          aria-label="Download QR Code"
        >
          Download QR Code
        </button>
      </div>
    </div>
  );
};

QRCodeDisplay.propTypes = {
  gameSessionId: PropTypes.string,
  gameCode: PropTypes.string,
  size: PropTypes.number,
  includeText: PropTypes.bool,
  errorCorrectionLevel: PropTypes.oneOf(['L', 'M', 'Q', 'H']),
  darkColor: PropTypes.string,
  lightColor: PropTypes.string,
  onError: PropTypes.func
};

export default QRCodeDisplay;
