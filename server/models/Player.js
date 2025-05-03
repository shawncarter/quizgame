const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PlayerSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  age: {
    type: Number,
    required: true,
    min: 1,
    max: 120
  },
  specialistSubject: {
    type: String,
    required: true,
    trim: true
  },
  avatar: {
    type: String,
    default: 'default-avatar'  // Placeholder for MVP
  },
  buzzerSound: {
    type: String,
    default: 'default-buzzer'  // Placeholder for MVP
  },
  gameHistory: [{
    gameId: {
      type: Schema.Types.ObjectId,
      ref: 'GameSession'
    },
    score: {
      type: Number,
      default: 0
    },
    position: {
      type: Number
    },
    correctAnswers: {
      type: Number,
      default: 0
    },
    incorrectAnswers: {
      type: Number,
      default: 0
    },
    fastestAnswers: {
      type: Number,
      default: 0
    },
    playedAt: {
      type: Date,
      default: Date.now
    }
  }],
  deviceId: {
    type: String,
    index: true  // Add index for faster lookups
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
});

// Add methods to retrieve player stats
PlayerSchema.methods.getTotalGamesPlayed = function() {
  return this.gameHistory.length;
};

PlayerSchema.methods.getAverageScore = function() {
  if (this.gameHistory.length === 0) return 0;
  
  const totalScore = this.gameHistory.reduce((sum, game) => sum + game.score, 0);
  return totalScore / this.gameHistory.length;
};

PlayerSchema.methods.getTotalWins = function() {
  return this.gameHistory.filter(game => game.position === 1).length;
};

// Create a compound index for faster lookups
PlayerSchema.index({ name: 1, deviceId: 1 });

// Define static methods for common queries
PlayerSchema.statics.findByDeviceId = function(deviceId) {
  return this.findOne({ deviceId });
};

PlayerSchema.statics.getTopPlayers = function(limit = 10) {
  return this.aggregate([
    { $unwind: '$gameHistory' },
    { $group: { 
      _id: '$_id', 
      name: { $first: '$name' },
      totalScore: { $sum: '$gameHistory.score' },
      gamesPlayed: { $sum: 1 },
      wins: { 
        $sum: { 
          $cond: [{ $eq: ['$gameHistory.position', 1] }, 1, 0] 
        } 
      }
    }},
    { $sort: { totalScore: -1 } },
    { $limit: limit }
  ]);
};

module.exports = mongoose.model('Player', PlayerSchema);
