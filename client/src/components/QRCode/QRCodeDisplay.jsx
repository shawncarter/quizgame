import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import PropTypes from 'prop-types';
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
    if (gameCode) {
      // If game code is provided directly, construct the join URL
      const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      setJoinUrl(`${baseUrl}/join/${gameCode}`);
    } else if (gameSessionId) {
      // If game session ID is provided, fetch the game code
      setIsLoading(true);
      fetch(`/api/games/${gameSessionId}`)
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to fetch game session');
          }
          return response.json();
        })
        .then(data => {
          const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
          setJoinUrl(`${baseUrl}/join/${data.code}`);
          setIsLoading(false);
        })
        .catch(err => {
          console.error('Error fetching game session:', err);
          setError(err.message);
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
