module.exports = (sequelize, DataTypes) => {
  const GameHistory = sequelize.define('GameHistory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    gameSessionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'GameSessions',
        key: 'id'
      }
    },
    hostId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Players',
        key: 'id'
      }
    },
    playerCount: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    players: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    rounds: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    code: {
      type: DataTypes.STRING
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    endedAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    gameSettings: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    winner: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    categories: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    questionStats: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    timestamps: true,
    indexes: [
      {
        fields: ['gameSessionId']
      },
      {
        fields: ['hostId']
      },
      {
        fields: ['startedAt']
      }
    ]
  });

  // Instance methods
  GameHistory.prototype.calculateWinner = function() {
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

  GameHistory.prototype.calculateStats = function() {
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

  // Static methods
  GameHistory.getRecentGames = function(limit = 10) {
    return GameHistory.findAll({
      order: [['startedAt', 'DESC']],
      limit,
      include: [{
        model: sequelize.models.Player,
        as: 'host',
        attributes: ['name']
      }],
      attributes: ['id', 'code', 'startedAt', 'endedAt', 'duration', 'playerCount', 'winner']
    });
  };

  GameHistory.getPlayerGameHistory = function(playerId, limit = 10) {
    return sequelize.query(`
      SELECT gh.id, gh.code, gh."startedAt", gh."endedAt", gh.duration, gh."playerCount", gh.winner
      FROM "GameHistories" gh, jsonb_array_elements(gh.players) as player
      WHERE player->>'playerId' = :playerId
      ORDER BY gh."startedAt" DESC
      LIMIT :limit
    `, {
      replacements: { playerId, limit },
      type: sequelize.QueryTypes.SELECT
    });
  };

  GameHistory.getGameStats = async function() {
    const totalGames = await GameHistory.count();

    const playerCounts = await sequelize.query(`
      SELECT SUM("playerCount") as "totalPlayers" FROM "GameHistories"
    `, { type: sequelize.QueryTypes.SELECT });

    const averageDuration = await sequelize.query(`
      SELECT AVG(duration) as "avgDuration" FROM "GameHistories"
    `, { type: sequelize.QueryTypes.SELECT });

    const mostPopularCategories = await sequelize.query(`
      SELECT category, COUNT(*) as count
      FROM "GameHistories", unnest(categories) as category
      GROUP BY category
      ORDER BY count DESC
      LIMIT 5
    `, { type: sequelize.QueryTypes.SELECT });

    return {
      totalGames,
      totalPlayers: playerCounts.length > 0 ? parseInt(playerCounts[0].totalPlayers) : 0,
      averageDuration: averageDuration.length > 0 ? parseFloat(averageDuration[0].avgDuration) : 0,
      mostPopularCategories: mostPopularCategories.map(cat => ({ name: cat.category, count: parseInt(cat.count) }))
    };
  };

  // Set up associations
  GameHistory.associate = function(models) {
    GameHistory.belongsTo(models.GameSession, {
      foreignKey: 'gameSessionId'
    });

    GameHistory.belongsTo(models.Player, {
      foreignKey: 'hostId',
      as: 'host'
    });
  };

  return GameHistory;
};
