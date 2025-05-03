/**
 * QR Code Routes
 * Handles endpoints for QR code generation and validation
 */
const express = require('express');
const router = express.Router();
const { authenticate, authorizeGameMaster } = require('../middleware/auth');
const qrCodeService = require('../services/qrCodeService');

// Get QR code for a game session (as data URL)
router.get('/game-session/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const options = {
      errorCorrectionLevel: req.query.errorCorrectionLevel,
      margin: parseInt(req.query.margin) || 4,
      scale: parseInt(req.query.scale) || 4,
      darkColor: req.query.darkColor,
      lightColor: req.query.lightColor
    };

    const qrCodeDataUrl = await qrCodeService.generateGameSessionQRCode(id, options);
    res.json({ qrCode: qrCodeDataUrl });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get QR code for a game session (as SVG string)
router.get('/game-session/:id/svg', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const options = {
      errorCorrectionLevel: req.query.errorCorrectionLevel,
      margin: parseInt(req.query.margin) || 4,
      stringType: 'svg',
      darkColor: req.query.darkColor,
      lightColor: req.query.lightColor
    };

    const qrCodeSvg = await qrCodeService.generateGameSessionQRCodeString(id, options);
    res.type('svg');
    res.send(qrCodeSvg);
  } catch (error) {
    console.error('Error generating QR code SVG:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get QR code for a game session (as PNG image)
router.get('/game-session/:id/png', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const options = {
      errorCorrectionLevel: req.query.errorCorrectionLevel,
      margin: parseInt(req.query.margin) || 4,
      scale: parseInt(req.query.scale) || 4,
      darkColor: req.query.darkColor,
      lightColor: req.query.lightColor
    };

    const qrCodeBuffer = await qrCodeService.generateGameSessionQRCodeBuffer(id, options);
    res.type('png');
    res.send(qrCodeBuffer);
  } catch (error) {
    console.error('Error generating QR code PNG:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get QR code for a game code (as data URL)
router.get('/game-code/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const options = {
      errorCorrectionLevel: req.query.errorCorrectionLevel,
      margin: parseInt(req.query.margin) || 4,
      scale: parseInt(req.query.scale) || 4,
      darkColor: req.query.darkColor,
      lightColor: req.query.lightColor
    };

    const qrCodeDataUrl = await qrCodeService.generateQRCodeFromGameCode(code, options);
    res.json({ qrCode: qrCodeDataUrl });
  } catch (error) {
    console.error('Error generating QR code from game code:', error);
    res.status(500).json({ message: error.message });
  }
});

// Validate a game code
router.get('/validate/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const isValid = await qrCodeService.validateGameCode(code);
    
    res.json({ 
      code,
      isValid,
      message: isValid ? 'Game code is valid' : 'Game code is invalid or expired'
    });
  } catch (error) {
    console.error('Error validating game code:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
