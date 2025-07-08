const express = require('express');
const router = express.Router();
const { Player } = require('../models');

// Debug: Check if Player model is properly imported
console.log('Player model imported:', !!Player);
console.log('Player.findByDeviceId exists:', typeof Player.findByDeviceId === 'function');

// Get all players
router.get('/', async (req, res) => {
  try {
    const players = await Player.findAll();
    res.json(players);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get player by device ID - IMPORTANT: This route must be defined before the /:id route
router.get('/device/:deviceId', async (req, res) => {
  try {
    console.log(`Attempting to find player by device ID: ${req.params.deviceId}`);

    // Check if the static method exists
    if (typeof Player.findByDeviceId !== 'function') {
      console.error('Player.findByDeviceId is not a function!');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const player = await Player.findByDeviceId(req.params.deviceId);
    console.log('Player search result:', player ? 'Found' : 'Not found');

    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }
    res.json(player);
  } catch (err) {
    console.error('Error finding player by device ID:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get one player
router.get('/:id', getPlayer, (req, res) => {
  res.json(res.player);
});

// Create a player
router.post('/', async (req, res) => {
  try {
    // Log the incoming request data for debugging
    console.log('🔍 Player Registration Request:');
    console.log('   Full request body:', JSON.stringify(req.body, null, 2));
    console.log('   Name:', req.body.name, '(type:', typeof req.body.name, ')');
    console.log('   Age:', req.body.age, '(type:', typeof req.body.age, ')');
    console.log('   Specialist Subject:', req.body.specialistSubject, '(type:', typeof req.body.specialistSubject, ')');
    console.log('   Avatar:', req.body.avatar, '(type:', typeof req.body.avatar, ')');
    console.log('   Buzzer Sound:', req.body.buzzerSound, '(type:', typeof req.body.buzzerSound, ')');
    console.log('   Device ID:', req.body.deviceId, '(type:', typeof req.body.deviceId, ')');

    // Check if a player with this deviceId already exists
    if (req.body.deviceId) {
      const existingPlayer = await Player.findOne({ where: { deviceId: req.body.deviceId } });

      if (existingPlayer) {
        console.log('🔄 Player with deviceId already exists, updating existing player:', {
          existingId: existingPlayer.id,
          existingName: existingPlayer.name,
          newName: req.body.name
        });

        // Update the existing player with new information
        existingPlayer.name = req.body.name;
        existingPlayer.age = req.body.age;
        existingPlayer.specialistSubject = req.body.specialistSubject;
        existingPlayer.avatar = req.body.avatar || existingPlayer.avatar;
        existingPlayer.buzzerSound = req.body.buzzerSound || existingPlayer.buzzerSound;
        existingPlayer.lastActive = new Date();

        const updatedPlayer = await existingPlayer.save();

        console.log('✅ Player updated successfully:', {
          id: updatedPlayer.id,
          name: updatedPlayer.name,
          age: updatedPlayer.age,
          specialistSubject: updatedPlayer.specialistSubject
        });

        return res.status(200).json(updatedPlayer);
      }
    }

    // Create new player if no existing player found
    const newPlayer = await Player.create({
      name: req.body.name,
      age: req.body.age,
      specialistSubject: req.body.specialistSubject,
      avatar: req.body.avatar,
      buzzerSound: req.body.buzzerSound,
      deviceId: req.body.deviceId
    });

    console.log('✅ Player created successfully:', {
      id: newPlayer.id,
      name: newPlayer.name,
      age: newPlayer.age,
      specialistSubject: newPlayer.specialistSubject
    });

    res.status(201).json(newPlayer);
  } catch (err) {
    console.log('❌ Player creation failed:', err.message);
    console.log('   Error details:', err);
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
    await res.player.destroy();
    res.json({ message: 'Player deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get top players - IMPORTANT: This route must be defined before the /:id routes
router.get('/leaderboard/top', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const topPlayers = await Player.getTopPlayers(limit);
    res.json(topPlayers);
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

// Middleware function to get player by ID
async function getPlayer(req, res, next) {
  let player;
  try {
    player = await Player.findByPk(req.params.id);
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
