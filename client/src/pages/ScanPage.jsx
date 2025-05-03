import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeScanner } from '../components/QRCode';
import './ScanPage.css';

/**
 * Scan Page
 * Page for scanning QR codes to join games
 */
const ScanPage = () => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

  // Handle successful QR code scan
  const handleScan = (gameCode, rawText) => {
    console.log('QR Code scanned:', { gameCode, rawText });
    
    if (!gameCode) {
      setError('Invalid QR code. Please scan a valid game QR code.');
      return;
    }
    
    setIsValidating(true);
    setError(null);
    
    // Validate the game code with the server
    fetch(`/api/qr-codes/validate/${gameCode}`)
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to validate game code');
        }
        return response.json();
      })
      .then(data => {
        setIsValidating(false);
        
        if (data.isValid) {
          // Redirect to join page with the game code
          navigate(`/join/${gameCode}`);
        } else {
          setError('Game code is invalid or the game has expired.');
        }
      })
      .catch(err => {
        console.error('Error validating game code:', err);
        setIsValidating(false);
        setError('Failed to validate game code. Please try again.');
      });
  };

  // Handle QR code scanning errors
  const handleError = (err) => {
    console.error('QR Code scanning error:', err);
    setError('Error scanning QR code: ' + err.message);
  };

  return (
    <div className="scan-page">
      <div className="scan-page-header">
        <h1>Scan QR Code</h1>
        <p>Scan a QR code to join a game session</p>
      </div>
      
      {error && (
        <div className="scan-page-error">
          <p>{error}</p>
        </div>
      )}
      
      {isValidating && (
        <div className="scan-page-validating">
          <p>Validating game code...</p>
        </div>
      )}
      
      <div className="scan-page-content">
        <QRCodeScanner 
          onScan={handleScan}
          onError={handleError}
          facingMode="environment"
          showToggleButton={true}
          showTorchButton={true}
        />
      </div>
      
      <div className="scan-page-alternative">
        <p>Don't have a QR code?</p>
        <button 
          className="scan-page-manual-btn"
          onClick={() => navigate('/join')}
        >
          Enter Game Code Manually
        </button>
      </div>
    </div>
  );
};

export default ScanPage;
