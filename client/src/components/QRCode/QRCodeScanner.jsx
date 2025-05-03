import React, { useState, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import PropTypes from 'prop-types';
import './QRCodeScanner.css';

/**
 * QR Code Scanner Component
 * Scans QR codes using the device camera
 */
const QRCodeScanner = ({ 
  onScan, 
  onError,
  qrCodeSuccessCallback,
  qrCodeErrorCallback,
  facingMode = 'environment',
  fps = 10,
  qrbox = { width: 250, height: 250 },
  aspectRatio = 1.0,
  disableFlip = false,
  showToggleButton = true,
  showTorchButton = true
}) => {
  const [html5QrCode, setHtml5QrCode] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  // Initialize the scanner
  useEffect(() => {
    const qrCodeScanner = new Html5Qrcode('qr-code-scanner');
    setHtml5QrCode(qrCodeScanner);

    // Get available cameras
    Html5Qrcode.getCameras()
      .then(devices => {
        if (devices && devices.length) {
          setCameras(devices);
          // Select the back camera by default if available
          const backCamera = devices.find(
            camera => camera.label.toLowerCase().includes('back')
          );
          setSelectedCameraId(backCamera ? backCamera.id : devices[0].id);
        } else {
          setError('No cameras found on this device');
        }
      })
      .catch(err => {
        console.error('Error getting cameras:', err);
        setError('Error accessing camera: ' + err.message);
        if (onError) {
          onError(err);
        }
      });

    // Cleanup on unmount
    return () => {
      if (qrCodeScanner && qrCodeScanner.isScanning) {
        qrCodeScanner.stop()
          .catch(err => console.error('Error stopping scanner:', err));
      }
    };
  }, [onError]);

  // Handle successful scan
  const handleScan = (decodedText, decodedResult) => {
    // Stop scanning after a successful scan
    if (html5QrCode && html5QrCode.isScanning) {
      html5QrCode.stop()
        .then(() => {
          console.log('Scanner stopped after successful scan');
          setIsScanning(false);
        })
        .catch(err => console.error('Error stopping scanner:', err));
    }

    // Extract game code from URL
    let gameCode = decodedText;
    
    // If the scanned text is a URL, extract the game code
    if (decodedText.includes('/join/')) {
      const urlParts = decodedText.split('/join/');
      if (urlParts.length > 1) {
        gameCode = urlParts[1].split('/')[0]; // Get the game code part
      }
    }

    setScanResult({
      text: decodedText,
      gameCode,
      result: decodedResult
    });

    // Call the provided callback
    if (qrCodeSuccessCallback) {
      qrCodeSuccessCallback(decodedText, decodedResult);
    }

    if (onScan) {
      onScan(gameCode, decodedText);
    }
  };

  // Handle scan error
  const handleScanError = (errorMessage) => {
    console.error('QR Code scanning error:', errorMessage);
    
    if (qrCodeErrorCallback) {
      qrCodeErrorCallback(errorMessage);
    }
  };

  // Start scanning
  const startScanner = () => {
    if (!html5QrCode || !selectedCameraId) {
      setError('Scanner not initialized or no camera selected');
      return;
    }

    setError(null);
    setScanResult(null);
    setIsScanning(true);

    const config = {
      fps,
      qrbox,
      aspectRatio,
      disableFlip,
      formatsToSupport: [Html5Qrcode.FORMATS.QR_CODE]
    };

    html5QrCode.start(
      selectedCameraId,
      config,
      handleScan,
      handleScanError
    )
    .catch(err => {
      console.error('Error starting scanner:', err);
      setError('Failed to start scanner: ' + err.message);
      setIsScanning(false);
      if (onError) {
        onError(err);
      }
    });
  };

  // Stop scanning
  const stopScanner = () => {
    if (html5QrCode && html5QrCode.isScanning) {
      html5QrCode.stop()
        .then(() => {
          console.log('Scanner stopped');
          setIsScanning(false);
        })
        .catch(err => {
          console.error('Error stopping scanner:', err);
          if (onError) {
            onError(err);
          }
        });
    }
  };

  // Toggle camera (front/back)
  const toggleCamera = () => {
    if (cameras.length <= 1) {
      return; // Only one camera available, nothing to toggle
    }

    stopScanner();
    
    // Find the next camera in the list
    const currentIndex = cameras.findIndex(camera => camera.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    setSelectedCameraId(cameras[nextIndex].id);
    
    // Restart scanner with new camera after a short delay
    setTimeout(() => {
      startScanner();
    }, 300);
  };

  // Toggle torch/flashlight
  const toggleTorch = () => {
    if (!html5QrCode || !html5QrCode.isScanning) {
      return;
    }

    const newTorchState = !torchEnabled;
    html5QrCode.applyVideoConstraints({
      advanced: [{ torch: newTorchState }]
    })
    .then(() => {
      setTorchEnabled(newTorchState);
      console.log(`Torch ${newTorchState ? 'enabled' : 'disabled'}`);
    })
    .catch(err => {
      console.error('Error toggling torch:', err);
      if (onError) {
        onError(new Error('Torch control not supported on this device'));
      }
    });
  };

  // Reset scanner after successful scan
  const resetScanner = () => {
    setScanResult(null);
    startScanner();
  };

  return (
    <div className="qr-scanner-container">
      {error && (
        <div className="qr-scanner-error">
          <p>{error}</p>
        </div>
      )}

      {!scanResult ? (
        <>
          <div id="qr-code-scanner" className="qr-scanner-viewport"></div>
          
          <div className="qr-scanner-controls">
            {!isScanning ? (
              <button 
                className="qr-scanner-start-btn"
                onClick={startScanner}
                disabled={!selectedCameraId}
              >
                Start Scanner
              </button>
            ) : (
              <button 
                className="qr-scanner-stop-btn"
                onClick={stopScanner}
              >
                Stop Scanner
              </button>
            )}
            
            {isScanning && showToggleButton && cameras.length > 1 && (
              <button 
                className="qr-scanner-toggle-btn"
                onClick={toggleCamera}
              >
                Switch Camera
              </button>
            )}
            
            {isScanning && showTorchButton && (
              <button 
                className={`qr-scanner-torch-btn ${torchEnabled ? 'active' : ''}`}
                onClick={toggleTorch}
              >
                {torchEnabled ? 'Turn Off Flashlight' : 'Turn On Flashlight'}
              </button>
            )}
          </div>
          
          <div className="qr-scanner-instructions">
            <p>Point your camera at a QR code to scan it</p>
          </div>
        </>
      ) : (
        <div className="qr-scanner-result">
          <h3>QR Code Scanned Successfully!</h3>
          <p>Game Code: <strong>{scanResult.gameCode}</strong></p>
          <div className="qr-scanner-result-actions">
            <button 
              className="qr-scanner-reset-btn"
              onClick={resetScanner}
            >
              Scan Another Code
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

QRCodeScanner.propTypes = {
  onScan: PropTypes.func.isRequired,
  onError: PropTypes.func,
  qrCodeSuccessCallback: PropTypes.func,
  qrCodeErrorCallback: PropTypes.func,
  facingMode: PropTypes.oneOf(['environment', 'user']),
  fps: PropTypes.number,
  qrbox: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.object
  ]),
  aspectRatio: PropTypes.number,
  disableFlip: PropTypes.bool,
  showToggleButton: PropTypes.bool,
  showTorchButton: PropTypes.bool
};

export default QRCodeScanner;
