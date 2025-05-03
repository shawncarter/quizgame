const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const GameHistorySchema = new Schema({
  gameSession: {
    type: Schema.Types.ObjectId,
    ref: 'GameSession',
    required: true
  },
  hostId: {
    type: Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  playerCount: {
    type: Number,
    required: true
  },
  players: [{
    playerId: {
      type: Schema.Types.ObjectId,
      ref: 'Player'
    },
    name: {
      type: String,
      required: true
    },
    finalScore: {
      type: Number,
      default: 0
    },
    position: {
      type: Number
    },
    joinedAt: {
      type: Date
    },
    leftAt: {
      type: Date
    },
    roundStats: [{
      roundIndex: {
        type: Number,
        required: true
      },
      roundType: {
        type: String,
        required: true
      },
      score: {
        type: Number,
        default: 0
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
      averageResponseTime: {
        type: Number  // in milliseconds
      }
    }]
  }],
  rounds: [{
    index: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    questionCount: {
      type: Number,
      required: true
    },
    averageResponseTime: {
      type: Number  // in milliseconds
    },
    categories: [{
      type: String
    }],
    hardestQuestion: {
      questionId: {
        type: Schema.Types.ObjectId,
        ref: 'Question'
      },
      correctPercentage: {
        type: Number
      }
    },
    easiestQuestion: {
      questionId: {
        type: Schema.Types.ObjectId,
        ref: 'Question'
      },
      correctPercentage: {
        type: Number
      }
    }
  }],
  code: {
    type: String
  },
  startedAt: {
    type: Date,
    required: true
  },
  endedAt: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,  // in seconds
    required: true
  },
  gameSettings: {
    maxPlayers: Number,
    publicGame: Boolean,
    allowJoinAfterStart: Boolean,
    questionPoolSize: Number
  },
  winner: {
    playerId: {
      type: Schema.Types.ObjectId,
      ref: 'Player'
    },
    name: String,
    score: Number
  },
  categories: [{
    type: String
  }],
  questionStats: {
    total: {
      type: Number,
      required: true
    },
    correctPercentage: {
      type: Number
    },
    averageResponseTime: {
      type: Number  // in milliseconds
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate winner based on final scores
GameHistorySchema.methods.calculateWinner = function() {
  if (!this.players || this.players.length === 0) return null;
  
  // Find the player with the highest score
  const winner = this.players.reduce((highest, player) => {
    return (player.finalScore > highest.finalScore) ? player : highest;
  }, this.players[0]);
  
  this.winner = {
    playerId: winner.playerId,
    name: winner.name,
    score: winner.finalScore
  };
  
  return this.winner;
};

// Calculate aggregate stats
GameHistorySchema.methods.calculateStats = function() {
  // Calculate question stats
  let totalCorrect = 0;
  let totalResponseTime = 0;
  let totalAnswers = 0;
  
  this.players.forEach(player => {
    player.roundStats.forEach(roundStat => {
      totalCorrect += roundStat.correctAnswers;
      totalAnswers += roundStat.correctAnswers + roundStat.incorrectAnswers;
      totalResponseTime += roundStat.averageResponseTime * 
        (roundStat.correctAnswers + roundStat.incorrectAnswers);
    });
  });
  
  this.questionStats = {
    total: this.rounds.reduce((sum, round) => sum + round.questionCount, 0),
    correctPercentage: totalAnswers > 0 ? (totalCorrect / totalAnswers) * 100 : 0,
    averageResponseTime: totalAnswers > 0 ? totalResponseTime / totalAnswers : 0
  };
  
  return this.questionStats;
};

// Static methods for retrieving game history
GameHistorySchema.statics.getRecentGames = function(limit = 10) {
  return this.find()
    .sort({ startedAt: -1 })
    .limit(limit)
    .populate('hostId', 'name')
    .select('code startedAt endedAt duration playerCount winner');
};

GameHistorySchema.statics.getPlayerGameHistory = function(playerId, limit = 10) {
  return this.find({ 'players.playerId': playerId })
    .sort({ startedAt: -1 })
    .limit(limit)
    .select('code startedAt endedAt duration playerCount winner');
};

GameHistorySchema.statics.getGameStats = async function() {
  const totalGames = await this.countDocuments();
  
  const playerCounts = await this.aggregate([
    { $group: { _id: null, totalPlayers: { $sum: '$playerCount' } } }
  ]);
  
  const averageDuration = await this.aggregate([
    { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
  ]);
  
  const mostPopularCategories = await this.aggregate([
    { $unwind: '$categories' },
    { $group: { _id: '$categories', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);
  
  return {
    totalGames,
    totalPlayers: playerCounts.length > 0 ? playerCounts[0].totalPlayers : 0,
    averageDuration: averageDuration.length > 0 ? averageDuration[0].avgDuration : 0,
    mostPopularCategories: mostPopularCategories.map(cat => ({ name: cat._id, count: cat.count }))
  };
};

module.exports = mongoose.model('GameHistory', GameHistorySchema);
