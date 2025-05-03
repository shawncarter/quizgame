const express = require('express');
const router = express.Router();
const { Player } = require('../models');

// Get all players
router.get('/', async (req, res) => {
  try {
    const players = await Player.find();
    res.json(players);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get one player
router.get('/:id', getPlayer, (req, res) => {
  res.json(res.player);
});

// Get player by device ID
router.get('/device/:deviceId', async (req, res) => {
  try {
    const player = await Player.findByDeviceId(req.params.deviceId);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }
    res.json(player);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a player
router.post('/', async (req, res) => {
  const player = new Player({
    name: req.body.name,
    age: req.body.age,
    specialistSubject: req.body.specialistSubject,
    avatar: req.body.avatar,
    buzzerSound: req.body.buzzerSound,
    deviceId: req.body.deviceId
  });

  try {
    const newPlayer = await player.save();
    res.status(201).json(newPlayer);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update a player
router.patch('/:id', getPlayer, async (req, res) => {
  if (req.body.name != null) {
    res.player.name = req.body.name;
  }
  if (req.body.age != null) {
    res.player.age = req.body.age;
  }
  if (req.body.specialistSubject != null) {
    res.player.specialistSubject = req.body.specialistSubject;
  }
  if (req.body.avatar != null) {
    res.player.avatar = req.body.avatar;
  }
  if (req.body.buzzerSound != null) {
    res.player.buzzerSound = req.body.buzzerSound;
  }
  
  // Update last active time
  res.player.lastActive = new Date();

  try {
    const updatedPlayer = await res.player.save();
    res.json(updatedPlayer);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete a player
router.delete('/:id', getPlayer, async (req, res) => {
  try {
    await res.player.remove();
    res.json({ message: 'Player deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get player stats
router.get('/:id/stats', getPlayer, async (req, res) => {
  try {
    const stats = {
      totalGames: res.player.getTotalGamesPlayed(),
      averageScore: res.player.getAverageScore(),
      totalWins: res.player.getTotalWins()
    };
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get top players
router.get('/leaderboard/top', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const topPlayers = await Player.getTopPlayers(limit);
    res.json(topPlayers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Middleware function to get player by ID
async function getPlayer(req, res, next) {
  let player;
  try {
    player = await Player.findById(req.params.id);
    if (player == null) {
      return res.status(404).json({ message: 'Player not found' });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }

  res.player = player;
  next();
}

module.exports = router;
