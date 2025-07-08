module.exports = (sequelize, DataTypes) => {
  const GameSession = sequelize.define('GameSession', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    hostId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Players',
        key: 'id'
      }
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
    status: {
      type: DataTypes.ENUM('created', 'lobby', 'active', 'paused', 'completed'),
      defaultValue: 'created'
    },
    settings: {
      type: DataTypes.JSONB,
      defaultValue: {
        maxPlayers: 10,
        publicGame: true,
        allowJoinAfterStart: true,
        questionPoolSize: 30
      }
    },
    currentRound: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    currentQuestion: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    endedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['code']
      },
      {
        fields: ['hostId']
      },
      {
        fields: ['status']
      }
    ]
  });

  // Instance methods
  GameSession.prototype.startGame = function() {
    this.status = 'active';
    this.startedAt = new Date();
    return this.save();
  };

  GameSession.prototype.endGame = function() {
    this.status = 'completed';
    this.endedAt = new Date();
    return this.save();
  };

  GameSession.prototype.updatePlayerScore = function(playerId, scoreToAdd) {
    const players = this.players;
    const playerIndex = players.findIndex(p => p.playerId === playerId);

    if (playerIndex !== -1) {
      players[playerIndex].score += scoreToAdd;
      // Update positions based on scores
      this.updatePlayerPositions();
      this.changed('players', true);
      return this.save();
    }

    return Promise.reject(new Error('Player not found in this game session'));
  };

  GameSession.prototype.updatePlayerPositions = function() {
    const players = this.players;

    // Sort players by score in descending order
    players.sort((a, b) => b.score - a.score);

    // Update positions (handling ties - players with the same score get the same position)
    let position = 1;
    let lastScore = null;
    let lastPosition = 1;

    players.forEach((player, index) => {
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

    this.changed('players', true);
  };

  GameSession.prototype.moveToNextQuestion = function() {
    const rounds = this.rounds;
    const currentRound = rounds[this.currentRound];

    if (!currentRound) return Promise.reject(new Error('No active round'));

    if (this.currentQuestion < currentRound.questions.length - 1) {
      this.currentQuestion += 1;
    } else {
      // End of round
      currentRound.completed = true;
      this.changed('rounds', true);

      // Check if there are more rounds
      if (this.currentRound < rounds.length - 1) {
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

  // Set up associations
  GameSession.associate = function(models) {
    GameSession.belongsTo(models.Player, {
      foreignKey: 'hostId',
      as: 'host'
    });

    GameSession.hasMany(models.GameHistory, {
      foreignKey: 'gameSessionId'
    });
  };

  // Static methods
  GameSession.findByCode = function(code) {
    return GameSession.findOne({ where: { code } });
  };

  GameSession.getActiveGames = function() {
    return GameSession.findAll({
      where: {
        status: {
          [sequelize.Op.in]: ['lobby', 'active', 'paused']
        }
      }
    });
  };

  GameSession.getRecentGames = function(limit = 10) {
    return GameSession.findAll({
      where: { status: 'completed' },
      order: [['endedAt', 'DESC']],
      limit
    });
  };

  return GameSession;
};
