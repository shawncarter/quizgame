const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const GameSessionSchema = new Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  hostId: {
    type: Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  players: [{
    playerId: {
      type: Schema.Types.ObjectId,
      ref: 'Player'
    },
    score: {
      type: Number,
      default: 0
    },
    position: {
      type: Number,
      default: 0
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    active: {
      type: Boolean,
      default: true
    }
  }],
  rounds: [{
    type: {
      type: String,
      enum: ['pointBuilder', 'graduatedPoints', 'fastestFinger', 'specialist'],
      required: true
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    questions: [{
      type: Schema.Types.ObjectId,
      ref: 'Question'
    }],
    completed: {
      type: Boolean,
      default: false
    },
    timeLimit: {
      type: Number,  // Time limit per question in seconds
      default: 30
    }
  }],
  status: {
    type: String,
    enum: ['created', 'lobby', 'active', 'paused', 'completed'],
    default: 'created'
  },
  settings: {
    maxPlayers: {
      type: Number,
      default: 10
    },
    publicGame: {
      type: Boolean,
      default: true
    },
    allowJoinAfterStart: {
      type: Boolean,
      default: false
    },
    questionPoolSize: {
      type: Number,
      default: 30  // Number of questions to generate for the game
    }
  },
  currentRound: {
    type: Number,
    default: 0
  },
  currentQuestion: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  startedAt: {
    type: Date
  },
  endedAt: {
    type: Date
  }
});

// Methods to manage game state
GameSessionSchema.methods.startGame = function() {
  this.status = 'active';
  this.startedAt = new Date();
  return this.save();
};

GameSessionSchema.methods.endGame = function() {
  this.status = 'completed';
  this.endedAt = new Date();
  return this.save();
};

GameSessionSchema.methods.updatePlayerScore = function(playerId, scoreToAdd) {
  const playerIndex = this.players.findIndex(p => p.playerId.toString() === playerId.toString());
  if (playerIndex !== -1) {
    this.players[playerIndex].score += scoreToAdd;
    // Update positions based on scores
    this.updatePlayerPositions();
    return this.save();
  }
  return Promise.reject(new Error('Player not found in this game session'));
};

GameSessionSchema.methods.updatePlayerPositions = function() {
  // Sort players by score in descending order
  this.players.sort((a, b) => b.score - a.score);
  
  // Update positions (handling ties - players with the same score get the same position)
  let position = 1;
  let lastScore = null;
  let lastPosition = 1;
  
  this.players.forEach((player, index) => {
    if (index === 0) {
      player.position = position;
      lastScore = player.score;
    } else {
      if (player.score === lastScore) {
        player.position = lastPosition;
      } else {
        position = index + 1;
        player.position = position;
        lastPosition = position;
        lastScore = player.score;
      }
    }
  });
};

GameSessionSchema.methods.moveToNextQuestion = function() {
  const currentRound = this.rounds[this.currentRound];
  if (!currentRound) return Promise.reject(new Error('No active round'));
  
  if (this.currentQuestion < currentRound.questions.length - 1) {
    this.currentQuestion += 1;
  } else {
    // End of round
    currentRound.completed = true;
    // Check if there are more rounds
    if (this.currentRound < this.rounds.length - 1) {
      this.currentRound += 1;
      this.currentQuestion = 0;
    } else {
      // End of game
      this.status = 'completed';
      this.endedAt = new Date();
    }
  }
  
  return this.save();
};

// Static methods for finding games
GameSessionSchema.statics.findByCode = function(code) {
  return this.findOne({ code });
};

GameSessionSchema.statics.getActiveGames = function() {
  return this.find({ status: { $in: ['lobby', 'active', 'paused'] } });
};

GameSessionSchema.statics.getRecentGames = function(limit = 10) {
  return this.find({ status: 'completed' })
    .sort({ endedAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('GameSession', GameSessionSchema);
