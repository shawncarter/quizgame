const express = require('express');
const router = express.Router();

// Import individual route modules
const playerRoutes = require('./players');
const gameRoutes = require('./games');
const questionRoutes = require('./questions');
const categoryRoutes = require('./categories');
const qrCodeRoutes = require('./qrCodes');

// Mount routes
router.use('/api/players', playerRoutes);
router.use('/api/games', gameRoutes);
router.use('/api/questions', questionRoutes);
router.use('/api/categories', categoryRoutes);
router.use('/api/qr-codes', qrCodeRoutes);

// API status route
router.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    time: new Date(),
    version: '1.0.0'
  });
});

module.exports = router;
