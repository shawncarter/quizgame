module.exports = (sequelize, DataTypes) => {
  const Player = sequelize.define('Player', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    age: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 120
      }
    },
    specialistSubject: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    avatar: {
      type: DataTypes.STRING,
      defaultValue: 'default-avatar'
    },
    buzzerSound: {
      type: DataTypes.STRING,
      defaultValue: 'default-buzzer'
    },
    deviceId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    lastActive: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    timestamps: true,
    indexes: [
      {
        unique: false,
        fields: ['deviceId']
      },
      {
        unique: false,
        fields: ['name', 'deviceId']
      }
    ]
  });

  // Instance methods
  Player.prototype.getTotalGamesPlayed = async function() {
    const gameHistories = await this.getGameHistories();
    return gameHistories.length;
  };

  Player.prototype.getAverageScore = async function() {
    const gameHistories = await this.getGameHistories();
    if (gameHistories.length === 0) return 0;

    const totalScore = gameHistories.reduce((sum, game) => sum + game.score, 0);
    return totalScore / gameHistories.length;
  };

  Player.prototype.getTotalWins = async function() {
    const gameHistories = await this.getGameHistories();
    return gameHistories.filter(game => game.position === 1).length;
  };

  // Set up associations
  Player.associate = function(models) {
    Player.hasMany(models.GameSession, {
      foreignKey: 'hostId',
      as: 'hostedGames'
    });

    Player.hasMany(models.GameHistory, {
      foreignKey: 'playerId'
    });
  };

  // Static methods
  Player.findByDeviceId = function(deviceId) {
    return Player.findOne({ where: { deviceId } });
  };

  Player.getTopPlayers = async function(limit = 10) {
    const { GameHistory } = sequelize.models;

    // Using Sequelize's query builder for complex queries
    const topPlayers = await sequelize.query(`
      SELECT
        p.id,
        p.name,
        SUM(gh.score) as totalScore,
        COUNT(gh.id) as gamesPlayed,
        SUM(CASE WHEN gh.position = 1 THEN 1 ELSE 0 END) as wins
      FROM "Players" p
      JOIN "GameHistories" gh ON p.id = gh."playerId"
      GROUP BY p.id, p.name
      ORDER BY totalScore DESC
      LIMIT :limit
    `, {
      replacements: { limit },
      type: sequelize.QueryTypes.SELECT
    });

    return topPlayers;
  };

  return Player;
};
